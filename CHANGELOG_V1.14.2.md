# AgendAI v1.14.2 — Isolamento de notificações por conta

- Corrige vazamento visual de notificações entre contas no mesmo navegador.
- BroadcastChannel agora é identificado pelo tenant e ignora mensagens de outra conta.
- Evento `storage` não replica mais dados privados entre sessões/contas.
- Logout remove cache local de serviços, agenda, clientes e notificações.
- Backend filtra notificações por `org_id` e normaliza o vínculo ao estabelecimento.
- Sessão de barbeiro preserva apenas notificações dos próprios atendimentos.
