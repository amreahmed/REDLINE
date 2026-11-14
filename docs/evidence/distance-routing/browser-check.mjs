// Replayable, isolated headless acceptance. No personal browser profile is used.
// Install Playwright separately or set REDLINE_BROWSER_MODULES to its node_modules.
// Run a production preview, then: node docs/evidence/distance-routing/browser-check.mjs
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const require = process.env.REDLINE_BROWSER_MODULES
  ? createRequire(path.join(process.env.REDLINE_BROWSER_MODULES, 'playwright', 'package.json'))
  : createRequire(import.meta.url)
const { chromium } = require('playwright')
const { expect } = require('playwright/test')
const output = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'))
await mkdir(output, { recursive: true })
const results = { url: process.env.REDLINE_QA_URL ?? 'http://127.0.0.1:4173/', browser: 'isolated headless Chromium', checks: [], pageErrors: [], consoleErrors: [], tileResponses: 0, screenshots: [] }
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
  await plan().click()
  await expect(page.getByRole('button', { name: 'Calculate hypothetical routes', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Open planning terrain', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Set grid origin', exact: true })).toBeEnabled({ timeout: 90000 })
  await expect(page.locator('.terrain-ready-status')).toContainText('65,536 valid')
  record('Real 65,536-cell grid loads; controlled CTX enables endpoint controls')
  await setCell(650, 575, 'origin')
  await setCell(780, 735, 'destination')
  await calculate()
  await expect(routePanel().locator('.route-option')).toHaveCount(1, { timeout: 25000 })
  await expect(routePanel()).toContainText('Shortest grid path calculated')
  await expect(page.locator('.validation-status')).toContainText('Partial')
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
  await expect(page.locator('#information-panel')).toContainText('distance-only hypothetical paths')
  await page.getByText('Coordinate reference', { exact: true }).click()
  await expect(page.locator('.coordinate-detail')).toHaveAttribute('open', '')
  record('Exclusive source drawer preserves scientific qualifications and expanded coordinate metadata')
  await page.keyboard.press('Escape')
  await expect(page.locator('.information-slot')).toBeHidden()
  await page.getByRole('button', { name: 'About REDLINE', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('distance-only grid paths')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  record('About dialog retains route and science limits and supports Escape')
  for (const [name, width, height] of [['tablet', 768, 1024], ['mobile', 390, 844], ['small-mobile', 320, 800]]) {
    await page.setViewportSize({ width, height })
    await plan().click()
    await routePanel().getByRole('heading', { name: 'Hypothetical routes', exact: true }).scrollIntoViewIfNeeded()
    await expect(routePanel()).toContainText('Simulation:')
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} overflow`)
    await checkFieldAlignment(name)
    await screenshot(`${name}-routes.png`)
    await page.getByRole('button', { name: 'Close mission control', exact: true }).click()
    await expect(page.locator('.controls-slot')).toBeHidden()
    assert.ok(await page.locator('.map-credit').isVisible(), `${name} map attribution hidden`)
    record(`${name}: route controls, scientific status, attribution and drawer interaction without horizontal overflow`)
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await plan().click()
  await page.getByRole('button', { name: 'Clear grid endpoints', exact: true }).click()
  await expect(routePanel().locator('.route-option')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Calculate hypothetical routes', exact: true })).toBeDisabled()
  record('Clearing endpoints immediately removes paths and blocks calculation')
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
  await writeFile(path.join(output, 'browser-results.json'), `${JSON.stringify(results, null, 2)}\n`)
  await context.close()
  await browser.close()
}
