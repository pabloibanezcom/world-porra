'use client';

import { useState, useEffect, useRef } from 'react';

const APP_PATH = '/app';

type Lang = 'en' | 'es';

const I18N = {
  en: {
    page_title: 'World Cup Pool — Predict every match',
    brand: 'World Cup Pool',
    nav_open: 'Open app →',
    hero_eyebrow: 'FIFA World Cup 2026 · Live',
    hero_h1: 'Predict every match.',
    hero_h2: 'Beat your friends.',
    hero_sub: 'A private prediction pool for the 2026 World Cup. Lock in your picks, climb the leaderboard, settle every group-stage debate before kickoff. 104 matches. One champion.',
    hero_cta1: 'Install the app',
    hero_cta2: 'See the demo',
    hero_meta1: 'Free for friends & family',
    hero_meta2a: 'iOS',
    hero_meta2b: 'Android',
    hero_meta2c: '· install in 10 seconds',
    stat_matches: 'Matches',
    stat_groups: 'Groups',
    stat_jokers: 'Jokers per player',
    stat_talk: 'Trash talk',
    feat_kicker: "What's inside",
    feat_h: 'Every match, every group, every award — predicted.',
    feat_sub: 'From the opener in Mexico City to the final in MetLife. Your picks lock 15 minutes before kickoff.',
    card1_kicker: 'Predictions',
    card1_h1: 'Pick winners. Pick scores.',
    card1_h2: 'Earn more for the brave call.',
    card1_p: 'Points scale with the odds — calling Morocco over Spain is worth a lot more than France over Costa Rica. Get the exact score and pocket a fat bonus.',
    card2_kicker: 'Leaderboard',
    card2_h1: 'One pool. All your friends.',
    card2_h2: 'One running rank.',
    card2_p: "See who's hot and who's bluffing. Live updates after every match, with exact-score and correct-outcome counts so the bragging is properly receipted.",
    mini1_h: 'Group stage forecasts',
    mini1_p: 'Drag your final group standings before kickoff. Bonus points for getting the exact 1-2-3-4 order.',
    mini2_h: 'Honors board picks',
    mini2_p: 'Champion, runner-up, two semi-finalists. Plus Golden Boot, Golden Ball & Best Young Player.',
    mini3_h: 'Jokers ×2',
    mini3_p: 'Double your points on a single match. One for the group stage, one for the knockouts. Use them wisely.',
    show_eyebrow: 'Scoring rules · clear & fair',
    show_h1: 'Odds-weighted points.',
    show_h2: 'Bonuses for nerve.',
    show_h3: 'Caps so nobody runs away.',
    show_p: 'Open the rules anytime. Group, knockouts, jokers, podium and individual awards — all explained in plain language so the points never feel rigged.',
    show_cta1: 'Open the app',
    show_cta2: 'How to install',
    ins_kicker: 'Get the app',
    ins_h: 'Install on your phone in 10 seconds.',
    ins_sub: 'No app store, no download. The pool is a Progressive Web App — add it to your home screen and it works like a native app, even offline.',
    ios_name: 'iPhone & iPad',
    ios_sub: 'Safari · iOS 14 or later',
    ios_s1_a: 'Open ', ios_s1_b: 'this page', ios_s1_c: ' in ', ios_s1_d: 'Safari', ios_s1_e: ' (not Chrome).',
    ios_s2_a: 'Tap the ', ios_s2_b: 'Share', ios_s2_c: ' button', ios_s2_d: ' in the bottom toolbar.',
    ios_s3_a: 'Scroll down and tap ', ios_s3_b: 'Add to Home Screen', ios_s3_c: '.',
    ios_s4_a: 'Hit ', ios_s4_b: 'Add', ios_s4_c: '. The app icon lands on your home screen.',
    ios_note: "Tip: open from Safari only — the option doesn't appear in Chrome on iOS.",
    ios_cta: 'Open in Safari →',
    and_name: 'Android',
    and_sub: 'Chrome · Android 8 or later',
    and_s1_a: 'Open ', and_s1_b: 'this page', and_s1_c: ' in ', and_s1_d: 'Chrome', and_s1_e: '.',
    and_s2_a: 'Tap the ', and_s2_b: '⋮', and_s2_c: ' menu in the top-right.',
    and_s3_a: 'Tap ', and_s3_b: 'Install app', and_s3_c: ' (or ', and_s3_d: 'Add to Home screen', and_s3_e: ' on older Android).',
    and_s4_a: 'Confirm ', and_s4_b: 'Install', and_s4_c: '. The app icon lands in your launcher.',
    and_note: 'Works in Edge, Brave and Samsung Internet too — look for "Install" in the menu.',
    and_cta: 'Open in Chrome →',
    share_kicker: 'Share with the pool',
    share_h1: 'Send this link to every friend.',
    share_h2: 'The first kickoff is on June 11.',
    share_p: 'Anyone with the link can install. Pools are private — invite by code from inside the app.',
    share_copy: 'Copy',
    share_copied: 'Copied!',
    faq_h: 'A few quick questions.',
    faq1_q: 'Is it free?',
    faq1_a: "Yes. The app is free and pools are private to your group. If you want to play for stakes, set a buy-in pot when you create the league — that's between you and your friends.",
    faq2_q: 'How does scoring work?',
    faq2_a: 'Match outcome points scale with the bookmaker odds — riskier picks pay more. Hit the exact score for a bonus on top. Knockout rounds reward correctly advancing teams with a multiplier (×2 round-of-32 up to ×6 in the final). Each player gets two jokers to double the points on one match per stage.',
    faq3_q: 'When do picks lock?',
    faq3_a: 'Predictions lock 15 minutes before kickoff. Group standings, podium picks and individual award picks must be in before the very first match of the tournament.',
    faq4_q: 'Does it work offline?',
    faq4_a: "Once installed as a Progressive Web App, the interface works offline. Picks sync the next time you connect — but make sure they're submitted before the lock.",
    faq5_q: 'Is this an official FIFA app?',
    faq5_a: 'No. This is an independent prediction pool for friends, not affiliated with or endorsed by FIFA. Match data and team names are used for sporting reference only.',
    foot_blurb: 'A private prediction pool for the 2026 FIFA World Cup. Built for friends, family and the office.',
    foot_app: 'App',
    foot_open: 'Open app',
    foot_install: 'Install',
    foot_rules: 'Scoring rules',
    foot_tour: 'Tournament',
    foot_d1: 'Jun 11 — Opening match',
    foot_d2: 'Jun 12 – Jun 27 — Group stage',
    foot_d3: 'Jul 19 — Grand final',
    foot_copy: '© 2026 · World Cup Pool · A friends-only prediction game.',
    foot_disclaimer: 'Not affiliated with FIFA. Made with caffeine and arguments.',
  },
  es: {
    page_title: 'World Cup Pool — Predice cada partido',
    brand: 'World Cup Pool',
    nav_open: 'Abrir app →',
    hero_eyebrow: 'Mundial FIFA 2026 · En vivo',
    hero_h1: 'Predice cada partido.',
    hero_h2: 'Gánale a tus amigos.',
    hero_sub: 'Una porra privada para el Mundial 2026. Bloquea tus picks, escala la clasificación y zanja cualquier debate antes del pitido inicial. 104 partidos. Un campeón.',
    hero_cta1: 'Instalar la app',
    hero_cta2: 'Ver demo',
    hero_meta1: 'Gratis para amigos y familia',
    hero_meta2a: 'iOS',
    hero_meta2b: 'Android',
    hero_meta2c: '· se instala en 10 segundos',
    stat_matches: 'Partidos',
    stat_groups: 'Grupos',
    stat_jokers: 'Comodines por jugador',
    stat_talk: 'Picarse',
    feat_kicker: 'Qué incluye',
    feat_h: 'Cada partido, cada grupo, cada premio — predicho.',
    feat_sub: 'Desde el partido inaugural en Ciudad de México hasta la final en MetLife. Los picks se cierran 15 minutos antes del saque.',
    card1_kicker: 'Predicciones',
    card1_h1: 'Elige ganadores. Elige el marcador.',
    card1_h2: 'Más puntos por arriesgar.',
    card1_p: 'Los puntos escalan con las cuotas — apostar por Marruecos contra España vale mucho más que Francia contra Costa Rica. Acierta el resultado exacto y te llevas un buen bono.',
    card2_kicker: 'Clasificación',
    card2_h1: 'Una porra. Todos tus amigos.',
    card2_h2: 'Un ranking en vivo.',
    card2_p: 'Mira quién está caliente y quién va de farol. Actualizaciones tras cada partido, con cuentas de exactos y aciertos para que el picarse tenga recibo.',
    mini1_h: 'Predicciones de grupos',
    mini1_p: 'Arrastra el orden final de cada grupo antes del primer partido. Bonus por acertar el orden exacto 1-2-3-4.',
    mini2_h: 'Cuadro de honor',
    mini2_p: 'Campeón, subcampeón y dos semifinalistas. Más Bota de Oro, Balón de Oro y Mejor Jugador Joven.',
    mini3_h: 'Comodines ×2',
    mini3_p: 'Duplica los puntos de un partido. Uno para fase de grupos, otro para eliminatorias. Úsalos con cabeza.',
    show_eyebrow: 'Reglas de puntos · claras y justas',
    show_h1: 'Puntos según cuotas.',
    show_h2: 'Bonus por arriesgar.',
    show_h3: 'Topes para que nadie se escape.',
    show_p: 'Abre las reglas cuando quieras. Grupos, eliminatorias, comodines, podio y premios individuales — todo explicado en lenguaje claro para que los puntos nunca parezcan amañados.',
    show_cta1: 'Abrir la app',
    show_cta2: 'Cómo instalar',
    ins_kicker: 'Consigue la app',
    ins_h: 'Instálala en tu móvil en 10 segundos.',
    ins_sub: 'Sin tienda de apps, sin descargas. La porra es una Progressive Web App — añádela a la pantalla de inicio y funciona como nativa, incluso sin conexión.',
    ios_name: 'iPhone y iPad',
    ios_sub: 'Safari · iOS 14 o superior',
    ios_s1_a: 'Abre ', ios_s1_b: 'esta página', ios_s1_c: ' en ', ios_s1_d: 'Safari', ios_s1_e: ' (no Chrome).',
    ios_s2_a: 'Pulsa el botón ', ios_s2_b: 'Compartir', ios_s2_c: '', ios_s2_d: ' en la barra inferior.',
    ios_s3_a: 'Desliza y pulsa ', ios_s3_b: 'Añadir a pantalla de inicio', ios_s3_c: '.',
    ios_s4_a: 'Pulsa ', ios_s4_b: 'Añadir', ios_s4_c: '. El icono aparece en tu pantalla de inicio.',
    ios_note: 'Tip: ábrelo solo desde Safari — la opción no aparece en Chrome para iOS.',
    ios_cta: 'Abrir en Safari →',
    and_name: 'Android',
    and_sub: 'Chrome · Android 8 o superior',
    and_s1_a: 'Abre ', and_s1_b: 'esta página', and_s1_c: ' en ', and_s1_d: 'Chrome', and_s1_e: '.',
    and_s2_a: 'Pulsa el menú ', and_s2_b: '⋮', and_s2_c: ' arriba a la derecha.',
    and_s3_a: 'Pulsa ', and_s3_b: 'Instalar app', and_s3_c: ' (o ', and_s3_d: 'Añadir a pantalla de inicio', and_s3_e: ' en Android antiguo).',
    and_s4_a: 'Confirma ', and_s4_b: 'Instalar', and_s4_c: '. El icono aparece en tu launcher.',
    and_note: 'También funciona en Edge, Brave y Samsung Internet — busca "Instalar" en el menú.',
    and_cta: 'Abrir en Chrome →',
    share_kicker: 'Compártelo con la porra',
    share_h1: 'Manda este enlace a cada amigo.',
    share_h2: 'El primer partido es el 11 de junio.',
    share_p: 'Cualquiera con el enlace puede instalarlo. Las porras son privadas — se invita por código desde dentro de la app.',
    share_copy: 'Copiar',
    share_copied: '¡Copiado!',
    faq_h: 'Preguntas rápidas.',
    faq1_q: '¿Es gratis?',
    faq1_a: 'Sí. La app es gratis y las porras son privadas para tu grupo. Si queréis jugar con dinero, fija una entrada al crear la liga — eso queda entre vosotros.',
    faq2_q: '¿Cómo funcionan los puntos?',
    faq2_a: 'Los puntos por resultado escalan según las cuotas de las casas — los picks arriesgados pagan más. Acierta el resultado exacto para sumar bonus. Las eliminatorias premian al equipo que avanza con un multiplicador (×2 en dieciseisavos hasta ×6 en la final). Cada jugador tiene dos comodines para duplicar los puntos de un partido por fase.',
    faq3_q: '¿Cuándo se cierran los picks?',
    faq3_a: 'Las predicciones se cierran 15 minutos antes del saque inicial. La clasificación de grupos, los picks del podio y los premios individuales deben enviarse antes del primer partido del torneo.',
    faq4_q: '¿Funciona sin conexión?',
    faq4_a: 'Una vez instalada como PWA, la interfaz funciona sin conexión. Los picks se sincronizan al volver a conectar — pero asegúrate de enviarlos antes del cierre.',
    faq5_q: '¿Es una app oficial de la FIFA?',
    faq5_a: 'No. Es una porra independiente para amigos, sin afiliación ni respaldo de la FIFA. Los datos de partidos y nombres de selecciones se usan solo como referencia deportiva.',
    foot_blurb: 'Una porra privada para el Mundial FIFA 2026. Hecha para amigos, familia y la oficina.',
    foot_app: 'App',
    foot_open: 'Abrir app',
    foot_install: 'Instalar',
    foot_rules: 'Reglas de puntos',
    foot_tour: 'Torneo',
    foot_d1: '11 jun — Partido inaugural',
    foot_d2: '12 jun – 27 jun — Fase de grupos',
    foot_d3: '19 jul — Gran final',
    foot_copy: '© 2026 · World Cup Pool · Una porra solo para amigos.',
    foot_disclaimer: 'Sin afiliación a FIFA. Hecho con cafeína y discusiones.',
  },
} as const;

function hashStr(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) + s.charCodeAt(i)) >>> 0;
  return h;
}

function drawQr(canvas: HTMLCanvasElement, text: string) {
  const ctx = canvas.getContext('2d')!;
  const N = 25, size = canvas.width, cell = size / N;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#0f1115';
  let h = hashStr(text);
  function rnd() { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 0xffffffff; }
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const inFinder = (x < 7 && y < 7) || (x >= N - 7 && y < 7) || (x < 7 && y >= N - 7);
      if (inFinder) continue;
      if (rnd() > 0.55) ctx.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
    }
  }
  function finder(cx: number, cy: number) {
    ctx.fillStyle = '#0f1115';
    ctx.fillRect(cx * cell, cy * cell, 7 * cell, 7 * cell);
    ctx.fillStyle = '#fff';
    ctx.fillRect((cx + 1) * cell, (cy + 1) * cell, 5 * cell, 5 * cell);
    ctx.fillStyle = '#0f1115';
    ctx.fillRect((cx + 2) * cell, (cy + 2) * cell, 3 * cell, 3 * cell);
  }
  finder(0, 0); finder(N - 7, 0); finder(0, N - 7);
  const m = N / 2 - 2;
  ctx.fillStyle = '#fff';
  ctx.fillRect(m * cell, m * cell, 4 * cell, 4 * cell);
  ctx.fillStyle = '#00a87e';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, cell * 1.6, 0, Math.PI * 2);
  ctx.fill();
}

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" style={{ width: '100%', height: '100%', fill: '#0f1115' }}>
    <path d="M12 2a1 1 0 0 1 .7.3l4 4a1 1 0 1 1-1.4 1.4L13 5.4V15a1 1 0 0 1-2 0V5.4L8.7 7.7a1 1 0 1 1-1.4-1.4l4-4A1 1 0 0 1 12 2zM5 12a2 2 0 0 1 2-2h2a1 1 0 0 1 0 2H7v8h10v-8h-2a1 1 0 0 1 0-2h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-8z" />
  </svg>
);

export default function LandingPage() {
  const [lang, setLang] = useState<Lang>('en');
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const qrRef = useRef<HTMLCanvasElement>(null);
  const t = I18N[lang];

  useEffect(() => {
    let l: Lang = 'en';
    try {
      const stored = localStorage.getItem('wcp_lang') as Lang | null;
      if (stored === 'en' || stored === 'es') l = stored;
      else if (navigator.language.toLowerCase().startsWith('es')) l = 'es';
    } catch { /* ignore */ }
    setLang(l);
  }, []);

  useEffect(() => {
    const url = window.location.origin + APP_PATH;
    setShareUrl(url);
    if (qrRef.current) drawQr(qrRef.current, url);
  }, []);

  useEffect(() => {
    document.title = t.page_title;
    document.documentElement.lang = lang;
  }, [lang, t.page_title]);

  useEffect(() => {
    // Scroll reveal
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.reveal').forEach(el => io.observe(el));

    // Stat counters
    const cio = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const el = e.target as HTMLElement;
        const target = +(el.dataset.count ?? 0);
        const dur = 1100;
        const t0 = performance.now();
        function tick(t: number) {
          const p = Math.min(1, (t - t0) / dur);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = String(Math.round(target * eased));
          if (p < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        cio.unobserve(el);
      });
    }, { threshold: 0.4 });
    document.querySelectorAll('[data-count]').forEach(el => cio.observe(el));

    // Hero phone parallax — takes over after entry animation finishes
    const stack = document.querySelector('.phone-stack') as HTMLElement | null;
    const p1 = document.querySelector('.phone.p1') as HTMLElement | null;
    const p2 = document.querySelector('.phone.p2') as HTMLElement | null;
    const p3 = document.querySelector('.phone.p3') as HTMLElement | null;
    let ticking = false;
    function updateParallax() {
      if (!stack) return;
      const r = stack.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const center = r.top + r.height / 2;
      const t = Math.max(-1, Math.min(1, (center - vh / 2) / (vh / 2 + r.height / 2)));
      if (p1) p1.style.transform = `translateY(${t * -22}px) rotate(${-7 + t * -5}deg)`;
      if (p2) p2.style.transform = `translateX(-50%) translateY(${t * -36}px) scale(${1 - Math.abs(t) * 0.02})`;
      if (p3) p3.style.transform = `translateY(${t * -22}px) rotate(${7 + t * 5}deg)`;
      ticking = false;
    }
    function onScroll() { if (ticking) return; ticking = true; requestAnimationFrame(updateParallax); }
    const timer = setTimeout(() => {
      [p1, p2, p3].forEach(el => el && (el.style.animation = 'none'));
      updateParallax();
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll);
    }, 1300);

    // Card + showcase image parallax
    const cardImgs = document.querySelectorAll<HTMLElement>('.card .img-wrap img, .showcase-card .phone-frame img');
    let ticking2 = false;
    function updateCardImgs() {
      const vh = window.innerHeight || 1;
      cardImgs.forEach(img => {
        const r = img.getBoundingClientRect();
        const t = Math.max(-1, Math.min(1, (r.top + r.height / 2 - vh / 2) / (vh / 2)));
        img.style.transform = `translateY(${t * -14}px)`;
      });
    }
    function onScrollCards() { if (ticking2) return; ticking2 = true; requestAnimationFrame(() => { updateCardImgs(); ticking2 = false; }); }
    window.addEventListener('scroll', onScrollCards, { passive: true });
    updateCardImgs();

    return () => {
      io.disconnect();
      cio.disconnect();
      clearTimeout(timer);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScrollCards);
    };
  }, []);

  const switchLang = (l: Lang) => {
    setLang(l);
    try { localStorage.setItem('wcp_lang', l); } catch { /* ignore */ }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      try {
        const el = document.getElementById('urlInput') as HTMLInputElement;
        el.select();
        document.execCommand('copy');
      } catch { /* ignore */ }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <>
      {/* Nav */}
      <nav className="top">
        <div className="wrap row">
          <a href="#" className="brand">
            <span className="brand-mark"><span className="brand-mark-dot" /></span>
            <span>{t.brand}</span>
          </a>
          <div className="links">
            <div className="lang-toggle" role="tablist" aria-label="Language">
              <button type="button" className={lang === 'en' ? 'on' : ''} onClick={() => switchLang('en')}>EN</button>
              <button type="button" className={lang === 'es' ? 'on' : ''} onClick={() => switchLang('es')}>ES</button>
            </div>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="icon-link" aria-label="GitHub repository" title="View source on GitHub">
              <svg viewBox="0 0 24 24"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-.99-.01-1.95-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.71 1.25 3.37.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.18 1.18a11.04 11.04 0 0 1 5.79 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.58.23 2.75.11 3.04.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.41.35.78 1.05.78 2.12 0 1.53-.01 2.77-.01 3.15 0 .31.21.67.8.55C20.21 21.39 23.5 17.07 23.5 12 23.5 5.65 18.35.5 12 .5z" /></svg>
            </a>
            <a href={APP_PATH} className="pill dark">{t.nav_open}</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="hero">
        <div className="wrap hero-grid">
          <div>
            <span className="eyebrow reveal">
              <span className="eyebrow-dot" />
              {t.hero_eyebrow}
            </span>
            <h1 className="display hero-h reveal d1">
              {t.hero_h1} <em>{t.hero_h2}</em>
            </h1>
            <p className="hero-sub reveal d2">{t.hero_sub}</p>
            <div className="hero-cta reveal d3">
              <a href="#install" className="pill dark lg">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2a1 1 0 0 1 1 1v10.59l3.3-3.3a1 1 0 0 1 1.4 1.42l-5 5a1 1 0 0 1-1.4 0l-5-5a1 1 0 0 1 1.4-1.42l3.3 3.3V3a1 1 0 0 1 1-1Zm-7 17h14a1 1 0 1 1 0 2H5a1 1 0 1 1 0-2Z" />
                </svg>
                {t.hero_cta1}
              </a>
              <a href={APP_PATH} className="pill outline lg">{t.hero_cta2}</a>
            </div>
            <div className="hero-meta reveal d4">
              <span className="hero-meta-item">
                <span className="hero-meta-dot" />
                {t.hero_meta1}
              </span>
              <span className="hero-meta-item">
                <b>{t.hero_meta2a}</b> + <b>{t.hero_meta2b}</b> {t.hero_meta2c}
              </span>
            </div>
          </div>

          <div className="phone-stack" aria-hidden="true">
            <div className="phone p1"><img src="/screenshots/crop-03-table.png" alt="Leaderboard" /></div>
            <div className="phone p2"><img src="/screenshots/crop-01-home.png" alt="Home" /></div>
            <div className="phone p3"><img src="/screenshots/crop-02-picks.png" alt="My picks" /></div>
          </div>
        </div>
      </header>

      {/* Stats strip */}
      <section className="strip">
        <div className="wrap">
          <div className="stat-row">
            <div className="stat reveal"><div className="num" data-count="104" suppressHydrationWarning>0</div><div className="lbl">{t.stat_matches}</div></div>
            <div className="stat reveal d1"><div className="num" data-count="12" suppressHydrationWarning>0</div><div className="lbl">{t.stat_groups}</div></div>
            <div className="stat reveal d2"><div className="num" data-count="2" suppressHydrationWarning>0</div><div className="lbl">{t.stat_jokers}</div></div>
            <div className="stat reveal d3"><div className="num">∞</div><div className="lbl">{t.stat_talk}</div></div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features">
        <div className="wrap">
          <div className="section-head">
            <div className="reveal">
              <div className="h-eyebrow">{t.feat_kicker}</div>
              <h2>{t.feat_h}</h2>
            </div>
            <p className="reveal d1" style={{ maxWidth: 340, color: '#505a63', fontSize: 16 }}>{t.feat_sub}</p>
          </div>

          <div className="feature-grid">
            <div className="card tall reveal">
              <div className="kicker">{t.card1_kicker}</div>
              <h3>{t.card1_h1}<br />{t.card1_h2}</h3>
              <p>{t.card1_p}</p>
              <div className="img-wrap"><img src="/screenshots/crop-02-picks.png" alt="Picks screen" /></div>
            </div>
            <div className="card dark tall reveal d1">
              <div className="kicker">{t.card2_kicker}</div>
              <h3>{t.card2_h1}<br />{t.card2_h2}</h3>
              <p>{t.card2_p}</p>
              <div className="img-wrap"><img src="/screenshots/crop-03-table.png" alt="Leaderboard" /></div>
            </div>
          </div>

          <div className="feature-row">
            <div className="mini reveal">
              <div className="badge b-teal">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-7H10v7H6a2 2 0 0 1-2-2v-9z" />
                </svg>
              </div>
              <h4>{t.mini1_h}</h4>
              <p>{t.mini1_p}</p>
            </div>
            <div className="mini reveal d1">
              <div className="badge b-blue">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                  <path d="M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0z" />
                </svg>
              </div>
              <h4>{t.mini2_h}</h4>
              <p>{t.mini2_p}</p>
            </div>
            <div className="mini reveal d2">
              <div className="badge b-orange">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
                  <path d="M9 8l6 8M15 8l-6 8" />
                </svg>
              </div>
              <h4>{t.mini3_h}</h4>
              <p>{t.mini3_p}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Showcase */}
      <section className="showcase">
        <div className="wrap">
          <div className="showcase-card reveal">
            <div>
              <span className="eyebrow showcase-eyebrow">{t.show_eyebrow}</span>
              <h3>{t.show_h1}<br />{t.show_h2}<br />{t.show_h3}</h3>
              <p>{t.show_p}</p>
              <div className="showcase-cta">
                <a href={APP_PATH} className="pill light lg">{t.show_cta1}</a>
                <a href="#install" className="pill pill-frosted lg">{t.show_cta2}</a>
              </div>
            </div>
            <div className="phone-frame">
              <img src="/screenshots/crop-04-rules.png" alt="Rules" />
            </div>
          </div>
        </div>
      </section>

      {/* Install */}
      <section className="install" id="install">
        <div className="wrap">
          <div className="section-head">
            <div className="reveal">
              <div className="h-eyebrow">{t.ins_kicker}</div>
              <h2>{t.ins_h}</h2>
            </div>
            <p className="reveal d1" style={{ maxWidth: 380, color: '#505a63', fontSize: 16 }}>{t.ins_sub}</p>
          </div>

          <div className="install-grid">
            {/* iOS */}
            <div className="install-card reveal">
              <header>
                <div className="os-mark">
                  <svg viewBox="0 0 24 24">
                    <path d="M16.7 13c0-2.3 1.9-3.4 2-3.4-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.9-.8-3.1-.8-1.6 0-3.1.9-3.9 2.4-1.7 2.9-.4 7.2 1.2 9.6.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8 1.5 0 1.9.8 3.1.8 1.3 0 2.1-1.2 2.9-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.7-1-2.7-4.1zM14.6 6.3c.6-.8 1-1.9.9-3-.9 0-2 .6-2.7 1.4-.6.7-1.1 1.8-1 2.9 1.1.1 2.1-.5 2.8-1.3z" />
                  </svg>
                </div>
                <div>
                  <div className="os-name">{t.ios_name}</div>
                  <div className="os-sub">{t.ios_sub}</div>
                </div>
              </header>
              <ol className="steps">
                <li><span>{t.ios_s1_a}<b>{t.ios_s1_b}</b>{t.ios_s1_c}<b>{t.ios_s1_d}</b>{t.ios_s1_e}</span></li>
                <li>
                  <span>
                    {t.ios_s2_a}<b>{t.ios_s2_b}</b>{t.ios_s2_c}
                    <span className="step-icon"><ShareIcon /></span>
                    {t.ios_s2_d}
                  </span>
                </li>
                <li><span>{t.ios_s3_a}<b>{t.ios_s3_b}</b>{t.ios_s3_c}</span></li>
                <li><span>{t.ios_s4_a}<b>{t.ios_s4_b}</b>{t.ios_s4_c}</span></li>
              </ol>
              <div className="install-foot">
                <div className="note">{t.ios_note}</div>
                <a href={APP_PATH} className="pill ghost">{t.ios_cta}</a>
              </div>
            </div>

            {/* Android */}
            <div className="install-card reveal d1">
              <header>
                <div className="os-mark" style={{ background: '#00a87e' }}>
                  <svg viewBox="0 0 24 24">
                    <path d="M17.5 13c-.3 0-.6.3-.6.6s.3.6.6.6.6-.3.6-.6-.3-.6-.6-.6zm-11 0c-.3 0-.6.3-.6.6s.3.6.6.6.6-.3.6-.6-.3-.6-.6-.6zm10.7-4.4l1.1-1.9c.1-.1.1-.3-.1-.4-.1-.1-.3-.1-.4.1l-1.1 1.9c-1.1-.5-2.4-.8-3.7-.8s-2.6.3-3.7.8L7.2 6.4c-.1-.1-.3-.2-.4-.1-.1.1-.2.3-.1.4l1.1 1.9C5.5 9.7 4 11.6 4 14h16c0-2.4-1.5-4.3-3.8-5.4zM4 15v4c0 1.1.9 2 2 2h1v3h2v-3h6v3h2v-3h1c1.1 0 2-.9 2-2v-4H4z" />
                  </svg>
                </div>
                <div>
                  <div className="os-name">{t.and_name}</div>
                  <div className="os-sub">{t.and_sub}</div>
                </div>
              </header>
              <ol className="steps">
                <li><span>{t.and_s1_a}<b>{t.and_s1_b}</b>{t.and_s1_c}<b>{t.and_s1_d}</b>{t.and_s1_e}</span></li>
                <li><span>{t.and_s2_a}<b>{t.and_s2_b}</b>{t.and_s2_c}</span></li>
                <li><span>{t.and_s3_a}<b>{t.and_s3_b}</b>{t.and_s3_c}<b>{t.and_s3_d}</b>{t.and_s3_e}</span></li>
                <li><span>{t.and_s4_a}<b>{t.and_s4_b}</b>{t.and_s4_c}</span></li>
              </ol>
              <div className="install-foot">
                <div className="note">{t.and_note}</div>
                <a href={APP_PATH} className="pill ghost">{t.and_cta}</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Share */}
      <section className="share">
        <div className="wrap">
          <div className="share-card reveal">
            <div>
              <div className="share-kicker">{t.share_kicker}</div>
              <h3 style={{ marginTop: 12 }}>{t.share_h1}<br />{t.share_h2}</h3>
              <p>{t.share_p}</p>
              <div className="url-row">
                <input id="urlInput" readOnly value={shareUrl} />
                <button className="pill light" style={{ padding: '10px 22px' }} onClick={handleCopy}>
                  {copied ? t.share_copied : t.share_copy}
                </button>
              </div>
            </div>
            <div className="qr-box" aria-label="QR code">
              <canvas ref={qrRef} width="320" height="320" />
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="faq">
        <div className="wrap" style={{ maxWidth: 880 }}>
          <h2 className="display faq-h reveal">{t.faq_h}</h2>
          <div className="faq-list">
            {([
              [t.faq1_q, t.faq1_a, true],
              [t.faq2_q, t.faq2_a],
              [t.faq3_q, t.faq3_a],
              [t.faq4_q, t.faq4_a],
              [t.faq5_q, t.faq5_a],
            ] as [string, string, boolean?][]).map(([q, a, open]) => (
              <details key={q} className="faq-item" open={open}>
                <summary><span>{q}</span></summary>
                <div className="a">{a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer>
        <div className="wrap">
          <div className="foot-row">
            <div>
              <a href="#" className="brand">
                <span className="brand-mark"><span className="brand-mark-dot" /></span>
                <span>World Cup Pool</span>
              </a>
              <p style={{ color: '#505a63', marginTop: 14, fontSize: 14, maxWidth: 340 }}>{t.foot_blurb}</p>
            </div>
            <div>
              <h5>{t.foot_app}</h5>
              <ul>
                <li><a href={APP_PATH}>{t.foot_open}</a></li>
                <li><a href="#install">{t.foot_install}</a></li>
                <li><a href={APP_PATH}>{t.foot_rules}</a></li>
              </ul>
            </div>
            <div>
              <h5>{t.foot_tour}</h5>
              <ul>
                <li><a href="#">{t.foot_d1}</a></li>
                <li><a href="#">{t.foot_d2}</a></li>
                <li><a href="#">{t.foot_d3}</a></li>
              </ul>
            </div>
          </div>
          <div className="foot-meta">
            <div>{t.foot_copy}</div>
            <div>{t.foot_disclaimer}</div>
          </div>
        </div>
      </footer>
    </>
  );
}

