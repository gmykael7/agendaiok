# AgendAI v1.15.9 — TV persistente / YouTube sem assumir a tela

## Correções
- Adicionado Screen Wake Lock quando suportado pela Smart TV/navegador.
- O Wake Lock é solicitado novamente quando a página volta a ficar visível.
- A TV recupera o foco do painel ao voltar de inatividade.
- O YouTube não pode mais receber foco do controle remoto no modo TV.
- Removida a permissão de fullscreen do iframe do YouTube.
- Adicionados parâmetros `fs=0`, `playsinline=1`, `disablekb=1` e `iv_load_policy=3` ao embed.
- A atualização dos agendamentos permanece a cada 5 segundos.
- Ao retornar de suspensão/visibilidade, a TV força uma nova sincronização dos dados.

## Observação
Algumas Smart TVs possuem protetor de tela/economia de energia próprio do sistema operacional. O AgendAI agora usa as proteções disponíveis no navegador, mas configurações de suspensão da própria TV podem precisar ser desativadas no aparelho.
