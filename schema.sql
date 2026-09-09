-- AgendAI / Cloudflare D1
-- Banco principal para dados mutaveis. O KV antigo fica apenas como fonte de migracao/leitura.
CREATE TABLE IF NOT EXISTS app_store (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  expires_at INTEGER,
  updated_at INTEGER NOT NULL
) WITHOUT ROWID;
