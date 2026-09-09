import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Prévia visual isolada: usa apenas dados fictícios e bloqueia as APIs do projeto.
export default defineConfig({
  plugins: [react(), { name: 'showcase-preview-no-api', configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url?.startsWith('/api/')) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Prévia isolada: APIs desativadas.' }));
        return;
      }
      next();
    });
  } }],
  envPrefix: 'SHOWCASE_PREVIEW_UNUSED_',
  server: { host: '127.0.0.1', port: 5176, strictPort: true },
});
