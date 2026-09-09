# AgendAI v1.15.2 — TV Multimídia Premium

## Novidades

- Modo TV agora aceita cinco fontes de mídia:
  - YouTube
  - Spotify
  - Apple Music
  - URL direta de áudio/rádio
  - Sem mídia (modo institucional)
- Três visuais de TV:
  - Player grande + fila
  - Logo da empresa + fila
  - Logo + produtos + fila
- Campo de logo próprio do estabelecimento em Ajustes.
- Modo institucional com identidade visual da empresa, aviso, fila e cards de produtos.
- Produtos públicos/ativos com estoque são enviados de forma sanitizada para a TV, sem custo ou margem.
- Cards de produtos alternam automaticamente a cada 6 segundos quando animações estão ativas.
- Opção para ligar/desligar animações.
- Spotify e Apple Music podem ser usados como player principal ou como player compacto sobre o modo institucional.
- Áudio/rádio por URL usa player de áudio com controles e tentativa de reprodução automática.
- Compatibilidade mantida com a configuração antiga `tv_youtube_url`.

## Segurança

- O endpoint público da TV continua sem expor telefone de clientes, dados financeiros privados, custo dos produtos ou margem.
- URLs de mídia, capa e logo são limitadas a HTTP/HTTPS no payload da TV.

## Observação

Navegadores e Smart TVs podem bloquear reprodução automática com áudio. Quando isso ocorrer, basta iniciar o player uma vez com o controle remoto/toque.
