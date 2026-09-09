# AgendAI v1.15.13 — TV sempre ativa / correção de camada do YouTube

## Correções
- Reforçado o modo TV para navegadores de Smart TV que, após alguns minutos, isolavam o iframe do YouTube em uma camada de vídeo e deixavam o restante do painel invisível.
- O painel inteiro agora é mantido em uma camada de composição ativa.
- O iframe do YouTube usa composição forçada (transform/opacity/filter praticamente imperceptíveis) para evitar promoção para uma camada de hardware independente.
- Adicionado watchdog visual a cada 12 segundos para manter a composição do dashboard ativa, recuperar foco, zerar scroll e renovar Screen Wake Lock quando disponível.
- Adicionado bloqueio/recuperação caso algum elemento de mídia tente assumir fullscreen fora do painel do AgendAI.
- Mantida a atualização dos dados a cada 5 segundos.

## Banco de dados
Nenhuma alteração no D1. Não é necessário executar `setup:d1`.
