import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import tailwindConfig from './tailwind.config';
import { createLabHandler } from './tests/assistant-lab-server';

// Configuração independente: NÃO importa o middleware que lê/grava o banco local.
export default defineConfig(() => {
  const env = loadEnv('assistant', process.cwd(), 'ASSISTANT_LAB_');
  const handle = createLabHandler({ apiKey: env.ASSISTANT_LAB_OPENROUTER_KEY,
    enabled: env.ASSISTANT_LAB_ENABLED === 'true', model: env.ASSISTANT_LAB_MODEL });
  return {
    plugins: [react(), { name: 'assistant-isolated-lab', configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const host = '127.0.0.1:5174';
        if (req.headers.host !== host) { res.statusCode = 403; res.end('Origem bloqueada.'); return; }
        const pathname = new URL(req.url || '/', `http://${host}`).pathname;
        if (pathname === '/') { res.writeHead(302, { Location: '/tests/assistant-lab.html' }); res.end(); return; }
        if (!pathname.startsWith('/api/')) return next();
        let size = 0;
        const chunks = [];
        try {
          for await (const chunk of req) {
            size += chunk.length;
            if (size > 1024) { res.writeHead(413, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Pedido muito grande.' })); return; }
            chunks.push(chunk);
          }
          const method = req.method || 'GET';
          const headers = new Headers();
          for (const name of ['content-type', 'origin']) if (typeof req.headers[name] === 'string') headers.set(name, req.headers[name]);
          const result = await handle(new Request(`http://${host}${req.url}`, { method, headers,
            ...(!['GET', 'HEAD'].includes(method) ? { body: Buffer.concat(chunks) } : {}) }));
          res.writeHead(result.status, Object.fromEntries(result.headers));
          res.end(await result.text());
        } catch {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Laboratório indisponível. Nenhuma gravação realizada.' }));
        }
      });
    } }],
    envPrefix: 'LAB_PUBLIC_UNUSED_',
    css: { postcss: { plugins: [tailwindcss({ ...tailwindConfig,
      content: [...tailwindConfig.content, './tests/assistant-lab.tsx'],
    }), autoprefixer()] } },
    server: { host: '127.0.0.1', port: 5174, strictPort: true, cors: false },
  };
});
