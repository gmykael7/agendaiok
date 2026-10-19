import type { AssistantSelection } from '../../services/bookingAssistant';
import type { WhatsAppInteractiveData } from './types';

export interface ConversationChoice {
  title: string;
  description?: string;
  text: string;
  selection?: Partial<AssistantSelection>;
  page?: { kind: 'services' | 'slots'; offset: number };
  action?: 'continue_to_slots' | 'add_more_services' | 'clear_services';
}

export interface ConversationMenu {
  text: string;
  layout: 'buttons' | 'list';
  buttonLabel?: string;
  choices: ConversationChoice[];
  token: string;
}

export const MENU_HINT = '_Digite menu para voltar ao início._';

export function createConversationMenu(
  text: string, choices: ConversationChoice[], layout: ConversationMenu['layout'] = 'list',
  buttonLabel = 'Ver opções'
): ConversationMenu {
  return { text, choices, layout, buttonLabel, token: crypto.randomUUID() };
}

export function resolveConversationInput(
  text: string, interactive: WhatsAppInteractiveData | undefined, menu: ConversationMenu | undefined
): { text: string; choice?: ConversationChoice; invalid?: boolean } {
  const id = interactive?.buttonId || interactive?.listId;
  if (id) {
    const index = menu?.choices.findIndex((_, i) => id === `wa:${menu.token}:${i}`) ?? -1;
    return index >= 0 ? { text: menu!.choices[index].text, choice: menu!.choices[index] }
      : { text, invalid: true };
  }
  const numeric = text.trim().match(/^(\d{1,2})[.)]?$/);
  if (numeric && menu) {
    const choice = menu.choices[Number(numeric[1]) - 1];
    return choice ? { text: choice.text, choice } : { text, invalid: true };
  }
  return { text };
}

export function numberedChoices(choices: ConversationChoice[]): string {
  return choices.map((choice, i) => [
    `*${i + 1} · ${choice.title}*`, choice.description,
  ].filter(Boolean).join('\n')).join('\n\n');
}

export function welcomeMenu(orgName: string, clientName: string): ConversationMenu {
  const choices: ConversationChoice[] = [
    { title: 'Agendar um horário', text: 'Agendar' },
    { title: 'Serviços e valores', text: 'Serviços' },
    { title: 'Meus agendamentos', text: 'Meus agendamentos' },
    { title: 'Endereço e horários', text: 'Endereço e expediente' },
  ];
  return createConversationMenu([
    `*Bem-vindo à ${orgName}*`,
    clientName ? `Olá, ${clientName}. Como podemos cuidar de você hoje?` : 'Como podemos cuidar de você hoje?',
    numberedChoices(choices),
    'Abra o menu abaixo ou envie o *número* da opção.',
  ].join('\n\n'), choices, 'list', 'Abrir menu');
}

export function toInteractivePayload(menu: ConversationMenu): Record<string, unknown> | undefined {
  // Mensagens maiores continuam funcionais por texto e pela escolha numérica.
  if (!menu.choices.length || menu.text.length > 1024) return undefined;
  const label = (text: string, limit: number) => {
    if (text.length <= limit) return text;
    const shortened = text.slice(0, limit - 1);
    const boundary = shortened.lastIndexOf(' ');
    return `${boundary > limit / 2 ? shortened.slice(0, boundary) : shortened}…`;
  };
  const rows = menu.choices.slice(0, menu.layout === 'buttons' ? 3 : 10).map((choice, i) => {
    const fullTitle = `${i + 1} · ${choice.title}`;
    const title = label(fullTitle, menu.layout === 'buttons' ? 20 : 24);
    const description = [title === fullTitle ? undefined : choice.title, choice.description]
      .filter(Boolean).join(' · ').slice(0, 72);
    return { id: `wa:${menu.token}:${i}`, title, ...(description ? { description } : {}) };
  });
  return {
    type: menu.layout === 'buttons' ? 'button' : 'list',
    body: { text: menu.text },
    footer: { text: 'AgendAI • Atendimento e agendamento' },
    action: menu.layout === 'buttons'
      ? { buttons: rows.map(({ id, title }) => ({ type: 'reply', reply: { id, title } })) }
      : { button: (menu.buttonLabel || 'Ver opções').slice(0, 20), sections: [{ title: 'Escolha uma opção', rows }] },
  };
}
