import type { Env } from '../../worker';
import { loadPayloadBySlug } from '../../worker';
import type { WhatsAppEvent } from './types';
import { sendWhatsAppText, WhatsAppSendError } from './client';
import { resolveTenantSlug } from './tenant';
import { getSession, saveSession, clearSession } from './session';
import {
  createWhatsAppBooking,
  cancelWhatsAppBooking,
  confirmWhatsAppBooking,
  rescheduleWhatsAppBooking,
  findCustomerAppointments,
  normalizeClientPhone,
} from './booking';
import {
  answerBookingAssistant,
  assistantSlots,
  inferGuidedIntent,
  validAssistantDate,
  sanitizeAssistantSelection,
  type AssistantData,
  type AssistantSlot,
  type AssistantSelection,
} from '../../services/bookingAssistant';
import type { Service } from '../../types';

function logEvent(event: string, fields: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ event, ...fields, ts: new Date().toISOString() }));
}

const FALLBACK_REPLY =
  'Não consegui consultar a agenda agora. Tente novamente em instantes ou use nosso link de agendamento.';

const MAX_SLOTS_IN_REPLY = 8;

function formatSlotsForWhatsApp(slots: AssistantSlot[]): string {
  const uniqueBarbers = new Set(slots.map((s) => s.barberId)).size > 1;
  return slots
    .slice(0, MAX_SLOTS_IN_REPLY)
    .map((slot) => (uniqueBarbers ? `• *${slot.time}* — ${slot.barberName}` : `• *${slot.time}*`))
    .join('\n');
}

function buildWhatsAppServicesList(services: Service[]): string {
  const active = services.filter((s) => s.active !== false);
  if (!active.length) return 'Não há serviços disponíveis no momento.';
  return active
    .map((s) => {
      const price = Number(s.price || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      });
      const duration = s.duration_minutes ? ` (${s.duration_minutes} min)` : '';
      return `• *${s.name}* — ${price}${duration}`;
    })
    .join('\n');
}

function buildWhatsAppAssistantReply(
  data: AssistantData,
  userText: string,
  session: Partial<AssistantSelection & { clientName?: string }>,
  now: Date,
  profileName?: string
): { reply: string; selection: AssistantSelection; slots: AssistantSlot[] } {
  const guided = inferGuidedIntent(userText, data, now);
  const selection = sanitizeAssistantSelection(
    { ...sanitizeAssistantSelection(session, data, now), ...guided },
    data,
    now
  );
  const clientName = profileName || session.clientName || '';
  const greeting = clientName ? `Olá, *${clientName}*! 👋` : 'Olá! 👋';
  const orgName = data.org?.name || 'nossa barbearia';
  const servicesList = buildWhatsAppServicesList(data.services);

  // 1. Tópico: Serviços e Preços
  if (
    guided.topic === 'services' ||
    /^(servi[cç]os?|pre[cç]os?|tabela|valores?|quanto custa|cardapio|menu)\b/i.test(userText.trim())
  ) {
    return {
      reply: [
        `💈 *Serviços e Valores — ${orgName}:*`,
        '',
        servicesList,
        '',
        '💬 *Qual serviço você gostaria de agendar?*',
        'Basta responder com o nome do serviço e o dia (ex: *"Corte amanhã"*).',
      ].join('\n'),
      selection,
      slots: [],
    };
  }

  // 2. Tópico: Horário de Funcionamento
  if (
    guided.topic === 'hours' ||
    /^(hor[aá]rios? de atendimento|expediente|que horas abre|que horas fecha|funcionamento)\b/i.test(
      userText.trim()
    )
  ) {
    const hours = `Das *${data.org.open_hour || '08:00'}* às *${data.org.close_hour || '20:00'}*`;
    const interval = data.org.break_enabled
      ? `\n• *Intervalo:* ${data.org.break_start} às ${data.org.break_end}`
      : '';
    return {
      reply: [
        `🕒 *Horário de Funcionamento — ${orgName}:*`,
        `• *Atendimento:* ${hours}${interval}`,
        '',
        'Gostaria de agendar um horário para hoje ou amanhã?',
      ].join('\n'),
      selection,
      slots: [],
    };
  }

  // 3. Tópico: Contato / Endereço
  if (
    guided.topic === 'contact' ||
    /^(onde fica|endere[cç]o|localiza[cç][aã]o|telefone|contato)\b/i.test(userText.trim())
  ) {
    const address = data.org.address ? `• *Endereço:* ${data.org.address}` : '';
    const phone = data.org.phone ? `• *Telefone:* ${data.org.phone}` : '';
    const bookingLink = data.org.slug
      ? `• *Agendamento online:* https://meuagendai.fun/${data.org.slug}`
      : '';
    return {
      reply: [`📍 *${orgName}:*`, address, phone, bookingLink].filter(Boolean).join('\n'),
      selection,
      slots: [],
    };
  }

  // 4. Fluxo de Disponibilidade / Agendamento
  if (
    guided.topic === 'availability' ||
    /^(agendar|marcar|quero agendar|quero marcar|marcar horario|agendamento)\b/i.test(userText.trim())
  ) {
    // Caso A: Tem data e tem serviço selecionado -> busca horários livres!
    if (selection.serviceId && selection.date && validAssistantDate(selection.date, now)) {
      const slots = assistantSlots(data, selection, now);
      const service = data.services.find((s) => s.id === selection.serviceId);
      const formattedDate = selection.date.split('-').reverse().join('/');

      if (slots.length) {
        return {
          reply: [
            `Encontrei estes horários livres para *${service?.name || 'Atendimento'}* em *${formattedDate}*:`,
            '',
            formatSlotsForWhatsApp(slots),
            '',
            '👉 *Qual horário fica melhor para você?* Basta responder com o horário (ex: *"14:00"*).',
          ].join('\n'),
          selection,
          slots,
        };
      } else {
        return {
          reply: [
            `Não encontrei horários livres para *${service?.name || 'Atendimento'}* em *${formattedDate}*.`,
            '',
            'Deseja consultar outra data? Basta me dizer (ex: *"Amanhã"* ou *"depois de amanhã"*).',
          ].join('\n'),
          selection,
          slots: [],
        };
      }
    }

    // Caso B: Tem data, mas falta o serviço (ex: cliente disse "Amanhã" ou "Hoje")
    if (selection.date && validAssistantDate(selection.date, now) && !selection.serviceId) {
      const formattedDate = selection.date.split('-').reverse().join('/');
      return {
        reply: [
          `Perfeito para *${formattedDate}*! ✂️`,
          '',
          `Qual serviço você gostaria de realizar?`,
          '',
          servicesList,
          '',
          '💬 Responda com o nome do serviço desejado (ex: *"Corte de Cabelo"*).',
        ].join('\n'),
        selection,
        slots: [],
      };
    }

    // Caso C: Tem serviço, mas falta a data (ex: cliente disse "Quero corte")
    if (selection.serviceId && (!selection.date || !validAssistantDate(selection.date, now))) {
      const service = data.services.find((s) => s.id === selection.serviceId);
      return {
        reply: [
          `Ótima escolha! *${service?.name || 'Atendimento'}* 💈`,
          '',
          'Para qual dia você prefere o agendamento?',
          '• *"Hoje"*',
          '• *"Amanhã"*',
          '• Ou informe uma data (ex: *"sexta-feira"* ou *"20/10"*)',
        ].join('\n'),
        selection,
        slots: [],
      };
    }

    // Caso D: Apenas "Agendar", sem serviço e sem data
    return {
      reply: [
        `📅 *Agendamento na ${orgName}*`,
        '',
        'Para qual dia você gostaria de marcar?',
        '• *"Hoje"*',
        '• *"Amanhã"*',
        '• Ou informe uma data específica (ex: *"quinta-feira"* ou *"20/10"*)',
        '',
        '💡 Se preferir, pode falar tudo junto, por exemplo: *"Quero corte amanhã às 15:00"*.',
      ].join('\n'),
      selection,
      slots: [],
    };
  }

  // 5. Boas-vindas padrão / Menu principal
  return {
    reply: [
      `${greeting} Bem-vindo à *${orgName}*!`,
      '',
      'Como posso te ajudar hoje?',
      '',
      '1️⃣ *Agendar um horário* (ex: "Quero corte amanhã às 15:00")',
      '2️⃣ *Ver serviços e preços* (responda "Serviços")',
      '3️⃣ *Consultar agendamentos* (responda "Meus agendamentos")',
      '4️⃣ *Endereço e expediente* (responda "Endereço")',
      '',
      'Basta responder por aqui com o que você precisa!',
    ].join('\n'),
    selection,
    slots: [],
  };
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
      const userText = evt.text ?? '';
      const normalizedMsg = userText.toLowerCase().trim();
      const previousSession = await getSession(env, evt.from);
      const activeAppointments = findCustomerAppointments(payload, evt.from, now);

      // --- Fase 6: Resposta interativa de conclusão de WhatsApp Flow (nfm_reply) ---
      if (evt.interactive?.type === 'nfm_reply' && evt.interactive.flowResponse) {
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
        const guided = inferGuidedIntent(userText, data, now);
        const targetServiceId = guided.serviceId || previousSession.serviceId;
        const targetDate = guided.date || previousSession.date;
        const targetBarberId = guided.barberId || previousSession.barberId;
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
            evt.profileName
          );
          await saveSession(env, evt.from, {
            date: assistantReply.selection.date,
            serviceId: assistantReply.selection.serviceId,
            barberId: assistantReply.selection.barberId,
            clientName: previousSession.clientName || evt.profileName,
          });

          replyText = assistantReply.reply;

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
    await sendWhatsAppText(env, evt.from, replyText, evt.phoneNumberId);
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
