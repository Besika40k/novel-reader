/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import type { IncomingMessage } from 'node:http';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// AI providers whose key the dev proxy can add from .env.local (gitignored), so quote fixing can
// be tried in the browser without the key ever reaching the app.
const AI_HOSTS = {
  groq: { host: 'api.groq.com', env: 'GROQ_API_KEY' },
  gemini: { host: 'generativelanguage.googleapis.com', env: 'GEMINI_API_KEY' },
};

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// On the phone, pages are fetched natively (CapacitorHttp), which ignores CORS. A desktop browser
// can't read other sites, so `npm run dev` routes source and AI requests through this local proxy
// instead. See src/lib/http.ts.
function proxyHandler(keys: Record<string, string>): Connect.NextHandleFunction {
  return async (req, res) => {
    const target = new URL(req.url ?? '/', 'http://proxy.local').searchParams.get('url');
    if (!target || !/^https?:\/\//i.test(target)) {
      res.statusCode = 400;
      res.end('Expected ?url=http(s)://…');
      return;
    }
    try {
      const userAgent = req.headers['x-proxy-user-agent'];
      const headers: Record<string, string> = {
        'user-agent': typeof userAgent === 'string' ? userAgent : 'Mozilla/5.0',
        accept: req.headers.accept ?? '*/*',
        'accept-language': 'en-US,en;q=0.9',
      };
      const key = keys[new URL(target).hostname];
      const authorization = req.headers.authorization ?? (key ? `Bearer ${key}` : undefined);
      if (authorization) headers.authorization = authorization;
      const post = req.method === 'POST';
      if (post) headers['content-type'] = req.headers['content-type'] ?? 'application/json';
      const upstream = await fetch(target, {
        method: post ? 'POST' : 'GET',
        headers,
        body: post ? new Uint8Array(await readBody(req)) : undefined,
      });
      res.statusCode = upstream.status;
      for (const name of ['content-type', 'retry-after']) {
        const value = upstream.headers.get(name);
        if (value) res.setHeader(name, value);
      }
      res.end(Buffer.from(await upstream.arrayBuffer()));
    } catch (error) {
      res.statusCode = 502;
      res.end(String(error));
    }
  };
}

function sourceProxy(keys: Record<string, string>): Plugin {
  return {
    name: 'source-proxy',
    configureServer(server) {
      server.middlewares.use('/__proxy', proxyHandler(keys));
    },
    configurePreviewServer(server) {
      server.middlewares.use('/__proxy', proxyHandler(keys));
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const env = command === 'serve' && mode !== 'test' ? loadEnv(mode, process.cwd(), '') : {};
  const providers = Object.entries(AI_HOSTS).filter(([, { env: name }]) => env[name]);
  const keys = Object.fromEntries(providers.map(([, { host, env: name }]) => [host, env[name]]));

  return {
    plugins: [react(), sourceProxy(keys)],
    define: {
      __APP_VERSION__: JSON.stringify(version),
      __DEV_AI_PROVIDERS__: JSON.stringify(providers.map(([id]) => id)),
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
  };
});
