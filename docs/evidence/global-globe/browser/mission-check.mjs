// Replayable, isolated headless acceptance. No personal browser profile is used.
// Install Playwright separately or set REDLINE_BROWSER_MODULES to its node_modules.
// Run a production preview, then: node docs/evidence/global-globe/browser/mission-check.mjs
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'

const require = process.env.REDLINE_BROWSER_MODULES
  ? createRequire(path.join(process.env.REDLINE_BROWSER_MODULES, 'playwright', 'package.json'))
  : createRequire(import.meta.url)
const { chromium } = require('playwright')
const { expect } = require('playwright/test')
const output = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'))
await mkdir(output, { recursive: true })
const results = { url: process.env.REDLINE_QA_URL ?? 'http://127.0.0.1:4174/', browser: 'isolated headless Chromium', checks: [], pageErrors: [], consoleErrors: [], tileResponses: 0, screenshots: [] }
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
await context.addInitScript(() => {
  // Test-only lifecycle/protocol faults. Actual terrain and NASA responses stay intact.
  const NativeWorker = window.Worker
  window.__routeQA = { mode: 'normal', started: 0, terminated: 0, active: 0 }
  window.Worker = class extends EventTarget {
    constructor(url, options) {
      super()
      if (window.__routeQA.mode === 'startup-failure') throw new Error('Injected test-only worker startup failure')
      this.inner = new NativeWorker(url, options)
      this.done = false
      this.mode = window.__routeQA.mode
      window.__routeQA.started++
      window.__routeQA.active++
      for (const name of ['message', 'error', 'messageerror']) this.inner.addEventListener(name, event => {
        if (this.done || this.mode === 'held') return
        if (name === 'message') {
          const data = this.mode === 'invalid-response' ? { ...event.data, result: { status: 'available', value: null } } : event.data
          this.dispatchEvent(new MessageEvent('message', { data }))
        } else this.dispatchEvent(new Event(name))
      })
    }
    postMessage(...args) { this.inner.postMessage(...args) }
    terminate() {
      if (this.done) return
      this.done = true
      this.inner.terminate()
      window.__routeQA.active--
      window.__routeQA.terminated++
    }
  }
})
const page = await context.newPage()
page.on('pageerror', error => results.pageErrors.push(error.message))
page.on('console', message => { if (message.type() === 'error') results.consoleErrors.push(message.text()) })
page.on('response', response => { if (response.url().includes('trek.nasa.gov') && /\.png/.test(response.url()) && response.ok()) results.tileResponses++ })
const record = name => { results.checks.push(name); console.log(`PASS ${name}`) }
const screenshot = async name => { await page.screenshot({ path: path.join(output, name), fullPage: true }); results.screenshots.push(name) }
const plan = () => page.getByRole('button', { name: 'Plan', exact: true })
const routePanel = () => page.locator('.route-planner')
const ready = () => expect(routePanel().locator('.route-option')).toHaveCount(2, { timeout: 25000 })
const setCell = async (row, column, role) => {
  await page.getByLabel('Native row (586–841)', { exact: true }).fill(String(row))
  await page.getByLabel('Native column (522–777)', { exact: true }).fill(String(column))
  const button = page.getByRole('button', { name: `Set grid ${role}`, exact: true })
  await expect(button).toBeEnabled({ timeout: 90000 })
  await button.click()
}
const calculate = () => page.getByRole('button', { name: /^(Calculate|Retry) hypothetical routes$/ }).click()
const scienceButton = () => page.getByRole('button', { name: 'Scientific validation: Partial. Open scientific details', exact: true })
const qualification = 'Distance-only hypothetical route. Terrain and human safety are not validated.'
const science = () => page.locator('#scientific-details')
const scienceStatuses = [
  ['Source-to-grid preservation', 'verified'], ['Reference-sphere distances', 'verified'],
  ['A* mathematical search', 'verified'], ['Hypothetical distance-only paths', 'verified'],
  ['Requested HiRISE height definition', 'verified'], ['Live CTX vertical height reference', 'unverified'],
  ['Absolute feature-to-DEM registration', 'unverified'], ['Real-Mars physical slopes', 'unverified'],
  ['Physical terrain costs', 'unverified'], ['Precise named-feature routing', 'unverified'],
  ['Scientific globe orientation', 'unverified'],
]
const openScience = async () => {
  await scienceButton().focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('#validation-heading')).toBeFocused()
  await expect(page.locator('.controls-slot')).toBeHidden()
}
const mode = value => page.evaluate(value => { window.__routeQA.mode = value }, value)
const checkFieldAlignment = async name => {
  const boxes = await routePanel().locator('.grid-cell-fields input').evaluateAll(inputs => inputs.map(input => {
    const rect = input.getBoundingClientRect()
    return { top: rect.top, height: rect.height, width: rect.width }
  }))
  assert.equal(boxes.length, 2)
  assert.ok(boxes.every(box => box.height >= 44 && box.width > 0), `${name}: waypoint fields have unusable dimensions`)
  assert.ok(Math.abs(boxes[0].top - boxes[1].top) < 0.5, `${name}: waypoint input rows are misaligned`)
  results.fieldAlignment ??= []
  results.fieldAlignment.push({ viewport: name, boxes })
}

try {
  await page.goto(results.url, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: 'Rotate globe left', exact: true })).toBeEnabled({ timeout: 30000 })
  await page.getByRole('button', { name: 'Rotate globe left', exact: true }).click()
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  await expect(page.locator('.app-footer')).not.toContainText('Terrain data')
  await expect(page.locator('.viewport-qualification')).toHaveCount(0)
  await screenshot('desktop-overview.png')
  record('Real NASA globe and navigation remain usable with compact global science status')
  await openScience()
  await science().getByText('Capability status', { exact: true }).click()
  for (const [label, status] of scienceStatuses) {
    const entry = science().locator('.scientific-findings > div').filter({ has: page.getByText(label, { exact: true }) })
    await expect(entry.locator('.status-label')).toHaveAttribute('data-status', status)
    await expect(entry.locator('.helper')).not.toBeEmpty()
  }
  await screenshot('desktop-scientific-details.png')
  for (const summary of ['Registration evidence & limitations', 'CTX height reference & terrain limits', 'Separate HiRISE height definition', 'Source identity & full audit']) {
    const control = science().getByText(summary, { exact: true })
    await control.focus()
    await page.keyboard.press('Enter')
    await expect(control.locator('..')).toHaveAttribute('open', '')
  }
  await expect(science()).toContainText('2.019619400 projected m')
  await expect(science()).toContainText('No overlap')
  await expect(science()).toContainText(qualification)
  await page.getByText('Model details & source links', { exact: true }).click()
  await expect(page.locator('#globe-source-heading').locator('..')).toContainText('No geographic model orientation is validated')
  await expect(page.locator('#globe-source-heading').locator('..')).toContainText('does not transfer a surface location')
  const downloadEvent = page.waitForEvent('download')
  await science().getByRole('link', { name: 'Download full scientific audit', exact: true }).click()
  const download = await downloadEvent
  const downloaded = await readFile(await download.path())
  const original = await readFile(new URL('../../../science-routing-audit.md', import.meta.url))
  assert.deepEqual(downloaded, original, 'Audit download differs from historical source')
  results.auditDownload = { filename: download.suggestedFilename(), bytes: downloaded.length, sha256: createHash('sha256').update(downloaded).digest('hex') }
  await science().locator('details').evaluateAll(details => details.forEach(detail => { detail.open = false }))
  await page.keyboard.press('Escape')
  await expect(scienceButton()).toBeFocused()
  record('Keyboard science access preserves all 11 statuses, technical evidence and byte-identical full audit download')
  await openScience()
  await plan().click()
  await page.keyboard.press('Escape')
  await expect(plan()).toBeFocused()
  record('Switching from science to another drawer restores the current navigation trigger')
  await page.getByRole('button', { name: 'Layers', exact: true }).click()
  for (const productId of ['Mars_MGS_MOLA_ClrShade_merge_global_463m', 'Jezero_CTX_BlockAdj_dd', 'JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0']) {
    await expect(page.locator('#mission-control')).toContainText(productId)
  }
  await expect(page.locator('#mission-control')).toContainText('Rendered shaded-relief imagery, not numerical elevation.')
  await expect(page.locator('#mission-control')).toContainText('Preliminary CTX imagery')
  await expect(page.locator('#mission-control')).toContainText('Controlled CTX imagery')
  await expect(page.locator('.app-footer')).not.toContainText('Terrain data')
  await screenshot('desktop-layer-details.png')
  await page.keyboard.press('Escape')
  record('Layer selection retains exact identities and MOLA/preliminary/controlled distinctions without global terrain warnings')
  await plan().click()
  await expect(page.getByRole('button', { name: 'Calculate hypothetical routes', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Open planning terrain', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Set grid origin', exact: true })).toBeEnabled({ timeout: 90000 })
  await expect(page.locator('.terrain-ready-status')).toContainText('65,536 valid')
  await expect(page.locator('.viewport-qualification')).toHaveCount(0)
  await page.getByRole('button', { name: 'Pick origin on map', exact: true }).click()
  await expect(page.locator('.grid-pick-status')).toBeVisible()
  await openScience()
  await expect(page.locator('.grid-pick-status')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(scienceButton()).toBeFocused()
  await plan().click()
  record('Real 65,536-cell grid loads; controlled CTX enables endpoint controls')
  record('Opening science exits map picking; Escape closes the drawer and restores focus')
  await setCell(650, 575, 'origin')
  await setCell(780, 735, 'destination')
  await calculate()
  await expect(routePanel().locator('.route-option')).toHaveCount(1, { timeout: 25000 })
  await expect(routePanel()).toContainText('Shortest grid path calculated')
  await expect(page.locator('.validation-status')).toContainText('Partial')
  await expect(page.locator('.route-qualification')).toHaveText(qualification)
  await expect(routePanel()).toContainText(qualification)
  record('Actual production worker calculates a qualified shortest grid path')
  await routePanel().getByText('Optional waypoint', { exact: true }).click()
  await page.getByLabel('Waypoint row (586–841)', { exact: true }).fill('740')
  await page.getByLabel('Waypoint column (522–777)', { exact: true }).fill('600')
  await checkFieldAlignment('desktop')
  await routePanel().locator('details').first().screenshot({ path: path.join(output, 'waypoint-alignment.png') })
  results.screenshots.push('waypoint-alignment.png')
  record('Wrapped waypoint labels preserve aligned, usable input rows')
  await page.getByRole('button', { name: 'Set waypoint', exact: true }).click()
  await expect(routePanel().locator('.route-option')).toHaveCount(0)
  await calculate()
  await ready()
  await expect(routePanel()).toContainText('Both paths calculated')
  await routePanel().getByRole('button', { name: /^Via your waypoint/ }).focus()
  await page.keyboard.press('Enter')
  await expect(routePanel().getByRole('button', { name: /^Via your waypoint/ })).toHaveAttribute('aria-pressed', 'true')
  results.calculatedLabels = await routePanel().locator('.route-option').allTextContents()
  record('Waypoint invalidates old results; two measured paths support keyboard selection')
  await page.getByRole('button', { name: 'Show paths on map', exact: true }).click()
  await routePanel().locator('.route-options').scrollIntoViewIfNeeded()
  await screenshot('desktop-routes.png')
  await page.getByRole('button', { name: 'Layers', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Controlled Jezero CTX imagery', exact: true }).uncheck()
  await expect(page.locator('.route-qualification')).toHaveCount(0)
  await page.getByRole('checkbox', { name: 'Controlled Jezero CTX imagery', exact: true }).check()
  await expect(page.locator('.route-qualification')).toHaveText(qualification)
  await plan().click()
  await ready()
  record('Controlled layer visibility hides and restores route qualification while preserving calculated paths')
  await page.getByLabel('Waypoint row (586–841)', { exact: true }).fill('585')
  await page.getByRole('button', { name: 'Set waypoint', exact: true }).click()
  await expect(routePanel()).toContainText('Waypoint W: row 740, column 600')
  await ready()
  record('Invalid waypoint draft retains the distinctly labeled active waypoint')
  await page.getByRole('button', { name: 'Swap grid endpoints', exact: true }).click()
  await expect(routePanel().locator('.route-option')).toHaveCount(0)
  await mode('held')
  await calculate()
  await expect(page.getByRole('button', { name: 'Cancel calculation', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Swap grid endpoints', exact: true }).click()
  await expect(routePanel().locator('.route-option')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Cancel calculation', exact: true })).toHaveCount(0)
  assert.equal(await page.evaluate(() => window.__routeQA.active), 0)
  record('Endpoint change during search terminates its worker and suppresses stale paths')
  await calculate()
  await page.getByRole('button', { name: 'Cancel calculation', exact: true }).click()
  assert.equal(await page.evaluate(() => window.__routeQA.active), 0)
  record('Explicit cancellation returns to idle and terminates its worker')
  await mode('startup-failure')
  await calculate()
  await expect(routePanel().getByRole('alert')).toContainText('could not start')
  await expect(routePanel().locator('.route-option')).toHaveCount(0)
  await mode('invalid-response')
  await calculate()
  await expect(routePanel().getByRole('alert')).toContainText('invalid result')
  await mode('held')
  await calculate()
  await expect(routePanel().getByRole('alert')).toContainText('timed out', { timeout: 25000 })
  assert.equal(await page.evaluate(() => window.__routeQA.active), 0)
  record('Worker startup, malformed-response and timeout failures show actionable retry states')
  await screenshot('worker-timeout.png')
  await mode('normal')
  await calculate()
  await ready()
  await page.getByRole('button', { name: 'Clear waypoint', exact: true }).click()
  await expect(routePanel().locator('.route-option')).toHaveCount(0)
  await calculate()
  await expect(routePanel().locator('.route-option')).toHaveCount(1, { timeout: 25000 })
  record('Retry recovers with the actual worker; clearing waypoint resets comparison')
  await page.getByRole('button', { name: 'Sources', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Sources & status', exact: true })).toBeVisible()
  await expect(page.locator('.controls-slot')).toBeHidden()
  await expect(page.locator('#information-panel')).toContainText(/distance-only hypothetical paths/i)
  await page.getByText('Coordinate reference', { exact: true }).click()
  await expect(page.locator('.coordinate-detail')).toHaveAttribute('open', '')
  record('Exclusive source drawer preserves scientific qualifications and expanded coordinate metadata')
  await page.keyboard.press('Escape')
  await expect(page.locator('.information-slot')).toBeHidden()
  await page.getByRole('button', { name: 'About REDLINE', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('distance-only hypothetical paths')
  await page.getByRole('button', { name: 'View scientific details', exact: true }).click()
  await expect(page.locator('#validation-heading')).toBeFocused()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'About REDLINE', exact: true })).toBeFocused()
  record('About dialog links to scientific details and restores focus to its visible opener')
  for (const [name, width, height] of [['tablet', 768, 1024], ['mobile', 390, 844], ['small-mobile', 320, 800]]) {
    await page.setViewportSize({ width, height })
    await plan().click()
    await routePanel().getByRole('heading', { name: 'Hypothetical routes', exact: true }).scrollIntoViewIfNeeded()
    await expect(routePanel()).toContainText(qualification)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} overflow`)
    const warning = await page.locator('.route-qualification').boundingBox()
    const notice = await page.locator('.explorer-notice').boundingBox()
    assert.ok(warning && (!notice || notice.y + notice.height <= warning.y), `${name}: informational notice overlaps route qualification`)
    await checkFieldAlignment(name)
    await screenshot(`${name}-routes.png`)
    await page.getByRole('button', { name: 'Close mission control', exact: true }).click()
    await expect(page.locator('.controls-slot')).toBeHidden()
    assert.ok(await page.locator('.map-credit').isVisible(), `${name} map attribution hidden`)
    await openScience()
    await expect(science().locator('.status-label[data-status="partial"]')).toBeVisible()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} scientific details overflow`)
    await screenshot(`${name}-scientific-details.png`)
    await page.keyboard.press('Escape')
    await expect(scienceButton()).toBeFocused()
    record(`${name}: route controls, scientific status, attribution and drawer interaction without horizontal overflow`)
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await plan().click()
  await page.getByRole('button', { name: 'Clear grid endpoints', exact: true }).click()
  await expect(routePanel().locator('.route-option')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Calculate hypothetical routes', exact: true })).toBeDisabled()
  await expect(page.locator('.viewport-qualification')).toHaveCount(0)
  await page.getByText('Explore approximate feature references', { exact: true }).click()
  await page.locator('.feature-planner .reference-button').first().click()
  await expect(page.locator('.reference-detail')).toContainText('absolute feature-to-DEM registration unverified')
  await expect(page.locator('.viewport-qualification')).toContainText('absolute registration unverified')
  await screenshot('desktop-selected-feature.png')
  record('Clearing endpoints immediately removes paths and blocks calculation')
  record('Selected approximate feature receives its own qualification with full target provenance retained')
  assert.ok(results.tileResponses > 0, 'No actual NASA PNG tile responses observed')
  assert.deepEqual(results.pageErrors, [])
  assert.deepEqual(results.consoleErrors, [])
  record('Actual NASA tile responses observed; no page or console errors')
} catch (error) {
  results.failure = String(error.stack ?? error)
  await screenshot('failure.png').catch(() => {})
  throw error
} finally {
  results.workers = await page.evaluate(() => window.__routeQA).catch(() => null)
  await writeFile(path.join(output, 'mission-results.json'), `${JSON.stringify(results, null, 2)}\n`)
  await context.close()
  await browser.close()
}
