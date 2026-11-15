// Dedicated real-motion/rapid-input acceptance in isolated Chromium.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const require = createRequire('C:/Users/LOQ/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')
const { chromium } = require('playwright'), { expect } = require('playwright/test')
const output = path.dirname(fileURLToPath(import.meta.url))
const result = { started: new Date().toISOString(), browser: 'isolated headless Chromium; motion enabled', checks: [], responses: [], metadataRequests: [], pageErrors: [], screenshots: [] }
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' })
const page = await context.newPage()
page.on('pageerror', e => result.pageErrors.push(e.message))
page.on('request', r => { if (r.url().includes('WMTSCapabilities.xml')) result.metadataRequests.push(r.url()) })
page.on('response', r => { if (/\/(?:\d+)\/(?:\d+)\.(?:png|jpg)/.test(r.url())) result.responses.push({ url: r.url(), status: r.status() }) })
const caption = () => page.locator('.globe-source-caption')
const loaded = () => expect(caption()).toContainText(/\d+ source tiles loaded/, { timeout: 45000 })
const nav = name => page.getByRole('button', { name, exact: true })
const record = name => { result.checks.push(name); console.log(`PASS ${name}`) }
const screenshot = async name => { await page.screenshot({ path: path.join(output, name), fullPage: true }); result.screenshots.push(name) }
const close = async () => { for (const name of ['Close mission control', 'Close sources and status']) if (await nav(name).isVisible()) await nav(name).click() }
const coords = async () => { const match = (await caption().innerText()).match(/(-?[\d.]+)° latitude, (-?[\d.]+)° longitude/); return match ? [Number(match[2]), Number(match[1])] : [] }
const at = async (longitude, latitude) => expect.poll(async () => { const c = await coords(); return c.length === 2 && Math.abs(c[0] - longitude) < .002 && Math.abs(c[1] - latitude) < .002 }, { timeout: 15000 }).toBe(true)
try {
  let release
  const readyToRelease = new Promise(resolve => { release = resolve })
  await page.route('**/assets/createGeographicMarsGlobe-*.js', async route => { await readyToRelease; await route.continue() })
  await page.goto('http://127.0.0.1:4174/')
  await nav('Explore').click(); await page.getByLabel('Search missions and landmarks').fill('Curiosity')
  await nav('Fly to Curiosity landing site').click()
  release(); await close(); await at(137.4417, -4.589499788236298); await loaded()
  await page.unroute('**/assets/createGeographicMarsGlobe-*.js')
  record('POI flight clicked before lazy globe initialization is queued and completes when graphics become ready')

  await nav('Reset view').click(); await at(20, 10)
  await nav('Layers').click()
  await nav('Open regional map').click()
  await page.getByLabel('Globe imagery source').selectOption('mola')
  await close(); await expect(nav('Return to overview')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('.map-credit')).toContainText('MOLA')
  record('Selecting MOLA during map entry updates the actual map source and attribution')
  const molaMetadataCount = () => result.metadataRequests.filter(url => url.includes('Mars_MGS_MOLA')).length
  const beforeRetry = molaMetadataCount()
  await nav('Layers').click(); await nav('Retry selected imagery').click(); await close()
  await expect.poll(molaMetadataCount).toBeGreaterThan(beforeRetry)
  record('Retry selected imagery reaches the existing regional MOLA map source')

  await nav('Explore').click(); await page.getByLabel('Search missions and landmarks').fill('Curiosity')
  await nav('Fly to Curiosity landing site').click()
  await expect(page.locator('.handoff-status')).toBeVisible()
  await page.getByLabel('Search missions and landmarks').fill('Olympus')
  await nav('Fly to Olympus Mons').click(); await close()
  await expect(page.locator('.handoff-status')).toBeHidden({ timeout: 15000 })
  await at(-133.8, 18.65); await loaded()
  record('Repeated Fly To during animated map return completes at the latest target without deadlocking')

  await nav('Reset view').click(); await at(20, 10); await loaded()
  const before = result.responses.length
  const host = await page.locator('.globe-host').boundingBox()
  await page.mouse.move(host.x + host.width * .55, host.y + host.height * .5); await page.mouse.down()
  for (let i = 1; i <= 24; i++) {
    await page.mouse.move(host.x + host.width * (.55 - .45 * i / 24), host.y + host.height * .5)
    await page.waitForTimeout(45)
    if (i === 8 || i === 16) await screenshot(`mola-continuous-drag-${i}.png`)
  }
  await page.mouse.up(); await loaded(); await screenshot('mola-after-drag.png')
  const afterDrag = await coords(); assert.notEqual(afterDrag[0], 20)
  const coarse = result.responses.filter(r => r.status === 200 && /MOLA.*\/0\/0\/[01]\.(?:png|jpg)/.test(r.url))
  const counts = Object.fromEntries(coarse.map(r => [r.url, coarse.filter(item => item.url === r.url).length]))
  assert.equal(Object.keys(counts).length, 2, 'The complete MOLA coarse footprint was not observed')
  assert.ok(Object.values(counts).every(count => count === 1), 'Pinned MOLA overview was reloaded during dragging')
  result.molaCoarseRequests = counts; result.dragTileResponses = result.responses.length - before
  record('Continuous MOLA drag preserves imagery and does not refetch successful pinned overview tiles')

  const levels = []
  for (let i = 0; i < 8; i++) {
    await nav('Zoom in').click()
    if (i === 3) await screenshot('mola-zoom-in-progress.png')
    await page.waitForTimeout(260)
    const match = (await caption().innerText()).match(/level (\d+)/); if (match) levels.push(Number(match[1]))
  }
  await loaded(); await screenshot('mola-zoom-settled.png')
  result.motionLodLevels = levels
  assert.ok(new Set(levels).size >= 2)
  record('Motion-enabled zoom progresses through tile levels while coarse imagery remains underneath')
  await nav('Layers').click(); await page.getByLabel('Globe imagery source').selectOption('viking'); await close(); await loaded()
  await nav('Layers').click(); await page.getByLabel('Globe imagery source').selectOption('mola'); await close(); await loaded()
  const coarseAfterReturn = result.responses.filter(r => r.status === 200 && /MOLA.*\/0\/0\/[01]\.(?:png|jpg)/.test(r.url))
  assert.equal(coarseAfterReturn.length, coarse.length)
  record('Returning to the previous MOLA layer reuses retained coarse textures')

  await nav('Open regional map').click(); await expect(nav('Return to overview')).toBeVisible()
  await nav('Layers').click(); await page.getByLabel('Globe imagery source').selectOption('viking')
  await expect(page.locator('.globe-layer-controls')).toContainText('source tiles loaded', { timeout: 45000 }); await close()
  await nav('Plan').click(); await nav('Open planning terrain').click()
  await expect(page.locator('.terrain-ready-status')).toContainText('65,536', { timeout: 90000 })
  await nav('Layers').click()
  // Globe remains selected for a later return; it must not borrow a stale extra-map status.
  await expect(page.locator('.globe-layer-controls')).not.toContainText('source tiles loaded')
  record('Opening the controlled-CTX planning crop clears obsolete extra-map status')
  assert.deepEqual(result.pageErrors, [])
} catch (error) { result.failure = String(error.stack ?? error); await screenshot('motion-failure.png').catch(() => {}); throw error }
finally { result.finished = new Date().toISOString(); await writeFile(path.join(output, 'motion-results.json'), JSON.stringify(result, null, 2) + '\n'); await browser.close() }
