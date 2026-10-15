import type { Env } from '../../worker';
import { loadPayloadBySlug, jsonResponse } from '../../worker';
import {
  assistantSlots,
  validAssistantDate,
  assistantToday,
  assistantAddDays,
  type AssistantData,
} from '../../services/bookingAssistant';

/**
 * Endpoint oficial de disponibilidade para WhatsApp Flows e consultas externas (Fase 6).
 * GET /api/availability?tenantSlug=...&serviceId=...&barberId=...&date=YYYY-MM-DD
 */
export async function handleAvailabilityRequest(url: URL, env: Env): Promise<Response> {
  const tenantSlug = url.searchParams.get('tenantSlug') || url.searchParams.get('tenantId');
  if (!tenantSlug) {
    return jsonResponse({ error: 'tenantSlug ou tenantId é obrigatório' }, 400);
  }

  const payload = await loadPayloadBySlug(env, tenantSlug);
  if (!payload) {
    return jsonResponse({ error: 'Estabelecimento não encontrado' }, 404);
  }

  const now = new Date();
  const serviceId = url.searchParams.get('serviceId') || '';
  const barberId = url.searchParams.get('barberId') || url.searchParams.get('professionalId') || '';
  const date = url.searchParams.get('date') || assistantToday(now);

  const data: AssistantData = {
    org: payload.org,
    services: Array.isArray(payload.services) ? payload.services : [],
    barbers: Array.isArray(payload.barbers) ? payload.barbers : [],
    appointments: Array.isArray(payload.appointments) ? payload.appointments : [],
  };

  if (!validAssistantDate(date, now)) {
    return jsonResponse({ error: 'Data inválida ou fora do intervalo de 90 dias' }, 400);
  }

  // Sem serviço informado: retorna catálogo básico para carregar o Flow
  if (!serviceId) {
    return jsonResponse({
      services: data.services.filter((s) => s.active !== false).map((s) => ({
        id: s.id,
        name: s.name,
        price: s.price,
        duration_minutes: s.duration_minutes,
      })),
      barbers: data.barbers.filter((b) => b.active !== false).map((b) => ({
        id: b.id,
        name: b.full_name,
      })),
      date,
    });
  }

  const slots = assistantSlots(data, { serviceId, barberId, date }, now);
  const available = Array.from(new Set(slots.map((s) => s.time))).sort();

  return jsonResponse({
    tenantSlug,
    serviceId,
    barberId: barberId || null,
    date,
    available,
    slots: slots.map((s) => ({
      time: s.time,
      barberId: s.barberId,
      barberName: s.barberName,
    })),
  });
}

/**
 * Endpoint de troca de dados (Data Exchange) para WhatsApp Flows (Fase 6).
 * POST /api/whatsapp/flow
 * Processa requisições INIT e data_exchange da Meta.
 */
export async function handleWhatsAppFlowRequest(request: Request, env: Env): Promise<Response> {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'JSON inválido' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const data = body?.data || {};
  const tenantSlug = String(data?.tenant_slug || env.WHATSAPP_DEFAULT_TENANT_SLUG || '');

  const payload = await loadPayloadBySlug(env, tenantSlug);
  if (!payload) {
    return new Response(JSON.stringify({ error: 'Estabelecimento não encontrado' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const assistantData: AssistantData = {
    org: payload.org,
    services: Array.isArray(payload.services) ? payload.services : [],
    barbers: Array.isArray(payload.barbers) ? payload.barbers : [],
    appointments: Array.isArray(payload.appointments) ? payload.appointments : [],
  };

  const now = new Date();
  const activeServices = assistantData.services.filter((s) => s.active !== false);
  const activeBarbers = assistantData.barbers.filter((b) => b.active !== false);

  const today = assistantToday(now);
  const dates = Array.from({ length: 14 }).map((_, i) => {
    const d = assistantAddDays(today, i);
    const [year, month, day] = d.split('-');
    return { id: d, title: `${day}/${month}/${year}` };
  });

  const selectedServiceId = data.service_id || (activeServices.length ? activeServices[0].id : '');
  const selectedBarberId = data.barber_id === 'any' ? '' : data.barber_id || '';
  // Seleciona a data pedida ou a primeira data futura com vagas disponíveis
  const selectedDate =
    data.date ||
    dates.find((d) => {
      const s = assistantSlots(
        assistantData,
        { serviceId: selectedServiceId, barberId: selectedBarberId, date: d.id },
        now
      );
      return s.length > 0;
    })?.id ||
    dates[0]?.id ||
    today;

  let slots: Array<{ id: string; title: string }> = [];
  if (selectedServiceId && selectedDate) {
    const calculatedSlots = assistantSlots(
      assistantData,
      {
        serviceId: selectedServiceId,
        barberId: selectedBarberId,
        date: selectedDate,
      },
      now
    );

    slots = Array.from(new Set(calculatedSlots.map((s) => s.time)))
      .sort()
      .map((time) => ({ id: time, title: time }));
  }

  const responsePayload = {
    version: '3.0',
    screen: 'APPOINTMENT_SCREEN',
    data: {
      tenant_slug: tenantSlug,
      services: activeServices.map((s) => ({
        id: s.id,
        title: `${s.name} - R$ ${Number(s.price || 0).toFixed(2).replace('.', ',')}`,
      })),
      barbers: [
        { id: 'any', title: 'Qualquer profissional' },
        ...activeBarbers.map((b) => ({ id: b.id, title: b.full_name })),
      ],
      dates,
      selected_service: selectedServiceId,
      selected_barber: selectedBarberId || 'any',
      selected_date: selectedDate,
      slots,
    },
  };

  return new Response(JSON.stringify(responsePayload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
