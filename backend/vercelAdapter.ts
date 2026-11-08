import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http';

export const API_PATH_PARAMETER = '__aqua_api_path';
type RoutedRequest = IncomingMessage & { query?: Record<string, unknown> };
function jsonError(res: ServerResponse, status: number, message: string) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ ok: false, message }));
}

/** One Node Function; no listener, Vite server, credentials or request-body parsing here. */
export function createVercelApiHandler(app: RequestListener, validateEnvironment: () => void = () => {}): RequestListener {
  return (incoming, res) => {
    try { validateEnvironment(); }
    catch { return jsonError(res, 503, 'Konfigurasi Preview belum aman atau belum lengkap.'); }
    const req = incoming as RoutedRequest;
    let url: URL;
    try { url = new URL(req.url || '/', 'http://vercel.internal'); }
    catch { return jsonError(res, 400, 'URL API tidak valid.'); }
    const supplied = url.searchParams.getAll(API_PATH_PARAMETER);
    const attached = req.query?.[API_PATH_PARAMETER];
    if (supplied.length > 1 || (attached !== undefined && typeof attached !== 'string') ||
      (supplied.length === 1 && attached !== undefined && supplied[0] !== attached))
      return jsonError(res, 400, 'Parameter routing API tidak valid.');
    const captured = supplied[0] ?? attached;
    let pathname = url.pathname;
    if (typeof captured === 'string') {
      let decoded: string;
      try { decoded = decodeURIComponent(captured); }
      catch { return jsonError(res, 400, 'Path API tidak valid.'); }
      if (decoded.startsWith('/') || /[?#\\\u0000-\u001f]/.test(decoded) || decoded.split('/').some(part => part === '.' || part === '..'))
        return jsonError(res, 400, 'Path API tidak valid.');
      pathname = `/api${captured ? '/' + captured : ''}`;
    }
    if (!/^\/api(?:\/|$)/i.test(pathname)) return jsonError(res, 404, 'Endpoint API tidak tersedia.');
    url.searchParams.delete(API_PATH_PARAMETER);
    if (req.query) delete req.query[API_PATH_PARAMETER];
    const search = url.searchParams.toString();
    req.url = pathname + (search ? '?' + search : '');
    // Method, headers (including Authorization), and the untouched body stream
    // reach exactly the same Express middleware as the standalone Node server.
    app(req, res);
  };
}
