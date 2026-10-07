/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// On the phone, pages are fetched natively (CapacitorHttp), which ignores CORS. A desktop browser
// can't read other sites, so `npm run dev` routes source requests through this local proxy instead.
// See fetchText in src/lib/http.ts.
const proxyHandler: Connect.NextHandleFunction = async (req, res) => {
  const target = new URL(req.url ?? '/', 'http://proxy.local').searchParams.get('url');
  if (!target || !/^https?:\/\//i.test(target)) {
    res.statusCode = 400;
    res.end('Expected ?url=http(s)://…');
    return;
  }
  try {
    const userAgent = req.headers['x-proxy-user-agent'];
    const upstream = await fetch(target, {
      headers: {
        'user-agent': typeof userAgent === 'string' ? userAgent : 'Mozilla/5.0',
        accept: req.headers.accept ?? '*/*',
        'accept-language': 'en-US,en;q=0.9',
      },
    });
    res.statusCode = upstream.status;
    const type = upstream.headers.get('content-type');
    if (type) res.setHeader('content-type', type);
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    res.statusCode = 502;
    res.end(String(error));
  }
};

function sourceProxy(): Plugin {
  return {
    name: 'source-proxy',
    configureServer(server) {
      server.middlewares.use('/__proxy', proxyHandler);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/__proxy', proxyHandler);
    },
  };
}

export default defineConfig({
  plugins: [react(), sourceProxy()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "@/styles/tokens" as *;\n`,
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5174,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});
