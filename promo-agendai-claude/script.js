/* Prévia importada e reconstruída a partir da resposta incompleta do Claude.
   Todos os dados nas telas são demonstrativos. */
const FPS = 30;
const TOTAL = 30;
const schedule = [0, 4, 8, 12, 16, 21, 26, 30];

const screens = [
  `<div class="app-header"><img src="mark.png" alt=""><div><b>Bom dia, equipe</b><small>Quarta-feira, 23 de setembro</small></div><span>GA</span></div>
    <div class="app-content"><div class="app-title">Agenda do dia <small>Hoje</small></div>
    <div class="calendar"><span>SEG<b>21</b></span><span>TER<b>22</b></span><span class="selected">QUA<b>23</b></span><span>QUI<b>24</b></span><span>SEX<b>25</b></span></div>
    <div class="pills"><b>Todos</b><span>Matheus</span><span>Diego</span></div>
    <div class="appt"><time>09:00</time><div><b>João Oliveira</b><small>Corte masculino · Matheus</small></div><i>Confirmado</i></div>
    <div class="appt"><time>10:30</time><div><b>Pedro Lima</b><small>Barba completa · Diego</small></div><i>Confirmado</i></div>
    <div class="appt"><time>14:00</time><div><b>Lucas Martins</b><small>Corte + barba · Matheus</small></div><i class="warm">Aguardando</i></div>
    <div class="appt"><time>16:00</time><div><b>Rafael Costa</b><small>Corte masculino · Diego</small></div><i>Confirmado</i></div></div>`,
  `<div class="shop-cover"><div class="cover-mark">✂</div><b>Barbearia Exemplo</b><small>Seu estilo começa aqui.</small></div>
    <div class="app-content"><div class="mini-label">AGENDAMENTO ONLINE</div><div class="app-title">Escolha seu serviço</div>
    <div class="service selected"><span>✂</span><div><b>Corte masculino</b><small>45 minutos</small></div><strong>R$ 35</strong></div>
    <div class="service"><span>◈</span><div><b>Barba completa</b><small>30 minutos</small></div><strong>R$ 25</strong></div>
    <h3>Profissional</h3><div class="person"><span>M</span><b>Matheus</b><small>Disponível hoje</small><strong>✓</strong></div>
    <h3>Quarta, 23 de setembro</h3><div class="slots"><span>09:00</span><b>10:30</b><span>14:00</span></div>
    <div class="confirm">Confirmar agendamento <b>→</b></div></div>`,
  `<div class="app-header"><img src="mark.png" alt=""><div><b>Atendimentos</b><small>Quarta-feira, 23 de setembro</small></div><span>GA</span></div>
    <div class="app-content"><div class="app-title">Em andamento <small>4 hoje</small></div>
    <div class="status-row"><div><b>01</b><small>Aguardando</small></div><div><b>02</b><small>Atendendo</small></div><div><b>01</b><small>Concluído</small></div></div>
    <div class="visit"><i class="yellow"></i><div><b>Lucas Martins</b><small>Corte + barba · Matheus</small></div><em>Aguardando</em></div>
    <div class="visit highlight"><i class="cyan"></i><div><b>João Oliveira</b><small>Corte masculino · Matheus</small></div><em>Atendendo</em></div>
    <div class="visit"><i class="green"></i><div><b>Pedro Lima</b><small>Barba completa · Diego</small></div><em>Concluído</em></div>
    <div class="screen-button">+ Nova comanda</div></div>`,
  `<div class="app-header"><img src="mark.png" alt=""><div><b>Clientes</b><small>Relacionamento em dia</small></div><span>GA</span></div>
    <div class="app-content"><div class="client-top"><div class="client-avatar">R</div><b>Rafael Alves</b><small>Cliente desde março de 2025</small></div>
    <div class="client-stats"><div><b>12</b><small>Visitas</small></div><div><b>08</b><small>Pontos</small></div><div><b>18/09</b><small>Última visita</small></div></div>
    <h3>Histórico recente</h3><div class="history"><span>✂</span><div><b>Corte masculino</b><small>18 set · Matheus</small></div><strong>R$ 35</strong></div>
    <div class="history"><span>◈</span><div><b>Corte + barba</b><small>23 ago · Diego</small></div><strong>R$ 60</strong></div>
    <div class="campaign"><b>Campanha de retorno</b><small>Mensagem preparada para revisão</small><strong>Revisar no WhatsApp →</strong></div></div>`,
  `<div class="app-header"><img src="mark.png" alt=""><div><b>Visão geral</b><small>Setembro de 2026</small></div><span>GA</span></div>
    <div class="app-content"><div class="app-title">Resultados <small>Este mês</small></div>
    <div class="revenue"><small>FATURAMENTO</small><b>R$ 12.340<sup>,00</sup></b><span>↗ 18% em relação ao mês anterior</span></div>
    <div class="chart"><i style="height:36%"></i><i style="height:52%"></i><i style="height:43%"></i><i style="height:70%"></i><i style="height:59%"></i><i style="height:85%"></i><i style="height:74%"></i><i style="height:100%"></i><i style="height:82%"></i><i style="height:92%"></i></div>
    <div class="metrics"><div><span>✂</span><b>320</b><small>Serviços</small></div><div><span>◫</span><b>85</b><small>Produtos</small></div><div><span>♙</span><b>R$ 2.120</b><small>Comissões</small></div><div><span>✓</span><b>94%</b><small>Ocupação</small></div></div></div>`
];

const copy = [
  ['01 / AGENDA', 'Sua agenda,<br>no <em>controle.</em>', 'Todos os horários. Toda a equipe.<br>Uma rotina que flui.', 'Próximo horário confirmado', 'João Oliveira · 09:00', '✓'],
  ['02 / RESERVAS', 'Seu cliente<br>agenda <em>online.</em>', 'Um link para escolher serviço,<br>profissional e horário.', 'Reserva recebida', 'Corte masculino · 10:30', '↗'],
  ['03 / ATENDIMENTO', 'Cada atendimento,<br><em>organizado.</em>', 'Do primeiro contato<br>ao fechamento da comanda.', 'Comanda #0248', 'Corte + barba · R$ 60,00', '✂'],
  ['04 / RELACIONAMENTO', 'Clientes que<br><em>voltam.</em>', 'Histórico, fidelidade e campanhas<br>feitas para cada público.', 'Fidelidade em movimento', '8 pontos acumulados', '★'],
  ['05 / RESULTADOS', 'Seu negócio<br>em <em>uma visão.</em>', 'Caixa, serviços e equipe<br>no mesmo painel.', 'Resultados em crescimento', 'Visão clara, decisões melhores', '↗']
];

const phone = (content, extra = '') => `<div class="phone ${extra}"><div class="speaker"></div><div class="phone-screen">${content}<div class="bottom-tabs"><span>▦<small>Início</small></span><span>▣<small>Agenda</small></span><span>♙<small>Clientes</small></span><span>◫<small>Caixa</small></span></div></div></div>`;
document.querySelector('#scenes').innerHTML = copy.map((c, i) => `
  <section class="scene product-scene" id="scene-${i + 1}" aria-label="${c[0]}">
    <div class="copy"><div class="eyebrow">${c[0]}</div><h1>${c[1]}</h1><p>${c[2]}</p></div>
    <div class="phone-area">${phone(screens[i])}</div>
    <div class="float-card"><span>${c[5]}</span><div><b>${c[3]}</b><small>${c[4]}</small></div></div>
  </section>`).join('');
document.querySelector('#fan').innerHTML = screens.map((s, i) => phone(s, `fan-phone fan-${i + 1}`)).join('');

const stage = document.querySelector('#stage');
function scaleStage() {
  const mobile = innerWidth < 700;
  const scale = mobile
    ? Math.min(innerWidth / 1250, innerHeight / 1080)
    : Math.min(innerWidth / 1920, (innerHeight - 70) / 1080);
  stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
}
addEventListener('resize', scaleStage);
scaleStage();

const playButton = document.querySelector('#play');
const seek = document.querySelector('#seek');
const time = document.querySelector('#time');
const restart = document.querySelector('#restart');
const scenes = [...document.querySelectorAll('.scene')];
function clock(t) { return `00:${String(Math.min(30, Math.floor(t))).padStart(2, '0')} / 00:30`; }

if (!window.gsap) {
  document.querySelector('#error').hidden = false;
  document.querySelector('#error').textContent = 'GSAP não carregou. Conecte-se à internet e atualize a página.';
} else {
  gsap.set(scenes, { autoAlpha: 0 });
  gsap.set('.float-card', { autoAlpha: 0, y: 75, rotation: -8, scale: .85 });
  gsap.set('.fan-phone', { autoAlpha: 0, y: 250, scale: .65 });
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
  for (let i = 0; i < 7; i++) {
    const start = schedule[i], end = schedule[i + 1];
    const scene = `#scene-${i + 1}`;
    tl.addLabel(`scene-${i + 1}`, start)
      .fromTo(scene, { autoAlpha: 0, filter: 'blur(22px)' }, { autoAlpha: 1, filter: 'blur(0px)', duration: .55 }, start);
    if (i < 5) {
      tl.fromTo(`${scene} .copy > *`, { autoAlpha: 0, y: 60 }, { autoAlpha: 1, y: 0, duration: .8, stagger: .13 }, start + .12)
        .fromTo(`${scene} .phone-area`, { autoAlpha: 0, y: 100, rotationY: -18, scale: .88 }, { autoAlpha: 1, y: 0, rotationY: -9, scale: 1, duration: 1.1 }, start + .12)
        .to(`${scene} .float-card`, { autoAlpha: 1, y: 0, rotation: 0, scale: 1, duration: .7, ease: 'back.out(1.6)' }, start + 1.25)
        .to(`${scene} .phone-area`, { y: -14, rotationY: -5, duration: end - start - 1.5, ease: 'sine.inOut' }, start + 1.45);
    } else if (i === 5) {
      tl.fromTo(`${scene} .fan-heading`, { autoAlpha: 0, y: 45 }, { autoAlpha: 1, y: 0, duration: .8 }, start + .15)
        .fromTo(`${scene} .fan-phone`, { autoAlpha: 0, y: 240, scale: .65 }, { autoAlpha: 1, y: 0, scale: 1, duration: 1.15, stagger: .13, ease: 'back.out(1.3)' }, start + .38)
        .fromTo(`${scene} p`, { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: .7 }, start + 2.1);
    } else {
      tl.fromTo(`${scene} .end-mark`, { autoAlpha: 0, scale: .6, rotation: -18 }, { autoAlpha: 1, scale: 1, rotation: 0, duration: .9 }, start + .2)
        .fromTo(`${scene} .end-logo`, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: .8 }, start + .55)
        .fromTo(`${scene} p, ${scene} .rule, ${scene} span`, { autoAlpha: 0, y: 25 }, { autoAlpha: 1, y: 0, duration: .65, stagger: .13 }, start + 1.05);
    }
    if (i < 6) tl.to(scene, { autoAlpha: 0, filter: 'blur(26px)', scale: 1.045, duration: .55, ease: 'power2.in' }, end - .55);
  }
  tl.to({}, { duration: .01 }, TOTAL - .01);
  tl.eventCallback('onUpdate', () => {
    seek.value = Math.round(tl.time() * FPS);
    time.textContent = clock(tl.time());
  });
  const syncControls = () => {
    seek.value = Math.round(tl.time() * FPS);
    time.textContent = clock(tl.time());
  };
  tl.eventCallback('onComplete', () => { playButton.textContent = '▶ Reproduzir'; });
  window.agendaiPromo = { timeline: tl, fps: FPS, duration: TOTAL, renderFrame(frame) { tl.pause().seek(Math.max(0, Math.min(TOTAL, frame / FPS))); syncControls(); } };
  window.renderFrame = window.agendaiPromo.renderFrame;
  playButton.addEventListener('click', () => {
    if (tl.isActive()) { tl.pause(); playButton.textContent = '▶ Reproduzir'; }
    else { if (tl.time() >= TOTAL) tl.seek(0); tl.play(); playButton.textContent = 'Ⅱ Pausar'; }
  });
  restart.addEventListener('click', () => { tl.pause().seek(0); syncControls(); playButton.textContent = '▶ Reproduzir'; });
  seek.addEventListener('input', () => { tl.pause().seek(Number(seek.value) / FPS); syncControls(); playButton.textContent = '▶ Reproduzir'; });
  addEventListener('keydown', e => {
    if (e.code === 'Space' && e.target.tagName !== 'BUTTON') { e.preventDefault(); playButton.click(); }
    if (e.code === 'ArrowRight') window.renderFrame(Number(seek.value) + 1);
    if (e.code === 'ArrowLeft') window.renderFrame(Number(seek.value) - 1);
  });
  tl.seek(0);
  const startPlayback = () => {
    if (tl.time() >= TOTAL) tl.seek(0);
    tl.play();
    playButton.textContent = 'Ⅱ Pausar';
  };
  addEventListener('message', event => {
    if (event.source !== parent || event.origin !== location.origin) return;
    if (event.data === 'agendai-promo:play') startPlayback();
    if (event.data === 'agendai-promo:pause') {
      tl.pause();
      playButton.textContent = '▶ Reproduzir';
    }
  });
  startPlayback();
}
