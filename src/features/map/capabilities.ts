import { ADVERTISED_CRS } from '../../data/marsLayers'
import type { Bounds, LayerDefinition, TileContract } from './types'

const WMTS = 'http://www.opengis.net/wmts/1.0'
const OWS = 'http://www.opengis.net/ows/1.1'

function children(parent: Element, namespace: string, name: string): Element[] {
  return Array.from(parent.childNodes).filter((node): node is Element => node.nodeType === 1 && (node as Element).namespaceURI === namespace && (node as Element).localName === name)
}

function one(parent: Element, namespace: string, name: string): Element {
  const matches = children(parent, namespace, name)
  if (matches.length !== 1) throw new Error(`Expected one ${name} in service metadata.`)
  return matches[0]
}

const text = (parent: Element, namespace: string, name: string) => one(parent, namespace, name).textContent?.trim() ?? ''
const identifier = (parent: Element) => text(parent, OWS, 'Identifier')
const numbers = (value: string) => value.split(/\s+/).map(Number)
const fail = (message: string): never => { throw new Error(`Unrecognized Mars Trek contract: ${message}`) }

/** Read live capabilities but accept only each layer's inspected angular display contract. */
export function readCapabilities(xml: string, definition: LayerDefinition, parseXml = (source: string) => new DOMParser().parseFromString(source, 'text/xml')): TileContract {
  if (xml.length > 1_000_000 || /<!DOCTYPE/i.test(xml)) fail('unsupported XML document')
  const document = parseXml(xml)
  const root = document.documentElement
  if (!root || root.localName !== 'Capabilities' || root.namespaceURI !== WMTS || root.getAttribute('version') !== '1.0.0' || document.getElementsByTagName('parsererror').length) fail('invalid capabilities XML')
  const contents = one(root, WMTS, 'Contents')
  const layer = one(contents, WMTS, 'Layer')
  if (identifier(layer) !== definition.productId) fail('layer identifier changed')
  const bbox = one(layer, OWS, 'BoundingBox')
  const extent = [...numbers(text(bbox, OWS, 'LowerCorner')), ...numbers(text(bbox, OWS, 'UpperCorner'))]
  if (bbox.getAttribute('crs') !== ADVERTISED_CRS || extent.length !== 4 || extent.some((value, index) => !Number.isFinite(value) || Math.abs(value - definition.extent[index]) > 1e-7)) fail('coverage or CRS changed')
  const style = identifier(one(layer, WMTS, 'Style'))
  const format = text(layer, WMTS, 'Format')
  const matrixSet = text(one(layer, WMTS, 'TileMatrixSetLink'), WMTS, 'TileMatrixSet')
  const matrix = one(contents, WMTS, 'TileMatrixSet')
  if (style !== 'default' || format !== definition.format || matrixSet !== 'default028mm' || identifier(matrix) !== matrixSet || text(matrix, OWS, 'SupportedCRS') !== ADVERTISED_CRS) fail('style, format, matrix set, or CRS changed')
  const resource = one(layer, WMTS, 'ResourceURL')
  const template = resource.getAttribute('template') ?? ''
  const base = definition.capabilitiesUrl.replace('WMTSCapabilities.xml', '')
  const suffix = `{Style}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.${format === 'image/png' ? 'png' : 'jpg'}`
  if (resource.getAttribute('resourceType') !== 'tile' || resource.getAttribute('format') !== format || (template !== base + suffix && template !== base + '/' + suffix)) fail('tile resource URL changed')
  const levels = children(matrix, WMTS, 'TileMatrix')
  if (levels.length !== definition.maxLevel + 1) fail('supported level count changed')
  const matrixIds: string[] = []
  const resolutions: number[] = []
  const sizes: [number, number][] = []
  for (const [z, level] of levels.entries()) {
    const origin = numbers(text(level, WMTS, 'TopLeftCorner'))
    const width = Number(text(level, WMTS, 'MatrixWidth'))
    const height = Number(text(level, WMTS, 'MatrixHeight'))
    const tileWidth = Number(text(level, WMTS, 'TileWidth'))
    const tileHeight = Number(text(level, WMTS, 'TileHeight'))
    const scale = Number(text(level, WMTS, 'ScaleDenominator'))
    if (identifier(level) !== String(z) || origin.length !== 2 || origin[0] !== -180 || origin[1] !== 90 || width !== 2 ** (z + 1) || height !== 2 ** z || tileWidth !== 256 || tileHeight !== 256 || !Number.isFinite(scale) || scale <= 0) fail(`matrix ${z} changed`)
    // The provider's scale denominators use an inconsistent physical conversion.
    // The independently documented global 2×1 angular grid determines placement.
    matrixIds.push(identifier(level))
    resolutions.push(360 / (width * tileWidth))
    sizes.push([width, height])
  }
  return { extent: extent as Bounds, origin: [-180, 90], matrixSet, matrixIds, resolutions, sizes, tileSize: 256, style, format, template }
}
