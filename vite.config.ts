import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'crypto';

const DB_FILE = path.resolve(__dirname, '.agendai_cloud_db.json');
const PBKDF2_ITERATIONS = 100_000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const getDb = (): Record<string, any> => {
  try {
    if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  } catch {}
  return {};
};

const saveDb = (data: Record<string, any>) => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Erro ao salvar no banco local do Vite:', error);
  }
};

const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();
const normalizeSlug = (value: unknown) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');

const createCredential = (password: string) => {
  const salt = randomBytes(16).toString('base64');
  return {
    salt,
    hash: pbkdf2Sync(password, Buffer.from(salt, 'base64'), PBKDF2_ITERATIONS, 32, 'sha256').toString('base64'),
    iterations: PBKDF2_ITERATIONS,
  };
};

const verifyCredential = (password: string, credential: any) => {
  const calculated = pbkdf2Sync(
    password,
    Buffer.from(credential.salt, 'base64'),
    credential.iterations || PBKDF2_ITERATIONS,
    32,
    'sha256'
  );
  const expected = Buffer.from(credential.hash || '', 'base64');
  return calculated.length === expected.length && timingSafeEqual(calculated, expected);
};

const stripSecrets = (org: any, publicView = false) => {
  if (!org) return org;
  const clean = { ...org };
  delete clean.password;
  delete clean.password_hash;
  if (publicView) delete clean.email;
  return clean;
};

const sanitizePrivate = (data: any) => {
  const org = stripSecrets(data.org);
  return {
    ...data,
    org,
    savedOrgs: Array.isArray(data.savedOrgs) ? data.savedOrgs.map((o: any) => stripSecrets(o)) : org ? [org] : [],
  };
};

const sanitizePublic = (data: any) => {
  const org = stripSecrets(data.org, true);
  return {
    org,
    savedOrgs: org ? [org] : [],
    services: Array.isArray(data.services) ? data.services : [],
    barbers: Array.isArray(data.barbers)
      ? data.barbers.map((b: any) => ({ ...b, phone: '', commission_rate: 0 }))
      : [],
    appointments: Array.isArray(data.appointments)
      ? data.appointments.map((a: any) => ({ ...a, client_name: 'Reservado', client_phone: '', payment_method: undefined }))
      : [],
    clients: [],
    updated_at: data.updated_at,
  };
};

const payloadDataCount = (data: any) =>
  (Array.isArray(data?.services) ? data.services.length : 0) +
  (Array.isArray(data?.barbers) ? data.barbers.length : 0) +
  (Array.isArray(data?.appointments) ? data.appointments.length : 0) +
  (Array.isArray(data?.clients) ? data.clients.length : 0);

const getToken = (req: any) => {
  const auth = String(req.headers.authorization || '');
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || '';
};

const getSessionEmail = (req: any, db: Record<string, any>) => {
  const token = getToken(req);
  const session = token ? db[`session:${token}`] : null;
  if (!session || session.expires_at <= Date.now()) return null;
  return normalizeEmail(session.email);
};

const sendJson = (res: any, data: unknown, status = 200) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
};

const readBody = (req: any): Promise<any> => new Promise((resolve, reject) => {
  let body = '';
  req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
  req.on('end', () => {
    try { resolve(body ? JSON.parse(body) : {}); } catch (error) { reject(error); }
  });
  req.on('error', reject);
});

const minutesFromTime = (value: string) => {
  const [h, m] = String(value || '').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const overlaps = (appointment: any, existing: any[]) => {
  const start = minutesFromTime(appointment.start_time);
  const end = start + Math.max(5, Number(appointment.duration_minutes || 30));
  return existing.some((item: any) => {
    if (item.status === 'canceled') return false;
    if (item.date !== appointment.date || item.barber_id !== appointment.barber_id) return false;
    const itemStart = minutesFromTime(item.start_time);
    const itemEnd = itemStart + Math.max(5, Number(item.duration_minutes || 30));
    return start < itemEnd && itemStart < end;
  });
};

const cloudApiPlugin = (): Plugin => ({
  name: 'agendai-cloud-api-middleware',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url || '', `http://${req.headers.host}`);

      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.end();
        return;
      }

      try {
        if (url.pathname === '/api/auth/register' && req.method === 'POST') {
          const body = await readBody(req);
          const payload = body.payload || body.data || body;
          const password = String(body.password || '').trim();
          const email = normalizeEmail(payload.org?.email);
          const slug = normalizeSlug(payload.org?.slug);
          const db = getDb();

          if (!email || !slug || password.length < 6) {
            sendJson(res, { error: 'E-mail, slug e senha de no mínimo 6 caracteres são obrigatórios.' }, 400);
            return;
          }
          if (db[`user:${email}`]) { sendJson(res, { error: 'Este e-mail já possui cadastro.' }, 409); return; }
          if (db[`slug:${slug}`]) { sendJson(res, { error: 'Este link/slug já está em uso.' }, 409); return; }

          const clean = sanitizePrivate({ ...payload, updated_at: new Date().toISOString() });
          db[`auth:${email}`] = createCredential(password);
          db[`user:${email}`] = clean;
          db[`slug:${slug}`] = clean;
          const token = randomBytes(32).toString('base64url');
          db[`session:${token}`] = { email, expires_at: Date.now() + SESSION_TTL_MS };
          saveDb(db);
          sendJson(res, { success: true, token, data: clean }, 201);
          return;
        }

        if (url.pathname === '/api/auth/login' && req.method === 'POST') {
          const body = await readBody(req);
          const email = normalizeEmail(body.email);
          const password = String(body.password || '');
          const db = getDb();
          let data = db[`user:${email}`];
          if (!data) { sendJson(res, { error: 'Cadastro não encontrado.' }, 401); return; }

          let valid = false;
          if (db[`auth:${email}`]) {
            valid = verifyCredential(password, db[`auth:${email}`]);
          } else if (data.org?.password && data.org.password === password) {
            valid = true;
            db[`auth:${email}`] = createCredential(password);
            data = sanitizePrivate(data);
            db[`user:${email}`] = data;
            db[`slug:${normalizeSlug(data.org?.slug)}`] = data;
          }

          if (!valid) { sendJson(res, { error: 'E-mail ou senha incorretos.' }, 401); return; }
          const token = randomBytes(32).toString('base64url');
          db[`session:${token}`] = { email, expires_at: Date.now() + SESSION_TTL_MS };
          saveDb(db);
          sendJson(res, { success: true, token, data: sanitizePrivate(data) });
          return;
        }

        if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
          const db = getDb();
          const token = getToken(req);
          if (token) delete db[`session:${token}`];
          saveDb(db);
          sendJson(res, { success: true });
          return;
        }

        if (url.pathname === '/api/sync' && req.method === 'GET') {
          const email = normalizeEmail(url.searchParams.get('email'));
          const slug = normalizeSlug(url.searchParams.get('slug'));
          const db = getDb();

          if (email) {
            const sessionEmail = getSessionEmail(req, db);
            if (sessionEmail !== email) { sendJson(res, { error: 'Sessão inválida ou expirada.' }, 401); return; }
            const found = db[`user:${email}`];
            if (!found) { sendJson(res, { found: false }, 404); return; }
            sendJson(res, sanitizePrivate(found));
            return;
          }

          if (slug) {
            const found = db[`slug:${slug}`];
            if (!found) { sendJson(res, { found: false }, 404); return; }
            sendJson(res, sanitizePublic(found));
            return;
          }

          sendJson(res, { error: 'Informe email ou slug.' }, 400);
          return;
        }

        if (url.pathname === '/api/sync' && req.method === 'POST') {
          const data = await readBody(req);
          const email = normalizeEmail(data.org?.email);
          const slug = normalizeSlug(data.org?.slug);
          const db = getDb();
          const sessionEmail = getSessionEmail(req, db);
          if (!email || sessionEmail !== email) { sendJson(res, { error: 'Não autorizado.' }, 401); return; }

          const current = db[`user:${email}`];
          if (current && payloadDataCount(current) > 0 && payloadDataCount(data) === 0 && data.__allow_empty !== true) {
            sendJson(res, { error: 'Proteção de dados: um aparelho vazio não pode apagar uma conta com dados. Recarregue para sincronizar.' }, 409);
            return;
          }
          if (current) db[`backup:last:${email}`] = current;

          const previousSlug = normalizeSlug(current?.org?.slug);
          const clean = sanitizePrivate({ ...data, updated_at: new Date().toISOString() });
          delete clean.__allow_empty;
          if (previousSlug && previousSlug !== slug) delete db[`slug:${previousSlug}`];
          db[`user:${email}`] = clean;
          db[`slug:${slug}`] = clean;
          saveDb(db);
          sendJson(res, { success: true, updated_at: clean.updated_at });
          return;
        }

        if (url.pathname === '/api/sync/restore-last' && req.method === 'POST') {
          const db = getDb();
          const email = getSessionEmail(req, db);
          if (!email) { sendJson(res, { error: 'Sessão inválida ou expirada.' }, 401); return; }
          const backup = db[`backup:last:${email}`];
          if (!backup) { sendJson(res, { error: 'Ainda não existe backup de segurança disponível.' }, 404); return; }
          const current = db[`user:${email}`];
          const restored = sanitizePrivate({ ...backup, updated_at: new Date().toISOString() });
          const oldSlug = normalizeSlug(current?.org?.slug);
          const newSlug = normalizeSlug(restored.org?.slug);
          if (oldSlug && oldSlug !== newSlug) delete db[`slug:${oldSlug}`];
          db[`user:${email}`] = restored;
          db[`slug:${newSlug}`] = restored;
          if (current) db[`backup:last:${email}`] = current;
          saveDb(db);
          sendJson(res, { success: true, data: restored });
          return;
        }

        if (url.pathname === '/api/appointment' && req.method === 'POST') {
          const appointment = await readBody(req);
          const slug = normalizeSlug(appointment.org_slug || appointment.org_id);
          const db = getDb();
          const current = db[`slug:${slug}`];
          if (!current) { sendJson(res, { error: 'Barbearia não encontrada.' }, 404); return; }

          const existing = Array.isArray(current.appointments) ? current.appointments : [];
          if (existing.some((a: any) => a.id === appointment.id)) {
            sendJson(res, { success: true, duplicate: true });
            return;
          }
          if (overlaps(appointment, existing)) {
            sendJson(res, { error: 'Este horário acabou de ser reservado. Escolha outro horário.' }, 409);
            return;
          }

          const cleanAppointment = { ...appointment, org_slug: undefined, status: appointment.status || 'scheduled' };
          current.appointments = [cleanAppointment, ...existing];

          const currentClients = Array.isArray(current.clients) ? current.clients : [];
          const phoneKey = String(cleanAppointment.client_phone || '').replace(/\D/g, '');
          const nameKey = String(cleanAppointment.client_name || '').trim().toLowerCase();
          const existingClientIndex = currentClients.findIndex((client: any) => {
            const clientPhone = String(client.phone || '').replace(/\D/g, '');
            const clientName = String(client.name || '').trim().toLowerCase();
            return (phoneKey && clientPhone === phoneKey) || (!phoneKey && nameKey && clientName === nameKey);
          });
          if (existingClientIndex >= 0) {
            const existingClient = currentClients[existingClientIndex];
            currentClients[existingClientIndex] = {
              ...existingClient,
              name: cleanAppointment.client_name || existingClient.name,
              phone: cleanAppointment.client_phone || existingClient.phone,
              total_visits: Math.max(0, Number(existingClient.total_visits || 0)) + 1,
              total_spent: Math.max(0, Number(existingClient.total_spent || 0)) + Math.max(0, Number(cleanAppointment.price || 0)),
              last_visit: cleanAppointment.date || 'Hoje',
            };
          } else {
            currentClients.unshift({
              id: `cli-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              org_id: current.org?.id,
              name: cleanAppointment.client_name,
              phone: cleanAppointment.client_phone,
              total_visits: 1,
              total_spent: Math.max(0, Number(cleanAppointment.price || 0)),
              last_visit: cleanAppointment.date || 'Hoje',
            });
          }
          current.clients = currentClients;
          current.updated_at = new Date().toISOString();
          db[`slug:${slug}`] = current;
          const email = normalizeEmail(current.org?.email);
          if (email) db[`user:${email}`] = current;
          saveDb(db);
          sendJson(res, { success: true }, 201);
          return;
        }

        if (url.pathname === '/api/waitlist' && req.method === 'POST') {
          const entry = await readBody(req);
          const slug = normalizeSlug(entry.org_slug || entry.org_id);
          const db = getDb();
          const current = db[`slug:${slug}`];
          if (!current) { sendJson(res, { error: 'Barbearia não encontrada.' }, 404); return; }

          const clientName = String(entry.client_name || '').trim();
          const clientPhone = String(entry.client_phone || '').trim();
          if (!clientName || !clientPhone) {
            sendJson(res, { error: 'Nome e WhatsApp são obrigatórios.' }, 400);
            return;
          }

          const newEntry = {
            id: 'wait-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            org_id: current.org?.id || '',
            client_name: clientName,
            client_phone: clientPhone,
            preferred_date: String(entry.preferred_date || '').trim(),
            preferred_period: entry.preferred_period || 'any',
            service_id: entry.service_id,
            service_name: entry.service_name,
            barber_id: entry.barber_id,
            barber_name: entry.barber_name,
            status: 'waiting',
            created_at: new Date().toISOString(),
          };

          const existingWaitlist = Array.isArray(current.waitlist) ? current.waitlist : [];
          current.waitlist = [newEntry, ...existingWaitlist];

          const existingNotifications = Array.isArray(current.notifications) ? current.notifications : [];
          current.notifications = [
            {
              id: 'notif-wait-' + Date.now(),
              org_id: current.org?.id,
              type: 'waitlist_entry',
              title: '⚡ Novo cliente na Fila de Espera',
              message: `${clientName} quer vaga para ${(newEntry.preferred_date || '').split('-').reverse().join('/')}.`,
              created_at: new Date().toISOString(),
              client_name: clientName,
              target_tab: 'agenda',
            },
            ...existingNotifications,
          ].slice(0, 100);

          current.updated_at = new Date().toISOString();
          db[`slug:${slug}`] = current;
          const email = normalizeEmail(current.org?.email);
          if (email) db[`user:${email}`] = current;
          saveDb(db);
          sendJson(res, { success: true, entry: newEntry }, 201);
          return;
        }
      } catch (error: any) {
        sendJson(res, { error: error?.message || 'Erro interno.' }, 500);
        return;
      }

      next();
    });
  }
});

export default defineConfig({
  plugins: [react(), cloudApiPlugin()],
  server: {
    host: true,
  }
});
