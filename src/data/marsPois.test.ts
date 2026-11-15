import { describe, expect, it } from 'vitest'
import { MARS_POIS, marsPoiById } from './marsPois'
import { SCIENCE_TARGETS } from './scienceTargets'
import kernelInspection from '../../docs/evidence/global-globe/pois/landing-kernel-inspection.json'
import gazetteerInspection from '../../docs/evidence/global-globe/pois/gazetteer-inspection.json'
import priorLanding from '../../docs/evidence/scientific-resolution-2026-11-14/registration/spice-control-candidates.json'
import olympusHtml from '../../docs/evidence/global-globe/pois/olympus.html?raw'
import vallesHtml from '../../docs/evidence/global-globe/pois/valles-marineris.html?raw'
import elysiumHtml from '../../docs/evidence/global-globe/pois/elysium-mons.html?raw'
import galeHtml from '../../docs/evidence/global-globe/pois/gale.html?raw'
import jezeroHtml from '../../docs/evidence/global-globe/pois/jezero.html?raw'
import hellasHtml from '../../docs/evidence/global-globe/pois/hellas.html?raw'
import belvaHtml from '../../docs/evidence/phase-3-targets/belva-gazetteer.html?raw'
import neretvaHtml from '../../docs/evidence/phase-3-targets/neretva-gazetteer.html?raw'
import vikingHtml from '../../docs/evidence/global-globe/pois/viking-mission.html?raw'
import merCatalog from '../../docs/evidence/global-globe/pois/mer-catalog.cat?raw'
import coordinateGuidance from '../../docs/evidence/global-globe/pois/coordinate-guidance.html?raw'
import curiosityComments from '../../docs/evidence/global-globe/pois/curiosity-kernel-comments.txt?raw'
import insightComments from '../../docs/evidence/global-globe/pois/insight-kernel-comments.txt?raw'
import perseveranceComments from '../../docs/evidence/global-globe/pois/perseverance-kernel-comments.txt?raw'
import curiosityMission from '../../docs/evidence/global-globe/pois/curiosity-mission.html?raw'
import perseveranceMission from '../../docs/evidence/global-globe/pois/perseverance-mission.html?raw'
import insightMission from '../../docs/evidence/global-globe/pois/insight-mission.html?raw'
import localReceipts from '../../docs/evidence/global-globe/pois/source-http.json'
import targetReceipts from '../../docs/evidence/phase-3-targets/source-http.json'
import additionalTargetReceipts from '../../docs/evidence/phase-3-targets/additional-source-http.json'
import priorKernelReceipts from '../../docs/evidence/scientific-resolution-2026-11-14/registration/http-receipts.json'

const clean = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&(?:nbsp|deg);/g, ' ').replace(/\s+/g, ' ').trim()
const gazetteerFixtures: Record<string, string> = {
  olympus: olympusHtml, 'valles-marineris': vallesHtml, 'elysium-mons': elysiumHtml,
  gale: galeHtml, jezero: jezeroHtml, hellas: hellasHtml, belva: belvaHtml, neretva: neretvaHtml,
}

describe('source-backed global Mars exploration POIs', () => {
  it('has distinct lookup identities and excludes unsupported landing/debris guesses', () => {
    expect(MARS_POIS).toHaveLength(15)
    expect(new Set(MARS_POIS.map(poi => poi.id)).size).toBe(MARS_POIS.length)
    expect(MARS_POIS.filter(poi => poi.category === 'mission')).toHaveLength(7)
    expect(MARS_POIS.filter(poi => poi.category === 'impact')).toHaveLength(0)
    expect(marsPoiById('sojourner')).toBeUndefined()
    expect(marsPoiById('pathfinder')).toBeUndefined()
    expect(marsPoiById(null)).toBeUndefined()
    expect(marsPoiById('unknown')).toBeUndefined()
    for (const poi of MARS_POIS) expect(marsPoiById(poi.id)).toBe(poi)
  })

  it.each(Object.keys(gazetteerFixtures))('%s preserves the selected Gazetteer MDIM 2.1 planetocentric center', id => {
    const html = gazetteerFixtures[id]!
    const poi = marsPoiById(id)!
    const network = html.match(/<option label="MDIM 2.1" value="(\d+)"\s+selected/)
      ?? html.match(/<input id="selected_control_net"[^>]*value="(\d+)"[^>]*>\s*MDIM 2.1/)
    expect(network, 'active MDIM 2.1 network must be explicit').not.toBeNull()
    expect(html).toContain('Planetocentric, +East, 0 - 360')
    const rows = [...html.matchAll(new RegExp(`<tr class="geometry geom-${network![1]} cs-6">([\\s\\S]*?)<\\/tr>`, 'g'))]
      .map(match => clean(match[1]!))
    const latitudeRow = rows.find(row => row.startsWith('Center Latitude '))!
    const longitudeRow = rows.find(row => row.startsWith('Center Longitude '))!
    expect(poi.latitude).toBe(Number(latitudeRow.replace('Center Latitude ', '')))
    expect(poi.longitude).toBe(Number(longitudeRow.replace('Center Longitude ', '')))
    const inspected = gazetteerInspection.find(entry => entry.id === id)
    if (inspected) {
      expect([poi.longitude, poi.latitude]).toEqual([inspected.longitude, inspected.latitude])
      expect(poi.sourceUrl).toBe(`https://planetarynames.wr.usgs.gov/Feature/${inspected.featureId}`)
    }
    expect(poi.coordinateAccuracy).toContain('Approximate published feature center')
  })

  it.each(kernelInspection)('$id uses planetocentric latitude from the actual archived XYZ vector', reference => {
    const poi = marsPoiById(reference.id)!
    const [x, y, z] = reference.xyzKm as [number, number, number]
    const longitude = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
    const latitude = Math.atan2(z, Math.hypot(x, y)) * 180 / Math.PI
    expect(poi.longitude).toBeCloseTo(longitude, 10)
    expect(poi.latitude).toBeCloseTo(latitude, 10)
    expect([poi.longitude, poi.latitude]).toEqual([reference.longitude, reference.latitude])
    expect(poi.sourceUrl).toContain(reference.kernel)
    expect(poi.coordinateReference).toContain('IAU_MARS')
    expect(poi.coordinateReference).toContain('planetocentric')
    expect(poi.coordinateAccuracy).toContain('decimal precision is not accuracy')
  })

  it('does not confuse Gaussian kernel input latitude with spherical planetocentric latitude', () => {
    for (const [id, comments, gaussianLatitude] of [
      ['curiosity', curiosityComments, -4.643851],
      ['insight', insightComments, 4.555681],
      ['perseverance', perseveranceComments, 18.64875816],
    ] as const) {
      expect(comments).toContain('Gaussian coordinates')
      expect(comments).toContain(String(gaussianLatitude))
      expect(Math.abs(marsPoiById(id)!.latitude - gaussianLatitude)).toBeGreaterThan(0.05)
    }
    expect([marsPoiById('perseverance')!.longitude, marsPoiById('perseverance')!.latitude])
      .toEqual(priorLanding.landing.planetocentricLonLat)
    expect(priorLanding.landing.nativeMapping.insidePreservedCrop).toBe(false)
  })

  it('uses the PDS map-relative MER positions rather than the distinct inertial solutions', () => {
    const catalog = clean(merCatalog)
    expect(catalog).toContain('surface features in maps produced in the MOLA IAU 2000 cartographic reference frame')
    expect(catalog).toContain('14.5692 degrees S latitude, 175.4729 degrees E longitude for Spirit')
    expect(catalog).toContain('1.9462 degrees S latitude, 354.4734 degrees E longitude for Opportunity')
    expect([marsPoiById('spirit')!.longitude, marsPoiById('spirit')!.latitude]).toEqual([175.4729, -14.5692])
    expect([marsPoiById('opportunity')!.longitude, marsPoiById('opportunity')!.latitude]).toEqual([354.4734, -1.9462])
    expect(marsPoiById('spirit')!.longitude).not.toBe(175.47848)
    expect(marsPoiById('opportunity')!.latitude).not.toBe(-1.948282)
    expect(clean(coordinateGuidance)).toContain('Planetocentric latitude with east longitude')
    for (const id of ['spirit', 'opportunity']) expect(marsPoiById(id)!.coordinateReference).toContain('map-relative')
  })

  it('retains NASA’s explicitly planetocentric rounded Viking coordinates', () => {
    const viking = clean(vikingHtml)
    expect(viking).toContain('22.27° N, 312.05° E, planetocentric')
    expect(viking).toContain('47.64° N, 134.29° E, planetocentric')
    expect([marsPoiById('viking-1')!.longitude, marsPoiById('viking-1')!.latitude]).toEqual([312.05, 22.27])
    expect([marsPoiById('viking-2')!.longitude, marsPoiById('viking-2')!.latitude]).toEqual([134.29, 47.64])
  })

  it('keeps landing dates supported and distinct from kernel solution dates', () => {
    expect(clean(curiosityMission)).toContain('Aug. 6, 2012')
    expect(clean(perseveranceMission)).toContain('Feb. 18, 2021')
    expect(clean(insightMission)).toContain('Nov. 26, 2018')
    expect(clean(merCatalog)).toContain('January 4, 2004 UTC')
    expect(clean(merCatalog)).toContain('January 25, 2004 UTC')
    expect(clean(vikingHtml)).toContain('July 20, 1976')
    expect(clean(vikingHtml)).toContain('Sept. 3, 1976')
    expect(MARS_POIS.filter(poi => poi.category === 'mission').map(poi => [poi.id, poi.eventDate]))
      .toEqual([
        ['perseverance', '2021-02-18'], ['curiosity', '2012-08-06'], ['opportunity', '2004-01-25'],
        ['spirit', '2004-01-04'], ['viking-1', '1976-07-20'], ['viking-2', '1976-09-03'], ['insight', '2018-11-26'],
      ])
    for (const poi of MARS_POIS.filter(poi => poi.category !== 'mission')) expect(poi.eventDate).toBeUndefined()
  })

  it('reuses existing science centers and qualifications without changing mission targets', () => {
    for (const target of SCIENCE_TARGETS) {
      const poi = marsPoiById(target.id)!
      expect([poi.longitude, poi.latitude]).toEqual([target.coordinate.lon, target.coordinate.lat])
      expect(poi.sourceUrl).toBe(target.coordinateSourceUrl)
      expect(poi.description).toContain(target.scientificRationale)
      expect(poi.description).toContain(target.limitations[0])
      expect(poi.references).toContainEqual({ name: 'NASA scientific context', url: target.scienceSourceUrl })
    }
    expect(marsPoiById('jezero')!.longitude).not.toBe(marsPoiById('perseverance')!.longitude)
    expect(marsPoiById('gale')!.latitude).not.toBe(marsPoiById('curiosity')!.latitude)
  })

  it('requires explicit bounds, source provenance and unresolved absolute registration for every record', () => {
    for (const poi of MARS_POIS) {
      expect(Number.isFinite(poi.longitude)).toBe(true)
      expect(Number.isFinite(poi.latitude)).toBe(true)
      expect(poi.longitude).toBeGreaterThanOrEqual(0)
      expect(poi.longitude).toBeLessThan(360)
      expect(Math.abs(poi.latitude)).toBeLessThanOrEqual(90)
      expect(poi.sourceUrl).toMatch(/^https:\/\//)
      expect(poi.sourceName.length).toBeGreaterThan(10)
      expect(poi.coordinateReference.toLowerCase()).toContain('planetocentric')
      expect(poi.coordinateReference).toContain('east-positive')
      expect(poi.coordinateAccuracy).toContain('Not independently registered')
      expect(poi.confidence).toContain('unverified')
      expect(poi.description).not.toMatch(/current position is|safe route|survival probability/i)
      for (const reference of poi.references ?? []) expect(reference.url).toMatch(/^https:\/\//)
      expect(poi.images).toBeUndefined()
    }
  })

  it('links only primary and supporting sources with actual successful archived HTTP receipts', () => {
    const receipts = [...localReceipts, ...targetReceipts, ...additionalTargetReceipts, ...priorKernelReceipts.flat()]
    for (const poi of MARS_POIS) {
      for (const url of [poi.sourceUrl, ...(poi.references ?? []).map(reference => reference.url)]) {
        expect(receipts.some(receipt => receipt.status === 200 && receipt.requestedUrl === url), url).toBe(true)
      }
    }
  })
})
