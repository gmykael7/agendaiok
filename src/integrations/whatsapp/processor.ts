import type { Env } from '../../worker';
import { loadPayloadBySlug } from '../../worker';
import type { WhatsAppEvent } from './types';
import { sendWhatsAppText, WhatsAppSendError } from './client';
import { resolveTenantSlug } from './tenant';
import { getSession, saveSession, clearSession, type WhatsAppSessionState } from './session';
import { createConversationMenu, numberedChoices, resolveConversationInput, welcomeMenu, MENU_HINT, type ConversationChoice, type ConversationMenu } from './conversation';
import {
  createWhatsAppBooking,
  cancelWhatsAppBooking,
  confirmWhatsAppBooking,
  rescheduleWhatsAppBooking,
  findCustomerAppointments,
  normalizeClientPhone,
} from './booking';
import {
  assistantSlots,
  inferGuidedIntent,
  validAssistantDate,
  sanitizeAssistantSelection,
  type AssistantData,
  type AssistantSlot,
  type AssistantSelection,
  type AssistantIntent,
} from '../../services/bookingAssistant';
import type { Service } from '../../types';

function logEvent(event: string, fields: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ event, ...fields, ts: new Date().toISOString() }));
}

const FALLBACK_REPLY =
  'Não consegui consultar a agenda agora. Tente novamente em instantes ou use nosso link de agendamento.';

const MAX_SLOTS_IN_REPLY = 8;

const serviceWords = (text: string): string[] => text.normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^a-z0-9]+/)
  .filter(word => word.length >= 3 && !['com', 'para', 'por', 'dos', 'das', 'servico', 'servicos'].includes(word));

function resolveWhatsAppIntent(text: string, data: AssistantData, now: Date): {
  intent: AssistantIntent; serviceMatches: Service[];
} {
  const intent = inferGuidedIntent(text, data, now);
  const activeServices = data.services.filter(service => service.active !== false);
  // O nome completo tem prioridade; nomes abreviados só selecionam uma opção única.
  if (intent.serviceId) return { intent, serviceMatches: [] };
  const vocabulary = new Set(activeServices.flatMap(service => serviceWords(service.name)));
  const words = serviceWords(text).filter(word => vocabulary.has(word));
  const serviceMatches = words.length ? activeServices.filter(service => {
    const nameWords = new Set(serviceWords(service.name));
    return words.every(word => nameWords.has(word));
  }) : [];
  if (serviceMatches.length) {
    intent.serviceId = serviceMatches.length === 1 ? serviceMatches[0].id : '';
    if (intent.topic === 'help') intent.topic = 'availability';
  }
  return { intent, serviceMatches };
}

function formatSlotsForWhatsApp(slots: AssistantSlot[]): string {
  const uniqueBarbers = new Set(slots.map((s) => s.barberId)).size > 1;
  return slots
    .slice(0, MAX_SLOTS_IN_REPLY)
    .map((slot) => (uniqueBarbers ? `• *${slot.time}* — ${slot.barberName}` : `• *${slot.time}*`))
    .join('\n');
}

function buildWhatsAppAssistantReply(
  data: AssistantData,
  userText: string,
  session: Partial<WhatsAppSessionState>,
  now: Date,
  profileName?: string,
  explicitSelection: Partial<AssistantSelection> = {},
  page?: ConversationChoice['page']
): { reply: string; selection: AssistantSelection; slots: AssistantSlot[]; menu?: ConversationMenu } {
  const resolved = resolveWhatsAppIntent(userText, data, now);
  const guided = { ...resolved.intent, ...explicitSelection };
  const selection = sanitizeAssistantSelection(
    { ...sanitizeAssistantSelection(session, data, now), ...guided }, data, now
  );
  const orgName = (data.org.name || 'nossa barbearia').slice(0, 100);
  const clientName = (profileName || session.clientName || '').slice(0, 80);
  const money = (price: number) => Number(price || 0).toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL',
  });
  const answer = (menu: ConversationMenu, slots: AssistantSlot[] = []) => ({
    reply: menu.text, selection, slots, menu,
  });
  const serviceMenu = (services: Service[], heading: string, intro: string) => {
    const offset = page?.kind === 'services' ? Math.max(0, Math.min(page.offset, Math.max(services.length - 1, 0))) : 0;
    const choices: ConversationChoice[] = services.slice(offset, offset + 8).map(service => ({
      title: service.name.slice(0, 80),
      description: `${money(service.price)} · ${service.duration_minutes || 30} min`,
      text: service.name,
      selection: { serviceId: service.id },
    }));
    if (offset + 8 < services.length) choices.push({
      title: 'Mais serviços', text: 'Serviços', page: { kind: 'services', offset: offset + 8 },
    });
    if (offset > 0) choices.push({
      title: 'Serviços anteriores', text: 'Serviços', page: { kind: 'services', offset: Math.max(0, offset - 8) },
    });
    return answer(createConversationMenu([
      heading, intro, choices.length ? numberedChoices(choices) : 'Não há serviços disponíveis no momento.',
      choices.length ? 'Toque em *Escolher serviço* ou envie o *número* da opção.' : '', MENU_HINT,
    ].filter(Boolean).join('\n\n'), choices, 'list', 'Escolher serviço'));
  };
  const dayMenu = (heading: string) => {
    if (explicitSelection.date === '') return {
      reply: ['*Qual data você prefere?*', heading,
        'Escreva o dia e o mês. Por exemplo: *25/10*.', MENU_HINT].join('\n\n'),
      selection, slots: [],
    };
    const choices: ConversationChoice[] = [
      { title: 'Hoje', text: 'Hoje' }, { title: 'Amanhã', text: 'Amanhã' },
      { title: 'Outra data', text: 'Agendar', selection: { date: '' } },
    ];
    return answer(createConversationMenu([
      heading, '*Para qual dia você prefere?*', numberedChoices(choices),
      'Toque em uma opção ou envie o número. Para outra data, escreva *dia/mês* (ex.: 25/10).', MENU_HINT,
    ].join('\n\n'), choices, 'buttons'));
  };

  if (/^(menu|in[ií]cio|come[cç]ar|voltar|oi|ol[aá]|bom dia|boa tarde|boa noite)[!. ]*$/i.test(userText.trim())) {
    return answer(welcomeMenu(orgName, clientName));
  }
  if (guided.topic === 'services' || /^(servi[cç]os?|pre[cç]os?|tabela|valores?|quanto custa|cardapio)\b/i.test(userText.trim())) {
    return serviceMenu(data.services.filter(s => s.active !== false), '*Serviços e valores*',
      `Escolha seu atendimento na *${orgName}*.`);
  }
  if (guided.topic === 'hours' || guided.topic === 'contact') {
    const choices: ConversationChoice[] = [
      { title: 'Agendar', text: 'Agendar' }, { title: 'Menu inicial', text: 'menu' },
    ];
    const info = [
      `*${orgName}*`,
      data.org.address ? `*Endereço*\n${data.org.address}` : '',
      data.org.phone ? `*Contato*\n${data.org.phone}` : '',
      `*Expediente*\n${data.org.open_hour || '08:00'} às ${data.org.close_hour || '20:00'}`,
      data.org.break_enabled ? `Intervalo: ${data.org.break_start} às ${data.org.break_end}` : '',
      data.org.slug ? `*Agendamento online*\nhttps://meuagendai.fun/${data.org.slug}` : '',
      numberedChoices(choices), MENU_HINT,
    ].filter(Boolean).join('\n\n');
    return answer(createConversationMenu(info, choices, 'buttons'));
  }
  if (guided.topic === 'availability' || selection.serviceId || selection.date || selection.barberId ||
      /^(agendar|marcar|quero agendar|quero marcar|agendamento)\b/i.test(userText.trim())) {
    if (!explicitSelection.serviceId && resolved.serviceMatches.length > 1) {
      return serviceMenu(resolved.serviceMatches, '*Qual serviço você prefere?*',
        'Encontrei mais de uma opção. Escolha abaixo para continuarmos.');
    }
    if (selection.serviceId && validAssistantDate(selection.date, now)) {
      const slots = assistantSlots(data, selection, now);
      const service = data.services.find(s => s.id === selection.serviceId);
      const date = selection.date.split('-').reverse().join('/');
      if (!slots.length) return dayMenu(`*Vamos escolher outro dia?*\n\nNão encontrei horários livres para *${service?.name || 'Atendimento'}* em *${date}*.`);
      const offset = page?.kind === 'slots' ? Math.max(0, Math.min(page.offset, slots.length - 1)) : 0;
      const multipleBarbers = new Set(slots.map(slot => slot.barberId)).size > 1;
      const choices: ConversationChoice[] = slots.slice(offset, offset + 8).map(slot => ({
        title: multipleBarbers ? `${slot.time} · ${slot.barberName}` : slot.time,
        text: slot.time,
        selection: { serviceId: slot.serviceId, date: slot.date, barberId: slot.barberId },
      }));
      if (offset + 8 < slots.length) choices.push({ title: 'Mais horários', text: 'Agendar', page: { kind: 'slots', offset: offset + 8 } });
      if (offset > 0) choices.push({ title: 'Horários anteriores', text: 'Agendar', page: { kind: 'slots', offset: Math.max(0, offset - 8) } });
      return answer(createConversationMenu([
        '*Escolha seu horário*',
        `Encontrei estes horários livres para *${service?.name || 'Atendimento'}* em *${date}*:`,
        numberedChoices(choices),
        'Toque em *Escolher horário* ou envie o *número* da opção. Você também pode escrever o horário.',
        'Ao escolher um horário, seu agendamento será confirmado.', MENU_HINT,
      ].join('\n\n'), choices, 'list', 'Escolher horário'), slots);
    }
    if (!selection.serviceId && validAssistantDate(selection.date, now)) {
      return serviceMenu(data.services.filter(s => s.active !== false), '*Escolha seu serviço*',
        `Perfeito para *${selection.date.split('-').reverse().join('/')}*!\nQual serviço você gostaria de realizar?`);
    }
    const service = data.services.find(s => s.id === selection.serviceId);
    return dayMenu(service ? `*Seu atendimento*\n\n${service.name} · ${money(service.price)}` : `*Agendamento na ${orgName}*`);
  }
  return answer(welcomeMenu(orgName, clientName));
}

export function parseTimeFromText(text: string): string | null {
  const norm = text.trim().toLowerCase();
  const colonMatch = norm.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (colonMatch) {
    const h = colonMatch[1].padStart(2, '0');
    const m = colonMatch[2];
    return `${h}:${m}`;
  }
  const hMatch = norm.match(/\b([01]?\d|2[0-3])h([0-5]\d)?\b/);
  if (hMatch) {
    const h = hMatch[1].padStart(2, '0');
    const m = hMatch[2] ? hMatch[2] : '00';
    return `${h}:${m}`;
  }
  return null;
}

export async function processWhatsAppEvent(env: Env, evt: WhatsAppEvent): Promise<void> {
  const isMessage = evt.type === 'message.received';
  logEvent('whatsapp_event_received', {
    eventType: evt.type,
    isMessage,
    isStatusOnly: !isMessage,
    messageId: evt.messageId,
    phoneNumberId: evt.phoneNumberId,
  });

  if (!isMessage) {
    if (evt.type === 'message.delivered') {
      logEvent('whatsapp_status_delivered', {
        messageId: evt.messageId,
        phoneNumberId: evt.phoneNumberId,
      });
    } else if (evt.type === 'message.failed') {
      logEvent('whatsapp_status_failed', {
        messageId: evt.messageId,
        phoneNumberId: evt.phoneNumberId,
        error: (evt as any).error,
        errorCode: (evt as any).errorCode,
        errorSubcode: (evt as any).errorSubcode,
      });
    } else {
      logEvent('whatsapp_message_status_processed', {
        type: evt.type,
        messageId: evt.messageId,
        phoneNumberId: evt.phoneNumberId,
      });
    }
    return;
  }

  const tenantSlug = await resolveTenantSlug(env, evt.phoneNumberId);
  if (!tenantSlug) {
    logEvent('whatsapp_message_ignored', {
      reason: 'tenant_not_found',
      organizationFound: false,
      phoneNumberId: evt.phoneNumberId,
      messageId: evt.messageId,
    });
    return;
  }

  let replyText: string;
  let replyMenu: ConversationMenu | undefined;
  try {
    const payload = await loadPayloadBySlug(env, tenantSlug);
    if (!payload || !payload.org) {
      logEvent('whatsapp_message_ignored', {
        reason: 'tenant_payload_not_found',
        organizationFound: false,
        tenantSlug,
        messageId: evt.messageId,
      });
      replyText = FALLBACK_REPLY;
    } else {
      logEvent('whatsapp_organization_found', {
        organizationFound: true,
        tenantSlug,
        orgId: payload.org.id || undefined,
        orgName: payload.org.name || undefined,
        messageId: evt.messageId,
      });
      const data: AssistantData = {
        org: payload.org,
        services: Array.isArray(payload.services) ? payload.services : [],
        barbers: Array.isArray(payload.barbers) ? payload.barbers : [],
        appointments: Array.isArray(payload.appointments) ? payload.appointments : [],
      };

      const now = new Date();
      let previousSession = await getSession(env, evt.from);
      const input = resolveConversationInput(evt.text ?? '', evt.interactive, previousSession.menu);
      const userText = input.text;
      const normalizedMsg = userText.toLowerCase().trim();
      const explicitSelection = input.choice?.selection || {};
      if (/^(menu|in[ií]cio|come[cç]ar|voltar|oi|ol[aá]|bom dia|boa tarde|boa noite)[!. ]*$/i.test(userText.trim())) {
        previousSession = { date: '', serviceId: '', barberId: '', clientName: previousSession.clientName };
      }
      const activeAppointments = findCustomerAppointments(payload, evt.from, now);

      if (input.invalid) {
        const menu = previousSession.menu || welcomeMenu(payload.org.name, evt.profileName || '');
        replyText = `Essa opção não está disponível. Escolha uma das opções desta mensagem.\n\n${menu.text}`;
        replyMenu = { ...menu, text: replyText };
        await saveSession(env, evt.from, { ...previousSession, menu });
      }
      // --- Fase 6: Resposta interativa de conclusão de WhatsApp Flow (nfm_reply) ---
      else if (evt.interactive?.type === 'nfm_reply' && evt.interactive.flowResponse) {
        const flow = evt.interactive.flowResponse;
        const targetServiceId = String(flow.service_id || flow.serviceId || '');
        const targetBarberId = flow.barber_id === 'any' ? '' : String(flow.barber_id || flow.barberId || '');
        const targetDate = String(flow.date || '');
        const requestedTime = String(flow.start_time || flow.time || '');
        const clientName = String(
          flow.client_name || flow.name || evt.profileName || 'Cliente WhatsApp'
        );

        if (targetServiceId && targetDate && requestedTime) {
          // Validação final de disponibilidade (regra do CODEX: nunca confiar em horário anterior)
          const slots = assistantSlots(
            data,
            {
              serviceId: targetServiceId,
              date: targetDate,
              barberId: targetBarberId,
            },
            now
          );

          const matchingSlot = slots.find((s) => s.time === requestedTime);

          if (matchingSlot) {
            const bookingResult = await createWhatsAppBooking(env, {
              tenantSlug,
              clientPhone: evt.from,
              clientName,
              serviceId: targetServiceId,
              barberId: matchingSlot.barberId,
              date: targetDate,
              startTime: matchingSlot.time,
              whatsappMessageId: evt.messageId,
            });

            if (bookingResult.success) {
              await clearSession(env, evt.from);
              const service = data.services.find((s) => s.id === targetServiceId);
              const formattedDate = targetDate.split('-').reverse().join('/');
              const priceFormatted = Number(service?.price || 0).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              });

              replyText = [
                '*Agendamento confirmado via WhatsApp Flow!*',
                '',
                `• *Serviço:* ${service?.name || 'Atendimento'}`,
                `• *Profissional:* ${matchingSlot.barberName}`,
                `• *Data:* ${formattedDate}`,
                `• *Horário:* ${matchingSlot.time}`,
                `• *Valor:* ${priceFormatted}`,
                '',
                'Para confirmar sua presença, responda *CONFIRMAR*. Se precisar reagendar ou cancelar, avise por aqui!',
              ].join('\n');

              logEvent('whatsapp_flow_booking_created', {
                tenantSlug,
                appointmentId: bookingResult.appointment.id,
                date: targetDate,
                time: matchingSlot.time,
              });
            } else {
              replyText = bookingResult.message || FALLBACK_REPLY;
            }
          } else {
            replyText = `Ops, o horário das ${requestedTime} acabou de ser ocupado. Por favor, abra o formulário novamente para escolher outro horário.`;
          }
        } else {
          replyText = 'Não foi possível confirmar os dados enviados pelo formulário. Tente novamente.';
        }
      }
      // --- Fase 5: Consulta de agendamentos existentes ---
      else if (
        /\b(meus agendamentos|meu agendamento|consultar agendamento|qual meu hor[aá]rio|quando [eé] meu hor[aá]rio|tenho agendamento|meus hor[aá]rios)\b/i.test(
          normalizedMsg
        ) &&
        !previousSession.mode
      ) {
        if (!activeAppointments.length) {
          replyText =
            'Você não possui nenhum agendamento futuro no momento. Se quiser marcar um horário, basta dizer o serviço que deseja (ex: "quero corte amanhã").';
        } else {
          const list = activeAppointments
            .map((a) => {
              const dateFormatted = String(a.date || '').split('-').reverse().join('/');
              const price = Number(a.price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
 return `*${a.service_name || 'Atendimento'}* com *${a.barber_name || 'Profissional'}*\n• *Data:* ${dateFormatted} às *${a.start_time}*\n• *Valor:* ${price}`;
            })
            .join('\n\n');

          replyText = [
 '*Seus próximos agendamentos:*',
            '',
            list,
            '',
            'Caso queira *reagendar* ou *cancelar*, basta me avisar por aqui!',
          ].join('\n');
        }
      }
      // --- Fase 5: Fluxo de cancelamento ---
      else if (/\b(confirmar|confirmo|confirma)\b/i.test(normalizedMsg) && !previousSession.mode) {
        const upcoming = activeAppointments.filter((a: any) => a.status === 'scheduled' || a.status === 'confirmed');
        if (!upcoming.length) {
          replyText = 'Não encontrei um agendamento ativo para confirmar. Se precisar de ajuda, é só mandar uma mensagem.';
        } else {
          const target = upcoming[0];
          const confirmResult = await confirmWhatsAppBooking(env, {
            tenantSlug,
            clientPhone: evt.from,
            appointmentId: target.id,
            whatsappMessageId: evt.messageId,
          });

          if (confirmResult.success) {
            const dateFormatted = String(target.date || '').split('-').reverse().join('/');
            replyText = [
              confirmResult.alreadyConfirmed ? '*Sua presença já estava confirmada!*' : '*Presença confirmada!* Te esperamos.',
              '',
              `• *Serviço:* ${target.service_name || 'Atendimento'}`,
              `• *Profissional:* ${target.barber_name || 'Profissional'}`,
              `• *Data:* ${dateFormatted}`,
              `• *Horário:* ${target.start_time}`,
              '',
              'Se precisar remarcar ou cancelar, é só avisar por aqui.',
            ].join('\n');
            logEvent('whatsapp_booking_confirmed', { tenantSlug, appointmentId: target.id, alreadyConfirmed: confirmResult.alreadyConfirmed });
          } else {
            replyText = confirmResult.message || FALLBACK_REPLY;
          }
        }
      }
      else if (/\b(cancelar|desmarcar|cancela|desmarca)\b/i.test(normalizedMsg) && !previousSession.mode) {
        if (!activeAppointments.length) {
          replyText = 'Você não possui nenhum agendamento ativo para cancelar.';
        } else {
          const target = activeAppointments[0];
          const cancelResult = await cancelWhatsAppBooking(env, {
            tenantSlug,
            clientPhone: evt.from,
            appointmentId: target.id,
            whatsappMessageId: evt.messageId,
          });

          if (cancelResult.success) {
            await clearSession(env, evt.from);
            const dateFormatted = String(target.date || '').split('-').reverse().join('/');
            replyText = [
 '*Agendamento cancelado com sucesso!*',
              '',
              `• *Serviço:* ${target.service_name || 'Atendimento'}`,
              `• *Profissional:* ${target.barber_name || 'Profissional'}`,
              `• *Data:* ${dateFormatted}`,
              `• *Horário:* ${target.start_time}`,
              '',
              'O horário foi liberado na agenda. Quando quiser agendar novamente, basta mandar uma mensagem!',
            ].join('\n');

            logEvent('whatsapp_booking_canceled', { tenantSlug, appointmentId: target.id });
          } else {
            replyText = cancelResult.message || FALLBACK_REPLY;
          }
        }
      }
      // --- Fase 5: Início de fluxo de reagendamento ---
      else if (
        /\b(reagendar|remarcar|mudar data|mudar hor[aá]rio|trocar hor[aá]rio|remarca|reagenda)\b/i.test(normalizedMsg) &&
        previousSession.mode !== 'rescheduling'
      ) {
        if (!activeAppointments.length) {
          replyText = 'Você não possui nenhum agendamento ativo para reagendar. Deseja agendar um novo horário?';
        } else {
          const target = activeAppointments[0];
          const guided = inferGuidedIntent(userText, data, now);
          const requestedTime = parseTimeFromText(userText);
          const newDate = guided.date;

          if (newDate && requestedTime) {
            const reschedResult = await rescheduleWhatsAppBooking(env, {
              tenantSlug,
              clientPhone: evt.from,
              appointmentId: target.id,
              newDate,
              newStartTime: requestedTime,
              whatsappMessageId: evt.messageId,
            });

            if (reschedResult.success) {
              await clearSession(env, evt.from);
              const formattedDate = newDate.split('-').reverse().join('/');
              const priceFormatted = Number(reschedResult.appointment.price || 0).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              });

              replyText = [
 '*Agendamento reagendado com sucesso!*',
                '',
                `• *Serviço:* ${reschedResult.appointment.service_name || 'Atendimento'}`,
                `• *Profissional:* ${reschedResult.appointment.barber_name}`,
 `*Nova Data:* ${formattedDate}`,
                `⏰ *Novo Horário:* ${requestedTime}`,
                `• *Valor:* ${priceFormatted}`,
                '',
                'Seu horário anterior foi liberado. Caso precise alterar novamente, avise por aqui!',
              ].join('\n');

              logEvent('whatsapp_booking_rescheduled', {
                tenantSlug,
                appointmentId: target.id,
                newDate,
                newTime: requestedTime,
              });
            } else if (reschedResult.reason === 'slot_unavailable') {
              replyText = [
 `Ops, o horário das ${requestedTime} em ${newDate.split('-').reverse().join('/')} não está disponível! `,
                '',
                'Por favor, escolha outro horário ou envie outra data para reagendar.',
              ].join('\n');
            } else {
              replyText = reschedResult.message || FALLBACK_REPLY;
            }
          } else {
            await saveSession(env, evt.from, {
              date: newDate || target.date,
              serviceId: target.service_id,
              barberId: target.barber_id,
              clientName: target.client_name,
              mode: 'rescheduling',
              reschedulingAppointmentId: target.id,
            });

            const currentFormattedDate = String(target.date || '').split('-').reverse().join('/');
            replyText = [
 '*Reagendamento de Horário:*',
              `Atualmente agendado: *${target.service_name || 'Atendimento'}* com *${target.barber_name}* em *${currentFormattedDate} às ${target.start_time}*.`,
              '',
              'Para qual data ou horário deseja mudar? (Ex: "amanhã às 15:00" ou "quarta-feira às 10h")',
            ].join('\n');
          }
        }
      }
      // --- Fase 5: Continuação de reagendamento ativo na sessão ---
      else if (previousSession.mode === 'rescheduling' && previousSession.reschedulingAppointmentId) {
        const guided = inferGuidedIntent(userText, data, now);
        const targetDate = guided.date || previousSession.date;
        const requestedTime = parseTimeFromText(userText);

        if (targetDate && requestedTime) {
          const reschedResult = await rescheduleWhatsAppBooking(env, {
            tenantSlug,
            clientPhone: evt.from,
            appointmentId: previousSession.reschedulingAppointmentId,
            newDate: targetDate,
            newStartTime: requestedTime,
            whatsappMessageId: evt.messageId,
          });

          if (reschedResult.success) {
            await clearSession(env, evt.from);
            const formattedDate = targetDate.split('-').reverse().join('/');
            const priceFormatted = Number(reschedResult.appointment.price || 0).toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            });

            replyText = [
 '*Agendamento reagendado com sucesso!*',
              '',
              `• *Serviço:* ${reschedResult.appointment.service_name || 'Atendimento'}`,
              `• *Profissional:* ${reschedResult.appointment.barber_name}`,
 `*Nova Data:* ${formattedDate}`,
              `⏰ *Novo Horário:* ${requestedTime}`,
              `• *Valor:* ${priceFormatted}`,
              '',
              'Seu horário anterior foi liberado. Caso precise alterar novamente, avise por aqui!',
            ].join('\n');

            logEvent('whatsapp_booking_rescheduled', {
              tenantSlug,
              appointmentId: previousSession.reschedulingAppointmentId,
              newDate: targetDate,
              newTime: requestedTime,
            });
          } else if (reschedResult.reason === 'slot_unavailable') {
            const freshPayload = await loadPayloadBySlug(env, tenantSlug);
            const freshSlots = assistantSlots(
              {
                org: freshPayload?.org || data.org,
                services: freshPayload?.services || data.services,
                barbers: freshPayload?.barbers || data.barbers,
                appointments: (freshPayload?.appointments || data.appointments).filter(
                  (a: any) => a.id !== previousSession.reschedulingAppointmentId
                ),
              },
              {
                serviceId: previousSession.serviceId,
                date: targetDate,
                barberId: previousSession.barberId,
              },
              now
            );

            const formattedDate = targetDate.split('-').reverse().join('/');
            replyText = [
 `Ops, o horário das ${requestedTime} não está disponível em ${formattedDate}! `,
              '',
              freshSlots.length
                ? `Horários livres nesta data:\n\n${formatSlotsForWhatsApp(freshSlots)}\n\nQual desses você prefere?`
                : `Não encontrei horários livres para esta data. Escolha outro dia.`,
            ].join('\n');
          } else {
            replyText = reschedResult.message || FALLBACK_REPLY;
          }
        } else {
          const effectiveDate = targetDate || previousSession.date;
          await saveSession(env, evt.from, {
            ...previousSession,
            date: effectiveDate,
          });

          const slots = assistantSlots(
            data,
            {
              serviceId: previousSession.serviceId,
              date: effectiveDate,
              barberId: previousSession.barberId,
            },
            now
          );

          const formattedDate = effectiveDate ? effectiveDate.split('-').reverse().join('/') : 'na data';
          replyText = slots.length
            ? `Opções livres para reagendar em ${formattedDate}:\n\n${formatSlotsForWhatsApp(slots)}\n\nQual horário prefere?`
            : `Por favor, informe a nova data e horário desejados (ex: "amanhã às 14:00").`;
        }
      }
      // --- Fases 3 e 4: Fluxo padrão de agendamento por texto ---
      else {
        const { intent: guided } = resolveWhatsAppIntent(userText, data, now);
        const target = sanitizeAssistantSelection({ ...previousSession, ...guided, ...explicitSelection }, data, now);
        const targetServiceId = target.serviceId;
        const targetDate = target.date;
        const targetBarberId = target.barberId;
        const requestedTime = parseTimeFromText(userText);

        if (targetServiceId && targetDate && requestedTime) {
          const slots = assistantSlots(
            data,
            {
              serviceId: targetServiceId,
              date: targetDate,
              barberId: targetBarberId,
            },
            now
          );

          const matchingSlot = slots.find((s) => s.time === requestedTime);

          if (matchingSlot) {
            const crmClient = (payload.clients || []).find(
              (c: any) => normalizeClientPhone(c.phone) === normalizeClientPhone(evt.from)
            );
            const clientName =
              previousSession.clientName ||
              evt.profileName ||
              crmClient?.name ||
              'Cliente WhatsApp';

            const bookingResult = await createWhatsAppBooking(env, {
              tenantSlug,
              clientPhone: evt.from,
              clientName,
              serviceId: targetServiceId,
              barberId: matchingSlot.barberId,
              date: targetDate,
              startTime: matchingSlot.time,
              whatsappMessageId: evt.messageId,
            });

            if (bookingResult.success) {
              await clearSession(env, evt.from);
              const service = data.services.find((s) => s.id === targetServiceId);
              const formattedDate = targetDate.split('-').reverse().join('/');
              const priceFormatted = Number(service?.price || 0).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              });

              replyText = [
                '*Agendamento confirmado!*',
                '',
                `• *Serviço:* ${service?.name || 'Atendimento'}`,
                `• *Profissional:* ${matchingSlot.barberName}`,
                `• *Data:* ${formattedDate}`,
                `• *Horário:* ${matchingSlot.time}`,
                `• *Valor:* ${priceFormatted}`,
                '',
                'Para confirmar sua presença, responda *CONFIRMAR*. Se precisar reagendar ou cancelar, avise por aqui!',
              ].join('\n');

              logEvent('whatsapp_booking_created', {
                tenantSlug,
                appointmentId: bookingResult.appointment.id,
                date: targetDate,
                time: matchingSlot.time,
              });
            } else if (bookingResult.reason === 'slot_unavailable') {
              const freshPayload = await loadPayloadBySlug(env, tenantSlug);
              const freshData: AssistantData = {
                org: freshPayload?.org || data.org,
                services: freshPayload?.services || data.services,
                barbers: freshPayload?.barbers || data.barbers,
                appointments: freshPayload?.appointments || data.appointments,
              };
              const freshSlots = assistantSlots(
                freshData,
                {
                  serviceId: targetServiceId,
                  date: targetDate,
                  barberId: targetBarberId,
                },
                now
              );

              const service = data.services.find((s) => s.id === targetServiceId);
              const formattedDate = targetDate.split('-').reverse().join('/');

              replyText = [
 `Ops, o horário das ${requestedTime} acabou de ser reservado por outro cliente! `,
                '',
                freshSlots.length
                  ? `Aqui estão os outros horários disponíveis para ${service?.name || 'seu corte'} em ${formattedDate}:\n\n${formatSlotsForWhatsApp(freshSlots)}\n\nQual desses você prefere?`
                  : `Não restam mais horários livres para esta data. Tente outra data ou profissional.`,
              ].join('\n');

              logEvent('whatsapp_booking_conflict', { tenantSlug, requestedTime, date: targetDate });
            } else {
              replyText = bookingResult.message || FALLBACK_REPLY;
            }
          } else {
            const formattedDate = targetDate.split('-').reverse().join('/');
            replyText = [
              `O horário das ${requestedTime} não está livre em ${formattedDate}.`,
              '',
              slots.length
                ? `Veja as opções livres disponíveis:\n\n${formatSlotsForWhatsApp(slots)}\n\nQual horário prefere?`
                : `Não encontrei horários livres para esta data. Escolha outra data.`,
            ].join('\n');
          }
        } else {
          const assistantReply = buildWhatsAppAssistantReply(
            data,
            userText,
            previousSession,
            now,
            evt.profileName,
            explicitSelection,
            input.choice?.page
          );
          await saveSession(env, evt.from, {
            date: assistantReply.selection.date,
            serviceId: assistantReply.selection.serviceId,
            barberId: assistantReply.selection.barberId,
            clientName: previousSession.clientName || evt.profileName,
            menu: assistantReply.menu,
          });

          replyText = assistantReply.reply;
          replyMenu = assistantReply.menu;

          logEvent('whatsapp_message_answered', {
            tenantSlug,
            topicResolved: assistantReply.selection.serviceId ? 'availability' : 'other',
            slotsFound: assistantReply.slots.length,
          });
        }
      }
    }
  } catch (error) {
    logEvent('whatsapp_processing_error', {
      tenantSlug,
      error: error instanceof Error ? error.message : 'unknown_error',
    });
    replyText = FALLBACK_REPLY;
  }

  try {
    if (!replyMenu) {
      const session = await getSession(env, evt.from);
      if (session.menu) await saveSession(env, evt.from, { ...session, menu: undefined });
    }
    await sendWhatsAppText(env, evt.from, replyText, evt.phoneNumberId, replyMenu);
    logEvent('whatsapp_message_processed', { tenantSlug, messageId: evt.messageId });
  } catch (error) {
    logEvent('whatsapp_message_failed', {
      tenantSlug,
      messageId: evt.messageId,
      error: error instanceof WhatsAppSendError ? error.message : 'unknown_error',
    });
    throw error;
  }
}
