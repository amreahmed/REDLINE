// Fresh isolated Chromium; no personal browser profile, device UI or security bypass.
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
const results = { url: process.env.REDLINE_QA_URL ?? 'http://127.0.0.1:4174/', browser: 'fresh isolated headless Chromium', timezone: 'Africa/Cairo', checks: [], pageErrors: [], consoleErrors: [], tileResponses: 0, screenshots: [], exports: [] }
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', timezoneId: results.timezone })
await context.addInitScript(() => {
  const NativeWorker = window.Worker
  window.__etaQA = { started: 0 }
  window.Worker = class extends NativeWorker {
    constructor(url, options) {
      super(url, options)
      if (String(url).includes('terrainRouteWorker')) window.__etaQA.started++
    }
  }
})
const page = await context.newPage()
page.on('pageerror', error => results.pageErrors.push(error.message))
page.on('console', message => { if (message.type() === 'error') results.consoleErrors.push(message.text()) })
page.on('response', response => { if (response.url().includes('trek.nasa.gov') && /\.(png|jpg)/.test(response.url()) && response.ok()) results.tileResponses++ })
const record = name => { results.checks.push(name); console.log(`PASS ${name}`) }
const screenshot = async name => { await page.screenshot({ path: path.join(output, name), fullPage: true }); results.screenshots.push(name) }
const terrain = () => page.locator('.terrain-model-planner')
const travel = () => page.locator('.travel-time-panel')
const setCell = async (row, column, role) => {
  await page.getByLabel('Native row (586–841)', { exact: true }).fill(String(row))
  await page.getByLabel('Native column (522–777)', { exact: true }).fill(String(column))
  const button = page.getByRole('button', { name: `Set grid ${role}`, exact: true })
  await expect(button).toBeEnabled({ timeout: 90000 }); await button.click()
}
const calculate = async () => {
  await terrain().getByRole('button', { name: /^(Compare DEM routes|Retry DEM route comparison)$/ }).click()
  await expect(travel().locator('.travel-result')).toBeVisible({ timeout: 40000 })
}
const apply = async () => {
  await travel().getByRole('button', { name: 'Apply travel assumptions', exact: true }).click()
  await expect(travel()).toContainText('Current travel assumptions are applied.')
}
const workers = () => page.evaluate(() => window.__etaQA.started)
const exported = async name => {
  const downloading = page.waitForEvent('download')
  await terrain().getByRole('button', { name: 'Export DEM model report', exact: true }).click()
  const download = await downloading
  const file = `${name}.json`
  await download.saveAs(path.join(output, file))
  results.exports.push(file)
  return JSON.parse(await readFile(path.join(output, file), 'utf8'))
}
const available = (report, role = 'terrain') => {
  assert.equal(report.travelTime.estimates[role].status, 'available')
  return report.travelTime.estimates[role].value
}
const verify = (report, role) => {
  const eta = available(report, role), route = report.routes[role]
  assert.equal(eta.scientificStatus, 'provisional')
  assert.equal(eta.source.productId, 'HMC_13E10_DT5')
  assert.equal(eta.source.authorization, 'provider-dem-model')
  assert.deepEqual(eta.nodes, route.nodes)
  assert.equal(eta.segments.length, route.nodes.length - 1)
  assert.deepEqual(eta.terrainProfile, report.profile)
  let distance = 0, seconds = 0
  for (const [index, segment] of eta.segments.entries()) {
    assert.deepEqual(segment.from, route.points[index]); assert.deepEqual(segment.to, route.points[index + 1])
    assert.notEqual(segment.classification, 'BLOCKED')
    assert.ok(segment.effectiveSpeedMps >= eta.profile.minSpeedMps && segment.effectiveSpeedMps <= eta.profile.maxSpeedMps)
    distance += segment.distanceM; seconds += segment.distanceM / segment.effectiveSpeedMps
  }
  assert.ok(Math.abs(distance - route.horizontalDistanceM) < 1e-7)
  assert.ok(Math.abs(seconds - eta.travelDurationSeconds) < 1e-7)
  assert.ok(Math.abs(eta.averageSpeedMps - distance / seconds) < 1e-12)
  assert.equal(eta.totalDurationSeconds, eta.travelDurationSeconds + eta.plannedDelaySeconds)
  assert.ok(eta.durationRangeSeconds.lower <= eta.totalDurationSeconds && eta.durationRangeSeconds.upper >= eta.totalDurationSeconds)
  assert.equal(report.travelTime.measuredRoverPerformance, null)
  assert.equal(report.travelTime.humanExplorationModel, null)
  assert.equal(report.travelTime.environmentalDelaySecondsApplied, 0)
  assert.ok(report.travelTime.scenarioModel.includes('not statistical confidence intervals'))
  return eta
}

try {
  await page.goto(results.url, { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: 'Rotate globe left', exact: true })).toBeEnabled({ timeout: 30000 })
  await page.getByRole('button', { name: 'Rotate globe left', exact: true }).click()
  await page.getByRole('button', { name: 'Reset view', exact: true }).click()
  record('Existing geographic globe navigation works')
  await page.getByRole('button', { name: 'Plan', exact: true }).click()
  await page.getByRole('button', { name: 'Open planning terrain', exact: true }).click()
  await expect(page.getByText('256 × 256 native cells', { exact: false }).first()).toBeVisible({ timeout: 30000 })
  await setCell(662, 598, 'origin'); await setCell(762, 698, 'destination')
  await expect(page.locator('.route-planner')).toContainText('Terrain-dependent ETA unavailable')
  record('Original 65,536 CTX cells and endpoints preserved; CTX ETA unavailable')
  await page.route('**/data/hrsc-terrain-model.json', route => route.fulfill({ status: 503, body: 'Test-only unavailable service' }))
  await terrain().getByRole('button', { name: 'Load HRSC DEM', exact: true }).click()
  await expect(terrain().getByRole('alert')).toBeVisible()
  await expect(travel()).toHaveCount(0)
  await page.unroute('**/data/hrsc-terrain-model.json')
  await terrain().getByRole('button', { name: 'Retry HRSC DEM', exact: true }).click()
  await expect(travel()).toBeVisible({ timeout: 30000 })
  await expect(travel()).toContainText('Calculate an HRSC route')
  await expect(travel().locator('.travel-arrival')).toHaveCount(0)
  record('Unavailable source cannot show ETA; retry restores empty configuration')
  await calculate()
  const base = await exported('survey-baseline')
  const baseEta = verify(base, 'terrain'); verify(base, 'distance')
  await expect(travel()).toContainText('Provisional ETA')
  await expect(travel()).toContainText('Hypothetical survey vehicle')
  await expect(travel()).toContainText('human safety are not validated')
  assert.ok(baseEta.terrainPenaltySeconds > 0)
  assert.ok(baseEta.minSegmentSpeedMps < baseEta.maxSegmentSpeedMps)
  assert.equal(baseEta.departureUtc, null)
  record('Both actual HRSC paths have provisional terrain-dependent segment ETA and variable speeds')
  if (await page.locator('.explorer-notice').isVisible()) await page.locator('.explorer-notice').getByRole('button', { name: 'Dismiss', exact: true }).click()
  await page.locator('#travel-time-heading').evaluate(element => element.scrollIntoView({ block: 'start' })); await screenshot('desktop-eta.png')
  await terrain().getByRole('button', { name: /^Shortest permitted distance/ }).click()
  await expect(travel().locator('.travel-result')).toContainText('Shortest permitted distance route')
  await terrain().getByRole('button', { name: /^Lower terrain cost/ }).click()
  await expect(travel().locator('.travel-result')).toContainText('Lower terrain cost route')
  record('Route selection updates the displayed ETA for its exact path')
  const initialWorkers = await workers()
  await travel().getByLabel('Hypothetical vehicle profile', { exact: true }).selectOption('hypothetical-transit')
  await expect(travel()).toContainText('Draft changes are ready')
  await expect(travel().locator('.travel-applied-profile')).toContainText('Hypothetical survey vehicle')
  await apply()
  const transit = await exported('transit-profile'), transitEta = verify(transit, 'terrain')
  verify(transit, 'distance')
  assert.ok(transitEta.travelDurationSeconds < baseEta.travelDurationSeconds)
  assert.deepEqual(transit.routes, base.routes)
  assert.equal(await workers(), initialWorkers)
  record('Applying mobility profile changes both ETAs without A* work or geometry changes')
  await travel().getByLabel('Departure time (Earth UTC)', { exact: true }).fill('2026-11-15T08:30')
  await apply()
  const departure = await exported('departure-utc'), departureEta = verify(departure, 'terrain')
  assert.equal(departureEta.departureUtc, '2026-11-15T08:30:00.000Z')
  assert.ok(Math.abs(Date.parse(departureEta.arrivalUtc) - Date.parse(departureEta.departureUtc) - departureEta.totalDurationSeconds * 1000) < 1)
  assert.equal(departureEta.travelDurationSeconds, transitEta.travelDurationSeconds)
  await expect(travel().locator('.travel-arrival')).toContainText('UTC')
  await travel().getByLabel('Planned hold (minutes)', { exact: true }).fill('30')
  await apply()
  const hold = await exported('explicit-hold'), holdEta = verify(hold, 'terrain')
  assert.equal(holdEta.totalDurationSeconds, departureEta.totalDurationSeconds + 1800)
  assert.equal(holdEta.averageSpeedMps, departureEta.averageSpeedMps)
  assert.equal(Date.parse(holdEta.arrivalUtc) - Date.parse(departureEta.arrivalUtc), 1800000)
  assert.equal(await workers(), initialWorkers)
  await page.locator('#travel-time-heading').evaluate(element => element.scrollIntoView({ block: 'start' })); await screenshot('desktop-eta-arrival.png')
  record('Earth UTC arrival ignores browser timezone; explicit hold changes arrival, not movement speed')
  await travel().getByText('Edit hypothetical speed assumptions', { exact: true }).click()
  await travel().getByLabel('Nominal speed (m/s)', { exact: true }).fill('0')
  await expect(travel().getByRole('button', { name: 'Apply travel assumptions', exact: true })).toBeDisabled()
  await expect(travel()).toContainText('Draft not applied')
  await expect(travel().locator('.travel-arrival')).toBeVisible()
  await travel().getByLabel('Nominal speed (m/s)', { exact: true }).fill('0.3')
  await travel().getByLabel('Speed scenario sensitivity (%)', { exact: true }).fill('100')
  await expect(travel().getByRole('button', { name: 'Apply travel assumptions', exact: true })).toBeDisabled()
  await travel().getByLabel('Speed scenario sensitivity (%)', { exact: true }).fill('40')
  await travel().getByLabel('Planned hold (minutes)', { exact: true }).fill('-1')
  await expect(travel().getByRole('button', { name: 'Apply travel assumptions', exact: true })).toBeDisabled()
  await travel().getByLabel('Planned hold (minutes)', { exact: true }).fill('30')
  await travel().getByLabel('Roughness slowdown factor', { exact: true }).fill('20')
  await apply()
  const custom = await exported('custom-assumptions'), customEta = verify(custom, 'terrain')
  assert.equal(customEta.profile.id, 'hypothetical-custom')
  assert.ok(customEta.travelDurationSeconds > holdEta.travelDurationSeconds)
  assert.deepEqual(custom.routes, base.routes)
  assert.equal(await workers(), initialWorkers)
  record('Invalid drafts fail closed; custom roughness and speed scenarios recalculate existing paths')
  await travel().getByText(/^Route segment timeline \(/).click()
  await expect(travel().getByRole('list', { name: 'Actual route segment timeline' }).locator('li')).toHaveCount(10)
  await expect(travel().getByRole('button', { name: 'Previous route segments' })).toBeDisabled()
  await travel().getByRole('button', { name: 'Next route segments' }).click()
  await expect(travel()).toContainText('Segment 11')
  await expect(travel()).toContainText(`Cell ${customEta.segments[10].from.row}, ${customEta.segments[10].from.column}`)
  await travel().getByRole('list', { name: 'Actual route segment timeline' }).locator('li').first().evaluate(element => element.scrollIntoView({ block: 'start' })); await screenshot('desktop-segment-timeline.png')
  await travel().getByRole('button', { name: 'Previous route segments' }).click()
  await expect(travel().getByRole('list', { name: 'Actual route segment timeline' })).toContainText('Segment 1')
  await terrain().getByRole('button', { name: /^Shortest permitted distance/ }).click()
  await expect(travel().getByRole('list', { name: 'Actual route segment timeline' }).locator('li').first()).toContainText('Segment 1')
  record('Timeline pages exact native movements and resets on route selection')
  await travel().getByText('Timing, speed & route limits', { exact: true }).click()
  await expect(travel()).toContainText('Most time-consuming segment')
  await expect(travel()).toContainText('Average speed excludes the planned hold')
  await travel().getByText('ETA model & scientific limitations', { exact: true }).click()
  await expect(travel()).toContainText('not an empirical confidence interval')
  await expect(travel()).toContainText('HMC_13E10_DT5')
  await expect(travel()).toContainText('ESA/DLR/FU Berlin')
  record('Timing breakdown, inherited route limits, scenarios, source and limitations remain accessible')
  await setCell(702, 638, 'origin')
  await expect(travel().locator('.travel-result')).toHaveCount(0)
  await expect(travel().locator('.travel-arrival')).toHaveCount(0)
  const pending = await exported('changed-endpoint-pending')
  assert.equal(pending.routes, null); assert.equal(pending.travelTime.estimates, null)
  await calculate()
  const changed = await exported('changed-endpoint'), changedEta = verify(changed, 'terrain')
  assert.notDeepEqual(changedEta.nodes, customEta.nodes)
  assert.notEqual(changedEta.travelDurationSeconds, customEta.travelDurationSeconds)
  assert.ok(await workers() > initialWorkers)
  record('Endpoint changes clear stale ETA and arrival; new route generates a new exact estimate')
  await terrain().getByText('Hypothetical rover assumptions', { exact: true }).click()
  await setCell(586, 522, 'origin')
  await expect(terrain().getByRole('button', { name: 'Compare DEM routes', exact: true })).toBeDisabled()
  await expect(travel().locator('.travel-result')).toHaveCount(0)
  await terrain().getByLabel('Incomplete metric support', { exact: true }).selectOption('penalize')
  await terrain().getByRole('button', { name: 'Apply rover assumptions', exact: true }).click()
  await calculate()
  const unknown = await exported('explicit-unknown-support'), unknownEta = verify(unknown, 'terrain')
  assert.ok(unknownEta.unknownSegments > 0)
  for (const segment of unknownEta.segments.filter(value => value.classification === 'UNKNOWN')) {
    assert.equal(segment.gradeDeg, null); assert.equal(segment.gradientDeg, null); assert.equal(segment.roughnessM, null)
    assert.equal(segment.effectiveSpeedMps, unknownEta.profile.unknownSpeedMps)
  }
  await expect(travel()).toContainText('unknown-support segments use the assumed')
  record('Unknown support blocks by default; explicit policy preserves null metrics and assumed speed')
  await terrain().getByLabel('Incomplete metric support', { exact: true }).selectOption('block')
  await terrain().getByRole('button', { name: 'Apply rover assumptions', exact: true }).click()
  await setCell(662, 598, 'origin'); await calculate()
  for (const [name, width, height] of [['tablet', 820, 1180], ['mobile', 390, 844], ['narrow-mobile', 320, 740]]) {
    await page.setViewportSize({ width, height })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name} document overflow`)
    assert.ok(await travel().evaluate(element => element.scrollWidth <= element.clientWidth + 1), `${name} panel overflow`)
    const input = travel().getByLabel('Departure time (Earth UTC)', { exact: true })
    await input.scrollIntoViewIfNeeded(); await input.focus(); await expect(input).toBeFocused()
    const boxes = await travel().locator('.travel-config-fields input, .travel-assumption-fields input').evaluateAll(inputs => inputs.map(input => { const box = input.getBoundingClientRect(); return { top: box.top, height: box.height, width: box.width } }))
    assert.equal(boxes.length, 12)
    assert.ok(boxes.every(box => box.height >= 44 && box.width > 30))
    for (let index = 2; index < boxes.length; index += 2) assert.ok(Math.abs(boxes[index].top - boxes[index + 1].top) < 1, `${name} field alignment`)
    // Chromium's native datetime control tabs through its calendar subfields first.
    for (let attempt = 0; attempt < 12 && !await travel().getByLabel('Planned hold (minutes)', { exact: true }).evaluate(element => element === document.activeElement); attempt++) await page.keyboard.press('Tab')
    await expect(travel().getByLabel('Planned hold (minutes)', { exact: true })).toBeFocused()
    await travel().getByLabel('Hypothetical vehicle profile', { exact: true }).focus()
    await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowDown')
    await page.locator('#travel-time-heading').evaluate(element => element.scrollIntoView({ block: 'start' })); await screenshot(`${name}-eta.png`)
    await input.evaluate(element => element.parentElement.scrollIntoView({ block: 'start' })); await screenshot(`${name}-travel-configuration.png`)
    record(`${name}: readable aligned fields, no overflow and keyboard configuration access`)
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await travel().getByLabel('Hypothetical vehicle profile', { exact: true }).selectOption('hypothetical-survey')
  await travel().getByLabel('Departure time (Earth UTC)', { exact: true }).fill('')
  await travel().getByLabel('Planned hold (minutes)', { exact: true }).fill('0'); await apply()
  await expect(travel().locator('.travel-arrival')).toHaveCount(0)
  record('Clearing departure removes arrival while retaining route duration')
  await page.locator('.route-planner').getByRole('button', { name: 'Calculate hypothetical routes', exact: true }).click()
  // Without an optional waypoint, the existing CTX workflow exposes its single direct grid path.
  await expect(page.locator('.route-planner .route-option')).toHaveCount(1, { timeout: 30000 })
  await page.locator('.route-planner').getByRole('button', { name: 'Show paths on map', exact: true }).click()
  await expect(page.locator('.route-qualification')).toContainText('Distance-only hypothetical route')
  await expect(page.locator('.route-planner')).toContainText('Terrain-dependent ETA unavailable')
  await terrain().getByRole('button', { name: 'Show terrain on map', exact: true }).click()
  await expect(page.locator('.route-qualification')).toContainText('HRSC DEM model route')
  record('Both map workflows remain functional; CTX never borrows HRSC ETA')
  await page.getByRole('button', { name: 'Close mission control', exact: true }).click()
  await page.getByRole('button', { name: 'Scientific validation: Partial. Open scientific details', exact: true }).click()
  await expect(page.locator('#validation-heading')).toBeFocused()
  await page.locator('#scientific-details').getByText('Capability status', { exact: true }).click()
  for (const label of ['Live CTX vertical height reference', 'Absolute feature-to-DEM registration', 'Real-Mars physical slopes', 'Physical terrain costs', 'Precise named-feature routing']) {
    const entry = page.locator('.scientific-findings > div').filter({ has: page.getByText(label, { exact: true }) })
    await expect(entry.locator('.status-label')).toHaveAttribute('data-status', 'unverified')
  }
  record('Scientific Partial status and all unresolved physical gates preserved')
  assert.equal(results.pageErrors.length, 0)
  assert.ok(results.consoleErrors.every(message => message.includes('503')), 'Unexpected console error')
  assert.ok(results.tileResponses > 0, 'No real NASA imagery responses')
  record('No page exceptions; real NASA imagery loaded; only expected injected 503 console error')
} catch (error) {
  results.failure = error.stack
  await screenshot('failure.png').catch(() => {})
  throw error
} finally {
  results.terrainWorkersStarted = await workers().catch(() => null)
  results.screenshotHashes = []
  for (const file of results.screenshots) results.screenshotHashes.push({ file, sha256: createHash('sha256').update(await readFile(path.join(output, file))).digest('hex') })
  await writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2))
  await context.close(); await browser.close()
}
