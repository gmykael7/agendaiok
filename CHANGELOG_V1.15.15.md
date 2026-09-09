# AgendAI v1.15.15 — carregamento com poste de barbeiro

## Interface
- Substituídos os indicadores genéricos das telas de carregamento do app e da página pública por uma animação de poste de barbeiro.
- Preservada a geometria vertical do modelo fornecido, adaptada responsivamente aos cards atuais.
- As listras usam a cor principal configurada pela barbearia e mantêm contraste nos temas claro e escuro.
- O carregamento de telas internas utiliza uma versão compacta para não aumentar o conteúdo.
- A animação é desativada quando o aparelho solicita redução de movimento, mantendo o indicador visível.

## Acessibilidade e funcionamento
- Os textos de carregamento continuam anunciados por leitores de tela.
- Nenhuma regra de sincronização, autenticação, agendamento ou banco de dados foi alterada.

## Banco de dados
Nenhuma alteração no D1. Não é necessário executar `setup:d1`.
