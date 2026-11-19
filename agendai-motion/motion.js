'use strict';

/**
 * AgendAi Motion Engine
 * Recriação e orquestração de animações baseadas no Web Animations API (sem dependência de Lottie/GSAP)
 * Configurável via JSON.
 */

const defaults = {
  colors: {
    background: '#e8eee7',
    surface: '#f9faf5',
    ink: '#173e34',
    accent: '#a6dfc3',
    peach: '#edbc9f'
  },
  enter: {
    duration: 650,
    stagger: 75,
    translateY: 24,
    scale: 0.97,
    blur: 6,
    easing: 'cubic-bezier(.22,1,.36,1)'
  },
  exit: {
    duration: 180,
    translateY: -8
  },
  counter: {
    duration: 1000
  },
  bar: {
    duration: 850,
    stagger: 65
  },
  navigation: {
    duration: 500
  },
  reveal: {
    duration: 1050,
    origin: '0% 0%',
    easing: 'cubic-bezier(.76,0,.24,1)'
  }
};

class AgendAiMotion {
  constructor(root, nav, config = defaults) {
    this.root = root;
    this.nav = nav;
    this.version = 0;
    this.frames = [];
    this.animations = [];
    this.config = config;
    this.media = matchMedia('(prefers-reduced-motion: reduce)');
    this.applyColors();
  }

  applyColors() {
    for (const [key, value] of Object.entries(this.config.colors)) {
      document.documentElement.style.setProperty('--' + key, value);
    }
  }

  animate(el, frames, options) {
    const a = el.animate(frames, {
      fill: 'both',
      ...options,
      duration: this.media.matches ? 0 : options.duration,
      delay: this.media.matches ? 0 : options.delay || 0
    });
    this.animations.push(a);
    return a;
  }

  cancel() {
    this.frames.forEach(cancelAnimationFrame);
    this.frames = [];
    this.animations.forEach(a => a.cancel());
    this.animations = [];
  }

  async show(html, page) {
    const version = ++this.version;
    this.cancel();
    const c = this.config;

    // Animação de saída da tela anterior
    if (this.root.children.length) {
      const a = this.animate(
        this.root,
        [
          { opacity: 1, transform: 'translateY(0)' },
          { opacity: 0, transform: `translateY(${c.exit.translateY}px)` }
        ],
        { duration: c.exit.duration }
      );
      await a.finished.catch(() => {});
      if (version !== this.version) return;
    }

    this.root.innerHTML = html;
    this.root.getAnimations().forEach(a => a.cancel());

    // Atualização do indicador de navegação lateral (técnica FLIP)
    const buttons = [...this.nav.querySelectorAll('[data-page]')];
    buttons.forEach(b => b.setAttribute('aria-current', b.dataset.page === page ? 'page' : 'false'));
    const target = buttons.find(b => b.dataset.page === page);
    if (target) {
      const indicator = this.nav.querySelector('#indicator');
      const from = indicator.getBoundingClientRect().top - this.nav.getBoundingClientRect().top;
      indicator.style.top = target.offsetTop + 'px';
      this.animate(
        indicator,
        [
          { transform: `translateY(${from - target.offsetTop}px)` },
          { transform: 'translateY(0)' }
        ],
        { duration: c.navigation.duration, easing: c.enter.easing }
      );
    }

    // Entrada escalonada de cards com blur, translateY e scale
    this.root.querySelectorAll('[data-enter]').forEach((el, i) =>
      this.animate(
        el,
        [
          { opacity: 0, transform: `translateY(${c.enter.translateY}px) scale(${c.enter.scale})`, filter: `blur(${c.enter.blur}px)` },
          { opacity: 1, transform: 'translateY(0) scale(1)', filter: 'blur(0)' }
        ],
        { duration: c.enter.duration, delay: i * c.enter.stagger, easing: c.enter.easing }
      )
    );

    // Barras animadas
    this.root.querySelectorAll('[data-bar]').forEach((el, i) =>
      this.animate(
        el,
        [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }],
        { duration: c.bar.duration, delay: 250 + i * c.bar.stagger, easing: c.enter.easing }
      )
    );

    // Contadores numéricos progressivos
    this.root.querySelectorAll('[data-count]').forEach(el => {
      const end = Number(el.dataset.count);
      const start = performance.now();
      const duration = this.media.matches ? 0 : c.counter.duration;
      const tick = now => {
        if (version !== this.version) return;
        const t = duration ? Math.min((now - start) / duration, 1) : 1;
        el.textContent = Math.round(end * (1 - Math.pow(1 - t, 3))).toLocaleString('pt-BR');
        if (t < 1) this.frames.push(requestAnimationFrame(tick));
      };
      tick(start);
    });
  }

  reveal() {
    const el = document.querySelector('.reveal');
    const c = this.config.reveal;
    el.getAnimations().forEach(a => a.cancel());
    el.style.visibility = 'visible';
    const a = el.animate(
      [
        { clipPath: `circle(150% at ${c.origin})`, opacity: 1 },
        { clipPath: `circle(0% at ${c.origin})`, opacity: 1 }
      ],
      { duration: this.media.matches ? 0 : c.duration, easing: c.easing, fill: 'forwards' }
    );
    a.finished
      .then(() => {
        el.style.visibility = 'hidden';
        a.cancel();
      })
      .catch(() => {});
  }
}

// Helpers de montagem de telas
const card = (title, body, cls = '') =>
  `<section class="card ${cls}" data-enter><h2>${title}</h2>${body}</section>`;

const row = (initial, name, desc, end) =>
  `<div class="row"><span class="avatar">${initial}</span><div class="detail"><strong>${name}</strong><small>${desc}</small></div><span class="pill">${end}</span></div>`;

const bars = () =>
  `<div class="bars">${[45, 67, 92, 58, 78, 35]
    .map(
      (h, i) =>
        `<div class="bar-wrap"><div class="bar" data-bar style="--height:${h}%"></div><small>${['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'][i]}</small></div>`
    )
    .join('')}</div>`;

const heading = (title, subtitle) =>
  `<div class="top" data-enter><div><h1>${title}</h1><p>${subtitle}</p></div><span class="tag">Visão demonstrativa</span></div>`;

// Templates das telas: Agenda, Clientes, Serviços
const screens = {
  agenda: () =>
    heading('Sua agenda, no ritmo certo.', 'Organize o dia. Cuide de cada cliente.') +
    `<div class="grid">
      ${card('Mais tempo para o que importa.', '<p>Agendamentos, clientes e serviços.<br>Tudo conectado em um só lugar.</p>', 'hero')}
      ${card('Agendamentos de hoje', '<div class="metric"><span data-count="24">0</span></div><span class="pill">18 confirmados</span>')}
      ${card('Próximos horários', row('LC', 'Lucas Costa', 'Corte + barba · Rafael', '09:00') + row('AM', 'André Martins', 'Corte masculino · Diego', '09:45') + row('RS', 'Renato Silva', 'Barba · Rafael', '10:30'), 'wide')}
      ${card('Ocupação da semana', bars() + '<p>Seu movimento em um olhar.</p>')}
      ${card('Clientes atendidos', '<div class="metric"><span data-count="83">0</span></div><p>Nesta semana</p>')}
      ${card('Horários disponíveis', '<div class="metric"><span data-count="6">0</span></div><p>Espaço para novos encontros</p>')}
      ${card('Tempo organizado', '<div class="metric"><span data-count="32">0</span><small> h</small></div><p>Reservadas na semana</p>')}
    </div>`,

  clientes: () =>
    heading('Pessoas que voltam.', 'Relacionamento que começa no atendimento.') +
    `<div class="grid">
      ${card('Conheça cada cliente.', '<p>Histórico, frequência e próximos horários.<br>Um atendimento com continuidade.</p>', 'hero')}
      ${card('Clientes cadastrados', '<div class="metric"><span data-count="248">0</span></div><span class="pill">Dados de exemplo</span>')}
      ${card('Clientes', row('LC', 'Lucas Costa', 'Próximo: quarta, 09:00', 'Semanal') + row('AM', 'André Martins', 'Próximo: sexta, 14:00', 'Quinzenal') + row('RS', 'Renato Silva', 'Próximo: sábado, 10:30', 'Mensal') + row('PS', 'Pedro Santos', 'Próximo: terça, 16:00', 'Semanal'), 'wide')}
      ${card('Retorno de clientes', bars() + '<div class="metric"><span data-count="76">0</span><small>%</small></div>')}
    </div>`,

  servicos: () =>
    heading('Cada detalhe tem seu tempo.', 'Serviços organizados para agendar com clareza.') +
    `<div class="grid">
      ${[
        ['✂', 'Corte masculino', '30 minutos', 35],
        ['⌁', 'Barba', '25 minutos', 25],
        ['✳', 'Corte + barba', '50 minutos', 55]
      ]
        .map(
          ([icon, title, time, price]) =>
            card(
              title,
              `<div class="service-art">${icon}</div><p>${time}</p><div class="metric"><small>R$ </small><span data-count="${price}">0</span></div><span class="pill">Disponível para agendamento</span>`,
              'service'
            )
        )
        .join('')}
    </div>`
};

// Inicialização da instância Motion
const motion = new AgendAiMotion(document.querySelector('#screen'), document.querySelector('nav'));
let page = 'agenda';

// Eventos de navegação
document.querySelectorAll('[data-page]').forEach(b =>
  b.addEventListener('click', () => {
    page = b.dataset.page;
    motion.show(screens[page](), page);
  })
);

// Evento de replay da abertura circular
document.querySelector('#replay').addEventListener('click', () => {
  motion.show(screens[page](), page);
  motion.reveal();
});

// Importação e validação de arquivo JSON customizado
document.querySelector('#config').addEventListener('change', async e => {
  try {
    const file = e.target.files[0];
    if (!file) return;
    const input = JSON.parse(await file.text());
    const merged = structuredClone(defaults);

    for (const group of Object.keys(defaults)) {
      if (!input[group]) continue;
      for (const [key, base] of Object.entries(defaults[group])) {
        const value = input[group][key];
        if (value === undefined) continue;
        if (typeof base === 'number') {
          if (!Number.isFinite(value) || Math.abs(value) > 10000) throw Error('Parâmetro numérico inválido');
          if (['duration', 'stagger', 'blur'].includes(key) && value < 0) throw Error('Tempo ou blur negativo');
        } else if (typeof value !== 'string' || value.length > 100) {
          throw Error('Parâmetro inválido');
        }
        if (key === 'easing' && !CSS.supports('animation-timing-function', value)) throw Error('Curva inválida');
        if (group === 'colors' && !CSS.supports('color', value)) throw Error('Cor inválida');
        if (key === 'origin' && !CSS.supports('clip-path', `circle(10% at ${value})`)) throw Error('Origem inválida');
        merged[group][key] = value;
      }
    }

    motion.config = merged;
    motion.applyColors();
    await motion.show(screens[page](), page);
    document.querySelector('#status').textContent = 'JSON aplicado com sucesso!';
  } catch (error) {
    document.querySelector('#status').textContent = 'Não foi possível importar: ' + error.message;
  }
});

// Renderização inicial
motion.show(screens[page](), page);
motion.reveal();

// Exporta globalmente para integração futura
window.AgendAiMotion = AgendAiMotion;
