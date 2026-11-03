-- AgendAI / Cloudflare D1
-- Banco principal para dados mutaveis. O KV antigo fica apenas como fonte de migracao/leitura.
CREATE TABLE IF NOT EXISTS app_store (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  expires_at INTEGER,
  updated_at INTEGER NOT NULL
) WITHOUT ROWID;

-- Indice para acelerar consultas de chaves com expiracao e rotinas de expurgo
CREATE INDEX IF NOT EXISTS idx_app_store_expires ON app_store(expires_at) WHERE expires_at IS NOT NULL;

-- Tabela de Contratos/Regras de Clientes Fixos (Recorrência)
CREATE TABLE IF NOT EXISTS recurring_schedules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  client_phone TEXT NOT NULL,       -- Normalizado (apenas números) para busca rápida na página pública
  client_name TEXT NOT NULL,
  professional_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  day_of_week INTEGER NOT NULL,     -- 0 (Domingo) a 6 (Sábado)
  start_time TEXT NOT NULL,         -- Formato "HH:mm" (ex: "14:00")
  frequency TEXT NOT NULL,          -- 'WEEKLY' (Semanal) ou 'BIWEEKLY' (Quinzenal)
  anchor_date TEXT NOT NULL,        -- Data base "YYYY-MM-DD" do primeiro corte para cálculo quinzenal
  status TEXT DEFAULT 'ACTIVE',     -- 'ACTIVE', 'PAUSED', 'CANCELLED'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recurring_tenant_phone ON recurring_schedules(tenant_id, client_phone);
CREATE INDEX IF NOT EXISTS idx_recurring_tenant_prof ON recurring_schedules(tenant_id, professional_id, status);

-- Tabela de agendamentos com suporte a exceções de recorrência
CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  org_id TEXT,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  professional_id TEXT,
  barber_id TEXT,
  service_id TEXT,
  service_name TEXT,
  start_time TEXT NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  price REAL DEFAULT 0,
  status TEXT DEFAULT 'scheduled',
  payment_method TEXT,
  date TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  recurring_id TEXT,
  is_rescheduled INTEGER DEFAULT 0, -- 1 se foi remarcado excepcionalmente na semana
  original_date TEXT,               -- Guarda a data/hora original liberada (ex: "2026-11-06 14:00")
  cancellation_feedback TEXT        -- Motivo enviado pelo cliente ao cancelar/remarcar
);

CREATE INDEX IF NOT EXISTS idx_appointments_recurring ON appointments(recurring_id);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_date ON appointments(tenant_id, date);
