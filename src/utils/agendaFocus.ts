/**
 * Foco pendente para a Agenda: qual atendimento deve abrir ao entrar na aba.
 * Guardado em memória (não persiste), consumido pela própria Agenda ao destacar o card.
 */
let pendingAppointmentId: string | null = null;

export const setAgendaFocus = (appointmentId: string) => {
  pendingAppointmentId = appointmentId;
};

export const peekAgendaFocus = (): string | null => pendingAppointmentId;

export const consumeAgendaFocus = () => {
  pendingAppointmentId = null;
};
