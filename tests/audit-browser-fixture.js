// Fixture manual de QA: executar apenas como initScript da prévia isolada local.
// Não é importada pelo app nem incluída no build de produção.
(() => {
  if (location.origin !== 'http://127.0.0.1:5180') throw new Error('Fixture restrita à prévia local.');
  const params = new URLSearchParams(location.search);
  const day = new Date();
  const today = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  const org = {
    id: 'qa-org', name: 'Barbearia Horizonte • Estúdio & Estilo', owner_name: 'Pessoa de teste',
    email: 'qa@barbearia.test', slug: 'qa-horizonte', phone: '(85) 99999-0000',
    address: 'Rua de Teste, 120 • Centro', primary_color: params.get('brand') || '#10b981',
    background_color: params.get('theme') === 'light' ? '#f8fafc' : '#070B14',
    surface_color: params.get('theme') === 'light' ? '#ffffff' : '#121B2E',
    open_hour: '08:00', close_hour: '20:00', break_enabled: true, break_start: '12:00', break_end: '13:00',
    closed_periods: [], tv_enabled: true, tv_media_type: 'institutional', tv_show_client_names: false,
    tv_animations: false, tv_sound_enabled: false, account_status: 'active', public_gallery: [], social_links: {},
  };
  const services = [
    { id: 'qa-service', org_id: org.id, name: 'Corte executivo com acabamento', price: 50, duration_minutes: 30, category: 'Cabelo', active: true },
    { id: 'qa-combo', org_id: org.id, name: 'Combo completo: cabelo, barba e sobrancelha', price: 95, duration_minutes: 60, category: 'Combos', active: true },
  ];
  const barbers = [{ id: 'qa-barber', org_id: org.id, full_name: 'Profissional de teste', role: 'Barbeiro', commission_rate: 50, phone: '(85) 99999-0000', active: true }];
  const appointments = ['scheduled', 'confirmed', 'arrived', 'in_progress', 'completed', 'no_show', 'canceled'].map((status, i) => ({
    id: `qa-appointment-${i}`, org_id: org.id, client_name: i === 0 ? 'Cliente com nome longo para revisão de layout' : `Cliente de teste ${i + 1}`,
    client_phone: `(85) 99999-000${i}`, service_id: services[0].id, service_name: services[0].name,
    barber_id: barbers[0].id, barber_name: barbers[0].full_name, date: today, start_time: `${String(9 + i).padStart(2, '0')}:00`,
    duration_minutes: 30, price: 50, status, payment_method: status === 'completed' ? 'pix' : undefined, created_at: new Date().toISOString(),
  }));
  const clients = appointments.map((a, i) => ({ id: `qa-client-${i}`, org_id: org.id, name: a.client_name, phone: a.client_phone, total_visits: 1, total_spent: 50 }));
  const notifications = appointments.map((a, i) => ({ id: `qa-notice-${i}`, org_id: org.id, title: 'Novo agendamento', message: `${a.client_name} • ${a.start_time}`, type: 'new_appointment', created_at: a.created_at, appointment_id: a.id, target_tab: 'agenda' }));
  const products = [{ id: 'qa-product', org_id: org.id, name: 'Pomada modeladora de teste', price: 35, cost: 10, stock: 8, active: true, show_public: true, category: 'Finalização' }];
  let data = { org, savedOrgs: [org], services, barbers, appointments, clients, notifications, products, productSales: [], current_user: { id: 'qa-owner', role: 'owner', name: org.owner_name, email: org.email }, updated_at: new Date().toISOString() };
  if (params.has('empty')) data = { ...data, services: [], barbers: [], appointments: [], clients: [], notifications: [], products: [] };
  if (!params.has('guest')) {
    localStorage.removeItem('agendai_onboarding_dismissed');
    localStorage.setItem('agendai_auth_token', 'qa-local-fixture');
    localStorage.setItem('agendai_session_active', 'true');
    for (const [key, value] of Object.entries({ current_org: data.org, all_orgs: data.savedOrgs, services: data.services, barbers: data.barbers, appointments: data.appointments, clients: data.clients, notifications: data.notifications, products: data.products, product_sales: data.productSales, current_user: data.current_user })) localStorage.setItem(`agendai_${key}`, JSON.stringify(value));
  } else {
    for (const key of Object.keys(localStorage)) if (key.startsWith('agendai_')) localStorage.removeItem(key);
  }
  let notices = [{ id: '00000000-0000-4000-8000-000000000001', recipient_email: org.email, title: 'Novidades do AgendAI', message: 'Comunicado de teste para validar leitura, tema e responsividade.\nAs informações desta prévia são fictícias.', image_url: '', support: false, pix: '', link: '', read_at: null, archived_at: null, created_at: new Date().toISOString() }];
  const nativeFetch = window.fetch.bind(window);
  const requests = [];
  window.__agendaiQA = { requests, get data() { return data; }, failSave: null, offline: false };
  window.fetch = async (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (!url.pathname.startsWith('/api/')) return nativeFetch(input, options);
    if (window.__agendaiQA.offline) throw new TypeError('Rede indisponível na simulação.');
    const method = options.method || 'GET';
    requests.push({ path: url.pathname, method });
    const body = options.body ? JSON.parse(options.body) : {};
    const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
    if (url.pathname === '/api/sync') {
      if (method === 'POST') {
        if (window.__agendaiQA.failSave === 'html') return new Response('<html>API indisponível</html>', { headers: { 'Content-Type': 'text/html' } });
        if (window.__agendaiQA.failSave === 'conflict') return json({ error: 'Dados alterados em outro aparelho.' }, 409);
        data = { ...data, ...body, updated_at: new Date().toISOString() };
        return json({ success: true, updated_at: data.updated_at });
      }
      if (url.searchParams.has('slug')) {
        if (url.searchParams.get('slug') !== org.slug) return json({ error: 'Não encontrado' }, 404);
        return json({ ...data, org: { ...data.org, email: undefined }, clients: [], notifications: [], appointments: data.appointments.map(a => ({ ...a, client_name: 'Reservado', client_phone: '' })) });
      }
      return json(data);
    }
    if (url.pathname === '/api/auth/login') return json({ token: 'qa-local-fixture', data });
    if (url.pathname === '/api/notices') {
      if (body.action === 'read') notices = notices.map(n => n.id === body.id ? { ...n, read_at: new Date().toISOString() } : n);
      return json({ notices });
    }
    if (url.pathname === '/api/staff') return json({ users: [] });
    if (url.pathname === '/api/superadmin/status') return json({ configured: true, authorized: true, canBootstrap: false, email: org.email });
    if (url.pathname === '/api/superadmin/tenants') return json({ tenants: [{ ...org, status: 'active', plan: 'basic', appointments_count: appointments.length, clients_count: clients.length, services_count: services.length, barbers_count: barbers.length }] });
    if (url.pathname === '/api/superadmin/notices') return json({ notices: [], notice: { ...body, created_at: new Date().toISOString() }, sent_count: 1 });
    if (url.pathname === '/api/appointment') return json({ success: true });
    return json({ error: 'Rota não simulada nesta prévia.' }, 503);
  };
})();
