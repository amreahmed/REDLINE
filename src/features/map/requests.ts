type FailureKind = 'missing' | 'http' | 'network' | 'timeout' | 'content'

export class ResourceError extends Error {
  constructor(public readonly kind: FailureKind, message: string) {
    super(message)
    this.name = 'ResourceError'
  }
}

type RequestOptions = { fetcher?: typeof fetch; timeoutMs?: number }

async function request<T>(url: string, signal: AbortSignal, read: (response: Response) => Promise<T>, { fetcher = fetch, timeoutMs = 15_000 }: RequestOptions): Promise<T> {
  signal.throwIfAborted()
  const controller = new AbortController()
  const abort = () => controller.abort(signal.reason)
  signal.addEventListener('abort', abort, { once: true })
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs)
  try {
    const response = await fetcher(url, { signal: controller.signal, mode: 'cors', credentials: 'omit' })
    if (response.status === 404) throw new ResourceError('missing', 'The service reports no tile at this location (HTTP 404).')
    if (!response.ok) throw new ResourceError('http', `The service returned HTTP ${response.status}.`)
    return await read(response)
  } catch (error) {
    if (signal.aborted) throw signal.reason
    if (timedOut) throw new ResourceError('timeout', 'The request timed out. Retry when the service is available.')
    if (error instanceof ResourceError) throw error
    throw new ResourceError('network', 'Network or CORS failure. The browser cannot confirm whether this tile exists.')
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', abort)
  }
}

export function requestXml(url: string, signal: AbortSignal, options: RequestOptions = {}) {
  return request(url, signal, (response) => response.text(), options)
}

export function requestTile(url: string, format: string, signal: AbortSignal, options: RequestOptions = {}) {
  return request(url, signal, async (response) => {
    if (response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== format) throw new ResourceError('content', 'The service returned an unexpected image format.')
    const blob = await response.blob()
    if (blob.size === 0) throw new ResourceError('content', 'The service returned an empty image.')
    return blob
  }, options)
}
