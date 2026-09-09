# AgendAI v1.11 — CRM + Central de Notificações

## Central de notificações
- Novo sino no topo com contador de itens não lidos.
- Histórico de novos agendamentos, cancelamentos, alterações de horário e atendimentos concluídos.
- Clique em uma notificação leva diretamente à Agenda ou Atendimentos.
- Marcação individual e opção “Marcar todas como lidas”.
- Estado de leitura e histórico entram na sincronização em nuvem do estabelecimento.
- A API pública de agendamento já registra a notificação no servidor quando um cliente agenda pelo link público.
- O payload público continua sem expor notificações administrativas.

## CRM de clientes
- Tela “Clientes & CRM” com visão de relacionamento.
- Estatísticas calculadas a partir de atendimentos concluídos: total de visitas, total gasto e ticket médio.
- Serviço preferido e profissional mais procurado.
- Próximo atendimento do cliente.
- Histórico individual com status padronizados.
- Observações internas por cliente, sincronizadas junto ao cadastro.
- Filtros de clientes ativos e inativos.
- Janela de inatividade configurável em 30, 45 ou 60 dias e sincronizada no perfil da barbearia.
- Área “Oportunidades de retorno” para clientes inativos com atalho de WhatsApp.

## Compatibilidade
- Sem nova tabela ou migração D1.
- As notificações são armazenadas no snapshot JSON já utilizado pelo AgendAI.
- Mantém compatibilidade com dados anteriores que ainda não possuem o campo `notifications`.
