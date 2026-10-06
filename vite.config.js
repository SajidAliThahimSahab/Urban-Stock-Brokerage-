import 'dotenv/config';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import zlib from 'node:zlib';

// Serves everything in /api/<name>.js (the same Vercel-style handlers that run
// in production) from the Vite dev server, so `npm run dev` works without the
// Vercel CLI. Handlers are loaded lazily per request through Vite's SSR loader:
// a missing DATABASE_URL becomes a JSON 500 for that request instead of
// crashing the whole dev server at startup, and edits to api/*.js hot-reload.
function createApiMiddleware(loadModule) {
  return async (req, res, next) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const match = url.pathname.match(/^\/api\/([a-z0-9-]+)$/);
    if (!match) {
      next();
      return;
    }

    const sendJson = (status, data) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
    };

    try {
      const mod = await loadModule(match[1]);
      const mockReq = { method: req.method, query: Object.fromEntries(url.searchParams.entries()) };
      const mockRes = {
        statusCode: 200,
        status(code) {
          this.statusCode = code;
          return this;
        },
        setHeader() {}, // CDN cache headers are meaningless locally
        json(data) {
          sendJson(this.statusCode, data);
        },
      };
      await mod.default(mockReq, mockRes);
    } catch (err) {
      console.error(`Local API error (/api/${match[1]}):`, err);
      sendJson(500, { error: err.message || 'Internal server error' });
    }
  };
}

// Replaces the render-blocking <link rel="stylesheet" href="/assets/index-*.css">
// with an inline <style> at build time, so first paint needs no extra
// round trip. The app CSS is ~24 KB raw (6 KB gzip); fonts stay async.
export function inlineCssIntoHtml(html, bundle) {
  if (!bundle) return html;
  return html.replace(/<link\s+rel="stylesheet"[^>]*?href="\/?(assets\/[^"]+\.css)"[^>]*>/g, (tag, file) => {
    const asset = bundle[file];
    if (!asset || asset.type !== 'asset') return tag;
    const css = String(asset.source).replace(/<\/style/gi, '<\\/style');
    return `<style>${css}</style>`;
  });
}

function inlineCriticalCss() {
  return {
    name: 'inline-critical-css',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        return inlineCssIntoHtml(html, ctx.bundle);
      },
    },
  };
}

// `vite preview` serves files uncompressed with weak caching, which makes
// Lighthouse flag "Enable text compression" and "Efficient cache policy" on
// localhost even though a real host (Vercel) does both. This reproduces
// production behaviour for the preview server only. It never runs in dev.
function createPreviewCompression() {
  const compressible = /^(text\/|application\/(javascript|json)|image\/svg\+xml)/;
  return (req, res, next) => {
    if (req.url && req.url.startsWith('/assets/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
    if (!/\bgzip\b/.test(String(req.headers['accept-encoding'] || ''))) {
      next();
      return;
    }
    const write = res.write.bind(res);
    const end = res.end.bind(res);
    const writeHead = res.writeHead.bind(res);
    let gzip = null;
    let started = false;

    function start() {
      started = true;
      const type = String(res.getHeader('Content-Type') || '');
      if (!compressible.test(type) || res.getHeader('Content-Encoding') || res.statusCode === 304) return;
      gzip = zlib.createGzip({ level: 9 });
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Vary', 'Accept-Encoding');
      res.removeHeader('Content-Length');
      gzip.on('data', (chunk) => write(chunk));
      gzip.on('end', () => end());
    }

    res.writeHead = (status, ...rest) => {
      // Handlers may pass headers here instead of calling setHeader first.
      const headers = rest.find((a) => a && typeof a === 'object');
      if (headers) Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
      res.statusCode = status;
      if (!started) start();
      return writeHead(status);
    };
    res.write = (chunk, ...rest) => {
      if (!started) start();
      if (!gzip) return write(chunk, ...rest);
      gzip.write(chunk, ...rest);
      return true; // gzip buffers internally; returning its backpressure flag would stall pipe() waiting for a res 'drain' that never comes
    };
    res.end = (chunk, ...rest) => {
      if (!started) start();
      if (!gzip) return end(chunk, ...rest);
      if (chunk) gzip.write(chunk);
      gzip.end();
      return res;
    };
    next();
  };
}

// Serves /api/<name>.js (the same Vercel-style handlers used in production)
// for BOTH `npm run dev` and `npm run preview`. Without the preview hook,
// `vite preview` serves index.html for /api/* and the app shows
// "Unexpected token '<' ... is not valid JSON".
function localApiPlugin() {
  return {
    name: 'local-api-plugin',
    // dev: loaded through Vite's SSR loader so edits hot-reload
    configureServer(server) {
      server.middlewares.use(createApiMiddleware((name) => server.ssrLoadModule(`/api/${name}.js`)));
    },
    // preview: the built site has no SSR loader, so import the handler directly
    configurePreviewServer(server) {
      server.middlewares.use(createPreviewCompression());
      server.middlewares.use(
        createApiMiddleware((name) => import(pathToFileURL(path.resolve(process.cwd(), 'api', `${name}.js`)).href)),
      );
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), inlineCriticalCss(), localApiPlugin()],
  // Guarantee the production React build (no *.development.js) whenever
  // `vite build` runs, even if a stray NODE_ENV=development is set.
  define: mode === 'production' ? { 'process.env.NODE_ENV': JSON.stringify('production') } : {},
  esbuild: mode === 'production' ? { drop: ['console', 'debugger'], legalComments: 'none' } : {},
  build: {
    target: 'es2020',
    minify: 'esbuild',
    cssMinify: true,
    cssCodeSplit: true,
    sourcemap: false,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 250,
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        // React in its own long-cached chunk; app code and the lazy Overview
        // (3D vault + stats) stay separate so first paint ships the minimum.
        manualChunks(id) {
          if (id.includes('node_modules')) return 'react-vendor';
        },
      },
    },
  },
}));
