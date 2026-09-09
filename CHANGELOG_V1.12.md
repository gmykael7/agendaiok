# AgendAI v1.12 — Relatórios + fluxo de atendimento

## Relatórios profissionais
- Nova área **Relatórios e Desempenho** no menu lateral do desktop.
- No celular, os relatórios podem ser abertos diretamente pela tela **Caixa**.
- Filtros por últimos 7 dias, últimos 30 dias, mês atual e mês anterior.
- Indicadores de faturamento, ticket médio, comissões, líquido estimado, faltas e cancelamentos.
- Evolução do faturamento por dia.
- Ranking de serviços mais procurados.
- Desempenho por profissional, produção e comissão.
- Dias e horários mais movimentados.
- Clientes novos x recorrentes.
- Distribuição de recebimentos por Pix, cartão e dinheiro.

## Fluxo de atendimento
Novos estados operacionais:
1. Agendado
2. Confirmado
3. Chegou
4. Em atendimento
5. Concluído

Também foram adicionados:
- **Não compareceu** para registrar faltas sem apagar o histórico.
- **Cancelado** permanece separado de falta.
- Ações rápidas de Confirmar, Chegou, Iniciar, Finalizar e Faltou em Atendimentos.
- Ações de chegada/início/finalização na Agenda mobile e desktop.
- Cores padronizadas para cada estado.

## CRM e TV
- Perfil do cliente passa a mostrar quantidade de faltas.
- Histórico do CRM reconhece Confirmado, Chegou, Em atendimento e Não compareceu.
- TV exibe os estados Confirmado, Chegou e Em atendimento.
- Clientes marcados como Não compareceu deixam de ocupar o horário na agenda pública e interna.

## Notificações
- Central de notificações registra confirmação, chegada, início e falta do cliente.

## Banco de dados
- Nenhuma migração D1 é necessária. Os novos estados usam o armazenamento JSON já existente.
