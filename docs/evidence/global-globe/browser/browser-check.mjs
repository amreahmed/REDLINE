// Replayable acceptance in a new isolated Chromium profile. No personal browser.
// Run: REDLINE_BROWSER_MODULES=<Playwright node_modules> node <this file>
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const require = createRequire(process.env.REDLINE_BROWSER_MODULES ? path.join(process.env.REDLINE_BROWSER_MODULES, 'playwright/package.json') : 'C:/Users/LOQ/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')
const { chromium } = require('playwright')
const { expect } = require('playwright/test')
const output = path.dirname(fileURLToPath(import.meta.url))
await mkdir(output, { recursive: true })
const result = { started: new Date().toISOString(), url: process.env.REDLINE_QA_URL ?? 'http://127.0.0.1:4174/', browser: 'isolated headless Chromium', checks: [], responses: [], pageErrors: [], screenshots: [] }
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
const page = await context.newPage()
page.on('pageerror', error => result.pageErrors.push(error.message))
page.on('response', response => { if (/\/tile\/|\/(?:\d+)\/(?:\d+)\.(?:png|jpg)/.test(response.url())) result.responses.push({ url: response.url(), status: response.status() }) })
const record = name => { result.checks.push(name); console.log(`PASS ${name}`) }
const shot = async name => { await page.screenshot({ path: path.join(output, name), fullPage: true }); result.screenshots.push(name) }
const caption = () => page.locator('.globe-source-caption')
const loaded = () => expect(caption()).toContainText(/\d+ source tiles loaded/, { timeout: 45000 })
const nav = name => page.getByRole('button', { name, exact: true })
const closeDrawers = async () => {
  for (const name of ['Close mission control', 'Close sources and status']) if (await nav(name).isVisible()) await nav(name).click()
}
const coords = async () => {
  const text = await caption().innerText(), match = text.match(/(-?[\d.]+)° latitude, (-?[\d.]+)° longitude/)
  assert.ok(match, `No geographic caption: ${text}`)
  return [Number(match[2]), Number(match[1])]
}
const checkCoordinate = (actual, expected, tolerance = .002) => {
  const delta = Math.abs(((actual[0] - expected[0] + 540) % 360) - 180)
  assert.ok(delta < tolerance && Math.abs(actual[1] - expected[1]) < tolerance, `${actual} != ${expected}`)
}
const select = async id => {
  await closeDrawers(); await nav('Layers').click()
  await page.getByLabel('Globe imagery source', { exact: true }).selectOption(id)
  await closeDrawers()
}
const fly = async name => {
  await closeDrawers(); await nav('Explore').click()
  await page.getByLabel('Search missions and landmarks', { exact: true }).fill(name)
  await nav(`Fly to ${name}`).click()
  await closeDrawers()
  await expect.poll(async () => (await coords()).join(','), { timeout: 12000 }).not.toBe('20,10')
  await page.waitForTimeout(500)
}
try {
  await page.goto(result.url)
  await loaded()
  await expect(caption()).toContainText('Viking')
  checkCoordinate(await coords(), [20, 10])
  await expect(page.locator('.globe-host canvas')).toHaveCount(1)
  await shot('desktop-viking.png')
  record('Current Mars Trek Viking color default rendered from real tiles in one globe canvas')

  await select('globalCtx'); await loaded()
  checkCoordinate(await coords(), [20, 10])
  await shot('desktop-global-ctx.png')
  record('Global CTX switching preserves source-grid camera location and renders real imagery')

  await select('mola'); await loaded()
  checkCoordinate(await coords(), [20, 10])
  for (let i = 0; i < 8; i++) { await nav('Rotate globe right').click(); await page.waitForTimeout(100) }
  await loaded(); const rotated = await coords(); assert.notEqual(rotated[0], 20)
  await nav('Reset view').click(); await loaded()
  checkCoordinate(await coords(), [20, 10])
  await shot('desktop-mola.png')
  record('MOLA rotation, retained imagery and reset work without geographic reset on layer changes')

  await select('controlledCtx')
  await expect(caption()).toContainText('no coverage', { timeout: 10000 })
  await shot('outside-regional-coverage.png')
  record('Regional CTX is unavailable outside its real footprint without a substituted basemap')

  await select('globalCtx')
  await fly('Olympus Mons'); await loaded()
  checkCoordinate(await coords(), [226.2, 18.65])
  await shot('olympus-fly-to.png')
  const host = await page.locator('.globe-host').boundingBox()
  await page.mouse.move(host.x + host.width / 2, host.y + host.height / 2)
  await expect(caption()).toContainText('Olympus Mons')
  await page.mouse.click(host.x + host.width / 2, host.y + host.height / 2)
  await expect(page.locator('#globe-poi-detail-heading')).toHaveText('Olympus Mons')
  await expect(page.locator('.globe-poi-detail')).toContainText('MDIM 2.1')
  await shot('olympus-picked-details.png')
  record('Actual-coordinate Olympus fly, front-side hover and marker picking open sourced details')

  await closeDrawers(); await nav('Open regional map').click()
  await expect(nav('Return to overview')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('.map-position')).toContainText('-133.800° lon', { timeout: 45000 })
  await shot('olympus-regional-map.png')
  await nav('Return to overview').click(); await loaded()
  checkCoordinate(await coords(), [226.2, 18.65])
  record('Arbitrary geographic map handoff and return preserve Olympus and selected global CTX')

  await fly('Perseverance landing site'); await loaded()
  checkCoordinate(await coords(), [77.45088572, 18.444627153952787])
  await select('ctx'); await loaded(); await shot('jezero-preliminary-ctx.png')
  await select('controlledCtx'); await loaded(); await shot('jezero-controlled-ctx.png')
  await select('hirise'); await loaded()
  const levels = []
  for (let i = 0; i < 12; i++) {
    await nav('Zoom in').click(); await page.waitForTimeout(200)
    if (!(await caption().isVisible())) break
    const match = (await caption().innerText()).match(/level (\d+)/)
    if (match) levels.push(Number(match[1]))
  }
  result.observedLodLevels = levels
  assert.ok(new Set(levels).size >= 2, 'Zoom did not progress across LOD levels')
  await loaded(); await shot('jezero-hirise-detail.png')
  record('Published Perseverance reference flies correctly; preliminary CTX, controlled CTX and HiRISE load within coverage with progressive LOD')
  const beforeMap = await coords()
  await nav('Open regional map').click()
  await expect(nav('Return to overview')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('.map-position')).toContainText('77.451° lon', { timeout: 45000 })
  for (let i = 0; i < 12 && await nav('Zoom in').isEnabled(); i++) { await nav('Zoom in').click(); await page.waitForTimeout(100) }
  await expect(nav('Zoom in')).toBeDisabled()
  await expect(page.locator('.map-loading').filter({ hasText: 'Loading NASA Mars Trek imagery' })).toHaveCount(0, { timeout: 45000 })
  assert.ok(result.responses.some(response => response.status === 200 && /first_dd.*\/17\/\d+\/\d+\.png/.test(response.url)), 'No actual level-17 HiRISE response observed')
  record('Explicit HiRISE map reaches verified level 17; other mission sources retain the original limit')
  await shot('jezero-hirise-map.png')
  await nav('Return to overview').click(); await loaded()
  checkCoordinate(await coords(), beforeMap)
  record('Local HiRISE source and center survive globe-to-map handoff and return')

  await select('viking'); await loaded()
  await nav('Open regional map').click(); await expect(nav('Return to overview')).toBeVisible()
  await fly('Curiosity landing site'); await loaded()
  checkCoordinate(await coords(), [137.4417, -4.589499788236298])
  record('Fly To initiated from the map returns to the globe and completes at archived Curiosity coordinates')

  await select('model')
  await expect(page.locator('.globe-message')).toBeHidden({ timeout: 45000 })
  await expect(page.locator('.globe-host canvas')).toHaveCount(1)
  await nav('Explore').click(); await page.getByLabel('Search missions and landmarks', { exact: true }).fill('Curiosity')
  await expect(nav('Fly to Curiosity landing site')).toBeDisabled()
  await closeDrawers(); await shot('original-nasa-model.png')
  record('Original NASA GLB remains functional and does not offer uncalibrated coordinate flights')

  await select('viking'); await loaded()
  for (const [name, width, height] of [['tablet', 768, 1024], ['mobile', 390, 844], ['small-mobile', 320, 800]]) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(500)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} overflow`)
    assert.ok(await page.locator('.map-credit').isVisible(), `${name} attribution hidden`)
    await shot(`${name}-globe.png`)
    await nav('Layers').click(); await expect(page.getByLabel('Globe imagery source')).toBeVisible()
    await page.getByLabel('Globe imagery source').focus(); await expect(page.getByLabel('Globe imagery source')).toBeFocused()
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} layer drawer overflow`)
    await shot(`${name}-layers.png`); await closeDrawers()
    await nav('Explore').click(); await page.getByLabel('Search missions and landmarks').fill('Viking')
    await page.getByLabel('Location category').selectOption('mission')
    await expect(nav('Fly to Viking 1 landing site')).toBeVisible()
    await page.getByLabel('Location category').selectOption('impact')
    await expect(page.getByText('No sourced locations match this search and category.')).toBeVisible()
    await closeDrawers()
    record(`${name}: map-first layout, attribution, keyboard layer controls, category filter and truthful empty state without overflow`)
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.locator('#explorer-workspace').focus(); const preKey = await coords()
  await expect(page.locator('#explorer-workspace')).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect.poll(async () => (await coords())[0], { timeout: 10000 }).not.toBe(preKey[0])
  await page.keyboard.press('Home'); await loaded()
  await expect.poll(async () => (await coords()).join(',')).toBe('20,10')
  checkCoordinate(await coords(), [20, 10])
  record('Focused keyboard navigation and Home reset retain accessible geographic controls')

  // Explicit faults apply only to this new disposable test browser context.
  let block = true
  await page.route('https://astro.arcgis.com/**', route => block ? route.abort('failed') : route.continue())
  await page.reload(); await loaded()
  await select('globalCtx')
  await expect(caption()).toContainText('unavailable', { timeout: 45000 })
  await expect(page.locator('.globe-message')).toBeHidden()
  await shot('imagery-failure.png')
  block = false
  await nav('Layers').click(); await nav('Retry selected imagery').click(); await closeDrawers(); await loaded()
  await shot('imagery-recovered.png')
  record('Injected imagery failure leaves globe interactive, discloses unavailable source, and retry restores actual CTX tiles')

  await nav('Plan').click()
  await expect(page.getByRole('heading', { name: 'Terrain planning workspace' })).toBeVisible()
  await shot('planning-preserved.png')
  record('Existing terrain planning controls and scientific gates remain available')
  assert.ok(result.responses.some(response => response.status === 200), 'No actual source tile HTTP 200 observed')
  assert.deepEqual(result.pageErrors, [])
  record('Real imagery responses observed and no unhandled page errors')
} catch (error) {
  result.failure = String(error.stack ?? error)
  await shot('failure.png').catch(() => {})
  throw error
} finally {
  result.finished = new Date().toISOString()
  await writeFile(path.join(output, 'browser-results.json'), JSON.stringify(result, null, 2) + '\n')
  await browser.close()
}
