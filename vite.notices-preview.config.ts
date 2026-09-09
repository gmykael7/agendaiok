import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Standalone visual fixture. Does not load local databases, secrets or production APIs.
export default defineConfig({
  plugins: [react(), { name: 'notices-preview-no-api', configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url?.startsWith('/api/')) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Prévia isolada: APIs externas desativadas.' }));
        return;
      }
      next();
    });
  } }],
  envPrefix: 'NOTICES_PREVIEW_UNUSED_',
  server: { host: '127.0.0.1', port: 5175, strictPort: true },
});
