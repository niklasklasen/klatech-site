/**
 * Minimal static server for the BUILT site (QA-owned).
 *
 * Playwright must exercise dist/, not the dev server: dev serves unbundled
 * modules and a different 404 path, so a dev-server pass proves nothing about
 * what ships. `astro preview` daemonises itself in Astro 7, so Playwright's
 * webServer cannot supervise it — hence this foreground equivalent. It mirrors
 * static-host behaviour: directory -> index.html, unknown path -> 404.html
 * with a real 404 status.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = resolve(fileURLToPath(new URL('..', import.meta.url)), 'dist');
const PORT = Number(process.env.PORT ?? 4321);
/** Bind address. Unset = all interfaces, which is what `npm run links` needs. */
const HOST = process.env.HOST || undefined;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
};

async function resolveFile(pathname) {
  // Block traversal outside dist/.
  const clean = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  const target = join(DIST, clean);
  if (!target.startsWith(DIST)) return null;

  try {
    const info = await stat(target);
    if (info.isDirectory()) {
      const index = join(target, 'index.html');
      await stat(index);
      return index;
    }
    return target;
  } catch {
    // Extensionless path: try /foo.html, then /foo/index.html.
    for (const candidate of [`${target}.html`, join(target, 'index.html')]) {
      try {
        await stat(candidate);
        return candidate;
      } catch {
        /* keep trying */
      }
    }
    return null;
  }
}

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://localhost:${PORT}`);
  const file = await resolveFile(pathname);

  if (file) {
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(body);
    return;
  }

  try {
    const notFound = await readFile(join(DIST, '404.html'));
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    res.end(notFound);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('404');
  }
});

server.on('error', (error) => {
  // Loud, not silent. If the port is already held — by `astro dev`, by a stale
  // preview, by a previous run — then whatever answers on it is NOT dist/, and a
  // suite that quietly tests it is reporting on the wrong system. Exit non-zero
  // and say which port.
  if (error.code === 'EADDRINUSE') {
    console.error(
      `tests/server.mjs: port ${PORT} is already in use, so dist/ is NOT being served. ` +
        'Stop whatever holds it (`npx astro dev stop`) and re-run.',
    );
  } else {
    console.error(`tests/server.mjs: ${error.message}`);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`serving ${DIST} on http://${HOST ?? 'localhost'}:${PORT}`);
});
