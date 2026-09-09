# AgendAI v1.9 — Modo TV / Painel de Espera

## Novo painel público para recepção
- Nova rota pública: `/tv/:slug`.
- Layout 16:9 pensado para Smart TV, TV Box e computador conectado à televisão.
- Relógio, data, identidade da barbearia, endereço, telefone e status de conexão.
- Fila de atendimento atualizada automaticamente a cada 15 segundos.
- Estados visuais: Em atendimento, Próximo e Aguardando.
- Botão para solicitar tela cheia quando o navegador suporta Fullscreen API.

## Privacidade
- A TV usa endpoint público dedicado `/api/tv`.
- Nunca envia telefone do cliente, e-mail, dados de pagamento, comissão, observações ou templates privados.
- Nomes ficam ocultos por padrão (`Cliente 01`, `Cliente 02`...).
- Opcionalmente o administrador pode mostrar somente nome + inicial do sobrenome (`João M.`).
- Valores ficam ocultos por padrão.

## YouTube / entretenimento
- Campo para playlist ou vídeo do YouTube.
- Reprodução incorporada no painel da recepção com suporte a autoplay/loop quando permitido pelo navegador da TV.
- Quando não há playlist, a tela usa a imagem de capa da barbearia ou a identidade AgendAI.

## QR Code e agendamento
- Card com QR Code apontando para o link público de agendamento da barbearia.
- URL do agendamento também aparece em texto.

## Ajustes
Nova seção `Modo TV • Painel de Espera` com:
- ativar/desativar painel da TV;
- playlist/vídeo do YouTube;
- aviso público;
- mostrar/ocultar nome abreviado do cliente;
- mostrar/ocultar valores;
- copiar link da TV;
- abrir painel da TV em nova aba.

Não há alteração de schema D1 nesta versão; as novas opções ficam dentro do objeto de configuração da organização.
