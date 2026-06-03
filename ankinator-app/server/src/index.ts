/**
 * Bootstrap do servidor Ankinator.
 * Serve a API em /api e, em produção, os arquivos estáticos do front-end (web/dist).
 */
import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { api } from './api.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: '25mb' }));
app.use('/api', api);

// Em produção, serve o build do front-end (web/dist) na raiz.
const webDist = path.resolve(here, '../../web/dist');
if (existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(webDist, 'index.html'));
  });
}

// Tratador de erros central (Express 5 encaminha rejeições de handlers async).
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error('[ankinator] erro:', message);
  if (!res.headersSent) res.status(500).json({ error: message });
});

app.listen(config.port, () => {
  console.log(`\n🎴 Ankinator API em http://localhost:${config.port}`);
  console.log(`   • API:        http://localhost:${config.port}/api/health`);
  console.log(`   • Modelo:     ${config.model}`);
  console.log(`   • API key:    ${config.hasApiKey() ? 'configurada ✓' : 'AUSENTE ✗ (geração desabilitada)'}`);
  if (existsSync(webDist)) console.log(`   • UI:         http://localhost:${config.port}/`);
  console.log('');
});
