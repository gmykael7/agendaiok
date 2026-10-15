# Vídeo promocional AgendAI

Prévia HTML de 30 segundos, em 1920 × 1080, com animações GSAP. Abra `index.html` no Chrome: a reprodução começa automaticamente. Os controles abaixo da cena permitem pausar, avançar e repetir.

As cinco telas mostram agenda, agendamento online, atendimentos, relacionamento e resultados. Nomes, horários e números nas telas são demonstrativos. As imagens `logo.png` e `mark.png` vieram da identidade visual do projeto.

Os arquivos recebidos estão preservados em `original/`. O JavaScript original terminava no meio de uma instrução; por isso a animação foi reconstruída nos arquivos da pasta principal.

Uma cópia dos arquivos de reprodução está em `public/promo-agendai/` e aparece na página pública do AgendAI logo após a seção inicial. O carregamento começa quando essa seção entra na tela e pausa ao sair dela.

Para captura por quadros, `window.renderFrame(numeroDoQuadro)` posiciona a animação em um dos 900 quadros, a 30 fps. O arquivo HTML depende de conexão para carregar o GSAP pelo CDN. Esta pasta contém a prévia animada, não um MP4 renderizado.
