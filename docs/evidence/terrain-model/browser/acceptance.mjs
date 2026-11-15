// Isolated Chromium. No personal browser profile, device UI or security bypass.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(path.join(process.env.REDLINE_BROWSER_MODULES ?? 'C:/Users/LOQ/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules', 'playwright/package.json'))
const { chromium } = require('playwright')
const { expect } = require('playwright/test')
const output = path.dirname(fileURLToPath(import.meta.url))
await mkdir(output, { recursive: true })
const results = { url: process.env.REDLINE_QA_URL ?? 'http://127.0.0.1:4174/', browser: 'isolated headless Chromium', checks: [], pageErrors: [], consoleErrors: [], tileResponses: 0, screenshots: [], comparisons: [] }
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
await context.addInitScript(() => {
  const NativeWorker = window.Worker
  window.__terrainQA = { mode: 'normal', active: 0, started: 0, terminated: 0, last: null }
  window.Worker = class extends EventTarget {
    constructor(url, options) {
      super()
      this.terrain = String(url).includes('terrainRouteWorker')
      this.mode = this.terrain ? window.__terrainQA.mode : 'normal'
      if (this.mode === 'startup-failure') throw new Error('Test-only worker startup failure')
      this.inner = new NativeWorker(url, options); this.done = false
      if (this.terrain) { window.__terrainQA.started++; window.__terrainQA.active++ }
      for (const name of ['message', 'error', 'messageerror']) this.inner.addEventListener(name, event => {
        if (this.done || this.mode === 'held') return
        if (name === 'message') {
          if (this.terrain) window.__terrainQA.last = event.data.result
          const data = this.mode === 'invalid' ? { ...event.data, result: { analysis: null, routes: { status: 'available', value: null } } } : event.data
          this.dispatchEvent(new MessageEvent('message', { data }))
        } else this.dispatchEvent(new Event(name))
      })
    }
    postMessage(...args) { this.inner.postMessage(...args) }
    terminate() { if (this.done) return; this.done = true; this.inner.terminate(); if (this.terrain) { window.__terrainQA.active--; window.__terrainQA.terminated++ } }
  }
})
const page = await context.newPage()
page.on('pageerror', error => results.pageErrors.push(error.message))
page.on('console', message => { if (message.type() === 'error') results.consoleErrors.push(message.text()) })
page.on('response', response => { if (response.url().includes('trek.nasa.gov') && /\.png/.test(response.url()) && response.ok()) results.tileResponses++ })
const record = name => { results.checks.push(name); console.log(`PASS ${name}`) }
const screenshot = async name => { await page.screenshot({ path: path.join(output, name), fullPage: true }); results.screenshots.push(name) }
const panel = () => page.locator('.terrain-model-planner')
const setCell = async (row, column, role) => {
  await page.getByLabel('Native row (586–841)', { exact: true }).fill(String(row))
  await page.getByLabel('Native column (522–777)', { exact: true }).fill(String(column))
  const button = page.getByRole('button', { name: `Set grid ${role}`, exact: true })
  await expect(button).toBeEnabled({ timeout: 90000 }); await button.click()
}
const calculate = () => panel().getByRole('button', { name: /^(Compare DEM routes|Retry DEM route comparison)$/ }).click()
const ready = () => expect(panel().getByRole('group', { name: 'Select HRSC model route' })).toBeVisible({ timeout: 40000 })
const mode = value => page.evaluate(value => { window.__terrainQA.mode = value }, value)
const captureComparison = async label => {
  const comparison = await page.evaluate(() => {
    const value = window.__terrainQA.last.routes.value
    return { distance: value.distance, terrain: value.terrain, waypoint: value.waypoint }
  })
  for (const route of [comparison.distance, comparison.terrain]) {
    assert.equal(route.source.productId, 'HMC_13E10_DT5')
    assert.equal(route.source.authorization, 'provider-dem-model')
    assert.equal(route.scientificStatus, 'physical-terrain-unverified')
    assert.equal(route.nodes.length, route.points.length)
    assert.ok(route.nodes.length > 2)
    assert.ok(route.accumulatedCostM >= route.horizontalDistanceM)
    for (let index = 1; index < route.points.length; index++) {
      assert.ok(Math.abs(route.points[index].row - route.points[index - 1].row) <= 1)
      assert.ok(Math.abs(route.points[index].column - route.points[index - 1].column) <= 1)
    }
  }
  assert.ok(comparison.terrain.accumulatedCostM <= comparison.distance.accumulatedCostM + 1e-6)
  assert.ok(comparison.distance.horizontalDistanceM <= comparison.terrain.horizontalDistanceM + 1e-6)
  const file = `${label}-comparison.json`
  await writeFile(path.join(output, file), JSON.stringify(comparison, null, 2))
  results.comparisons.push({ label, file, distanceM: comparison.distance.horizontalDistanceM, distanceCostM: comparison.distance.accumulatedCostM, terrainDistanceM: comparison.terrain.horizontalDistanceM, terrainCostM: comparison.terrain.accumulatedCostM, sameNodes: JSON.stringify(comparison.distance.nodes) === JSON.stringify(comparison.terrain.nodes) })
  return comparison
}

try {
  await page.goto(results.url, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: 'Rotate globe left', exact: true })).toBeEnabled({ timeout: 30000 })
  await page.getByRole('button', { name: 'Rotate globe left', exact: true }).click()
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  record('Existing geographic globe navigation remains functional')
  await page.getByRole('button', { name: 'Plan', exact: true }).click()
  await page.getByRole('button', { name: 'Open planning terrain', exact: true }).click()
  await expect(page.getByText('256 × 256 native cells', { exact: false }).first()).toBeVisible({ timeout: 30000 })
  await setCell(662, 598, 'origin'); await setCell(762, 698, 'destination')
  record('Original 65,536-cell CTX terrain and hypothetical endpoint controls preserved')
  await page.route('**/data/hrsc-terrain-model.json', route => route.fulfill({ status: 503, body: 'Test-only unavailable service' }))
  await panel().getByRole('button', { name: 'Load HRSC DEM', exact: true }).click()
  await expect(panel().getByRole('alert')).toBeVisible()
  await expect(panel().getByRole('button', { name: 'Retry HRSC DEM', exact: true })).toBeEnabled()
  await page.unroute('**/data/hrsc-terrain-model.json')
  await panel().getByRole('button', { name: 'Retry HRSC DEM', exact: true }).click()
  await expect(panel().getByText('103 × 103 native cells', { exact: false })).toBeVisible({ timeout: 30000 })
  record('Real HRSC metadata/sample/mask load, HTTP failure and retry')
  await expect(panel()).toContainText('Physical traversability and human safety are not validated')
  await expect(panel()).toContainText('ESA/DLR/FU Berlin')
  await expect(panel()).toContainText('Step-height constraints and obstacle detection are unavailable')
  await expect(panel().getByRole('button', { name: 'Compare DEM routes', exact: true })).toBeEnabled()
  record('Qualified source status, source attribution and unsupported capabilities remain explicit')
  await calculate(); await ready()
  const base = await captureComparison('native-default')
  assert.equal(base.terrain.unknownSegments, 0)
  await expect(panel().locator('.terrain-route-metrics')).toContainText('Maximum / mean DEM gradient')
  await expect(page.locator('.route-qualification')).toContainText('HRSC DEM model route')
  await expect(page.locator('.app-footer')).toContainText('Calculated · qualified HRSC model')
  await expect(page.locator('.map-credit')).toContainText('ESA/DLR/FU Berlin')
  record('Actual native DEM route comparison, distinct cost/distance and exact adjacent returned cells')
  if (await page.locator('.explorer-notice').isVisible()) await page.locator('.explorer-notice').getByRole('button', { name: 'Dismiss', exact: true }).click()
  await screenshot('desktop-terrain-comparison.png')
  for (const overlay of ['elevation', 'slope', 'roughness', 'shape', 'traversability', 'explored', 'none']) {
    await panel().getByLabel('Terrain overlay', { exact: true }).selectOption(overlay)
    if (!['traversability', 'explored', 'none'].includes(overlay)) await expect(panel().locator('.terrain-raster-key')).toContainText('to')
  }
  await panel().getByLabel('Terrain overlay', { exact: true }).selectOption('traversability')
  await panel().getByRole('button', { name: /^Shortest permitted distance/ }).click()
  await expect(panel().getByRole('button', { name: /^Shortest permitted distance/ })).toHaveAttribute('aria-pressed', 'true')
  await panel().getByRole('button', { name: /^Lower terrain cost/ }).click()
  record('All terrain overlays, numeric legends and route selection work')
  const downloading = page.waitForEvent('download')
  await panel().getByRole('button', { name: 'Export DEM model report', exact: true }).click()
  const download = await downloading
  const reportPath = path.join(output, 'exported-model-report.json')
  await download.saveAs(reportPath)
  const report = JSON.parse(await readFile(reportPath, 'utf8'))
  assert.equal(report.provenance.source.productId, 'HMC_13E10_DT5')
  assert.equal(report.provenance.source.acquisitionDates, null)
  assert.ok(report.provenance.source.sourceHashDefinition.includes('not a full-TIFF checksum'))
  assert.equal(report.scientificStatus, 'physical-terrain-unverified')
  assert.ok(report.limitations.some(text => text.includes('CTX final vertical')))
  assert.deepEqual(report.routes.terrain.nodes, base.terrain.nodes)
  record('Export retains exact route, rover profile, full provenance, unknown dates and all limitations')
  await panel().getByText('Hypothetical rover assumptions', { exact: true }).click()
  await panel().getByLabel('Uphill limit (°)', { exact: true }).fill('0')
  await panel().getByRole('button', { name: 'Apply rover assumptions', exact: true }).click()
  await expect(panel()).toContainText('outside the supported hypothetical profile range')
  await panel().getByLabel('Uphill limit (°)', { exact: true }).fill('12')
  await panel().getByLabel('Roughness penalty weight', { exact: true }).fill('5')
  await panel().getByRole('button', { name: 'Apply rover assumptions', exact: true }).click()
  await expect(panel().getByRole('group', { name: 'Select HRSC model route' })).toHaveCount(0)
  await calculate(); await ready(); await captureComparison('roughness-weight-five')
  record('Invalid profile rejected; valid applied weights invalidate and recompute results')
  await page.locator('.route-planner').getByText('Optional waypoint', { exact: true }).click()
  await page.getByLabel('Waypoint row (586–841)', { exact: true }).fill('710')
  await page.getByLabel('Waypoint column (522–777)', { exact: true }).fill('650')
  await page.getByRole('button', { name: 'Set waypoint', exact: true }).click()
  await calculate(); await ready()
  const via = await captureComparison('optional-waypoint')
  assert.notEqual(via.waypoint, null)
  assert.ok(via.terrain.nodes.includes(via.waypoint)); assert.ok(via.distance.nodes.includes(via.waypoint))
  await panel().getByRole('button', { name: /^Shortest permitted distance/ }).click()
  await ready()
  record('Optional waypoint result survives rerenders and constrains both model routes')
  await mode('held'); await calculate()
  await expect(panel().getByRole('button', { name: 'Cancel DEM comparison', exact: true })).toBeVisible()
  await panel().getByRole('button', { name: 'Cancel DEM comparison', exact: true }).click()
  assert.equal(await page.evaluate(() => window.__terrainQA.active), 0)
  record('Cancellation terminates background search without stale results')
  await mode('held'); await calculate()
  await panel().getByRole('button', { name: 'Apply rover assumptions', exact: true }).click()
  await expect(panel().getByRole('button', { name: 'Cancel DEM comparison', exact: true })).toHaveCount(0)
  assert.equal(await page.evaluate(() => window.__terrainQA.active), 0)
  record('Changed applied assumptions cancel stale worker work')
  await mode('startup-failure'); await calculate()
  await expect(panel().getByRole('alert')).toContainText('could not start')
  await mode('invalid'); await calculate()
  await expect(panel().getByRole('alert')).toContainText('invalid result')
  await mode('normal'); await calculate(); await ready()
  record('Worker startup and invalid-response failures expose retry and recover')
  await page.locator('.route-planner').getByRole('button', { name: 'Calculate hypothetical routes', exact: true }).click()
  await expect(page.locator('.route-planner .route-option')).toHaveCount(2, { timeout: 30000 })
  await page.locator('.route-planner').getByRole('button', { name: 'Show paths on map', exact: true }).click()
  await expect(page.locator('.route-qualification')).toContainText('Distance-only hypothetical route')
  await panel().getByRole('button', { name: 'Show terrain on map', exact: true }).click()
  await expect(page.locator('.route-qualification')).toContainText('HRSC DEM model route')
  record('Original CTX distance routes and HRSC model routes can both be restored')
  await page.getByRole('button', { name: 'Clear waypoint', exact: true }).click()
  await setCell(586, 522, 'origin')
  await expect(panel().getByRole('button', { name: 'Compare DEM routes', exact: true })).toBeDisabled()
  await expect(panel()).toContainText('incomplete metric support')
  await panel().getByLabel('Incomplete metric support', { exact: true }).selectOption('penalize')
  await panel().getByRole('button', { name: 'Apply rover assumptions', exact: true }).click()
  await calculate(); await ready()
  const unknown = await captureComparison('explicit-unknown-support')
  assert.ok(unknown.terrain.unknownSegments > 0)
  assert.equal(unknown.terrain.maxGradeDeg, null)
  assert.equal(unknown.terrain.maxRoughnessM, null)
  await expect(panel().locator('.terrain-route-metrics')).toContainText('Unknown support')
  await panel().getByLabel('Incomplete metric support', { exact: true }).selectOption('block')
  await panel().getByRole('button', { name: 'Apply rover assumptions', exact: true }).click()
  await setCell(662, 598, 'origin')
  await calculate(); await ready()
  record('Boundary metric support blocks by default; explicit unknown policy retains unknown results')
  for (const [name, width, height] of [['tablet', 820, 1180], ['mobile', 390, 844]]) {
    await page.setViewportSize({ width, height })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name} overflow`)
    await panel().getByText('Hypothetical rover assumptions', { exact: true }).scrollIntoViewIfNeeded()
    if (!await panel().getByLabel('Uphill limit (°)').isVisible()) await panel().getByText('Hypothetical rover assumptions', { exact: true }).click()
    const boxes = await panel().locator('.terrain-profile-fields input').evaluateAll(inputs => inputs.map(input => { const box = input.getBoundingClientRect(); return { top: box.top, height: box.height, width: box.width } }))
    assert.equal(boxes.length, 10)
    assert.ok(boxes.every(box => box.height >= 44 && box.width > 30))
    for (let index = 0; index < boxes.length; index += 2) assert.ok(Math.abs(boxes[index].top - boxes[index + 1].top) < 1)
    await panel().getByLabel('Terrain overlay', { exact: true }).focus()
    await expect(panel().getByLabel('Terrain overlay', { exact: true })).toBeFocused()
    await panel().getByLabel('Terrain overlay', { exact: true }).selectOption('slope')
    await panel().getByLabel('Uphill limit (°)', { exact: true }).scrollIntoViewIfNeeded()
    await screenshot(`${name}-terrain-controls.png`)
    record(`${name} layout: no horizontal overflow, aligned readable fields, keyboard access`)
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await panel().getByLabel('Terrain overlay', { exact: true }).selectOption('traversability')
  await page.getByRole('button', { name: 'Close mission control', exact: true }).click()
  await expect(page.locator('.app-footer')).toContainText('Calculated · qualified HRSC model')
  if (await page.locator('.explorer-notice').isVisible()) await page.locator('.explorer-notice').getByRole('button', { name: 'Dismiss', exact: true }).click()
  await screenshot('desktop-map-focus.png')
  await page.getByRole('button', { name: 'Scientific validation: Partial. Open scientific details', exact: true }).click()
  await expect(page.locator('#validation-heading')).toBeFocused()
  await page.locator('#scientific-details').getByText('Capability status', { exact: true }).click()
  for (const label of ['Live CTX vertical height reference', 'Absolute feature-to-DEM registration', 'Real-Mars physical slopes', 'Physical terrain costs', 'Precise named-feature routing']) {
    const entry = page.locator('.scientific-findings > div').filter({ has: page.getByText(label, { exact: true }) })
    await expect(entry.locator('.status-label')).toHaveAttribute('data-status', 'unverified')
  }
  record('Scientific details and keyboard drawer retain all unresolved physical gates')
  assert.equal(results.pageErrors.length, 0)
  assert.ok(results.consoleErrors.every(message => message.includes('503')), 'Unexpected console error')
  assert.ok(results.tileResponses > 0, 'No actual NASA tiles loaded')
  record('No page exceptions; actual NASA imagery remains loaded')
} catch (error) {
  results.failure = error.stack
  await screenshot('failure.png').catch(() => {})
  throw error
} finally {
  results.worker = await page.evaluate(() => ({ active: window.__terrainQA.active, started: window.__terrainQA.started, terminated: window.__terrainQA.terminated })).catch(() => null)
  results.screenshotHashes = []
  for (const file of results.screenshots) results.screenshotHashes.push({ file, sha256: createHash('sha256').update(await readFile(path.join(output, file))).digest('hex') })
  await writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2))
  await context.close(); await browser.close()
}
