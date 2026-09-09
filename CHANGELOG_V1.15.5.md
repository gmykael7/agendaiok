# AgendAI v1.15.5 — TV: agendamentos em tempo real corrigidos

## Correções
- Corrigido o uso de data UTC no painel administrativo, que depois das 21h no Brasil podia registrar um novo atendimento como sendo do dia seguinte.
- A TV agora consulta a data comercial do estabelecimento no servidor (padrão America/Fortaleza), sem depender do fuso configurado na Smart TV.
- Novo agendamento é forçado para a área visível da fila por alguns segundos, mesmo quando há muitos horários no dia.
- Proteção contra concorrência no /api/sync: autosave antigo do painel não apaga agendamentos/pedidos públicos que chegaram depois do último snapshot carregado.
- Atualização da TV permanece a cada 5 segundos.

## Banco
- Nenhuma migração D1 necessária.
