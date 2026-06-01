'use client';

import { useState, useEffect, useRef } from 'react';

function normalizeAppUrl(value: string | undefined): string {
  const appUrl = value?.trim() || 'https://app.worldporra.com';
  return /^https?:\/\//i.test(appUrl) ? appUrl : `https://${appUrl}`;
}

const APP_URL = normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL);

type Lang = 'en' | 'es';

const I18N = {
  en: {
    page_title: 'World Porra — Predict every match',
    brand: 'World Porra',
    nav_open: 'Open app →',
    hero_eyebrow: 'FIFA World Cup 2026 · Live',
    hero_h1: 'Predict every match.',
    hero_h2: 'Beat your friends.',
    hero_sub: 'A private porra for the 2026 World Cup. Lock in your picks, climb the leaderboard, settle every group-stage debate before kickoff. 104 matches. One champion.',
    hero_cta1: 'Install the app',
    hero_cta2: 'See the demo',
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
    show_cta1: 'See all rules',
    show_cta2: 'How to install',
    rules_kicker: 'Scoring rules',
    rules_h: 'The full points system.',
    rules_sub: 'The same rules shown in the app, with every bonus and multiplier visible before you join a pool.',
    rules_general_h: 'General',
    rules_general_lock: 'Predictions lock 15 minutes before each match.',
    rules_general_official: 'Points are calculated using official FIFA results.',
    rules_general_deadline: 'Tournament winner, group standings and awards must be picked before the first match.',
    rules_general_missing: 'No prediction means 0 points.',
    rules_group_h: 'Group stage matches',
    rules_group_sub: '72 matches · outcome odds × 2 + exact-score bonus',
    rules_group_formula: 'Round(correct outcome odds × 2) + 5 for exact score',
    rules_group_cap: 'Maximum 20 points per match.',
    rules_group_tip: 'Riskier correct picks earn more because longer odds pay more.',
    rules_ko_h: 'Knockout matches',
    rules_ko_sub: 'Pick who advances. Exact-score bonuses grow by round.',
    rules_ko_round: 'Round',
    rules_ko_mult: 'Multiplier',
    rules_ko_bonus: 'Exact bonus',
    rules_ko_r32: 'Round of 32',
    rules_ko_r16: 'Round of 16',
    rules_ko_qf: 'Quarter-finals',
    rules_ko_3rd: '3rd Place',
    rules_ko_sf: 'Semi-finals',
    rules_ko_final: 'Grand Final',
    rules_ko_draw: 'If your score is a draw, also pick who advances on penalties.',
    rules_jokers_h: 'Jokers',
    rules_jokers_group: 'Group-stage joker',
    rules_jokers_group_sub: 'Any match 1-72',
    rules_jokers_ko: 'Knockout joker',
    rules_jokers_ko_sub: 'Any match 73-104',
    rules_jokers_body: 'Each joker doubles the total points you earn on that match. Activate it before kickoff.',
    rules_standings_h: 'Group standings',
    rules_standings_sub: '12 groups · predict the final 1-2-3-4 order',
    rules_standings_first: 'Correct 1st place',
    rules_standings_second: 'Correct 2nd place',
    rules_standings_third: 'Correct 3rd place',
    rules_standings_fourth: 'Correct 4th place',
    rules_standings_perfect: 'Perfect group order',
    rules_standings_consolation: 'Qualified in a different predicted top-3 position',
    rules_standings_note: 'Consolation applies when a team you predicted in the top 3 qualifies, but not in that exact position.',
    rules_honors_h: 'Honors board',
    rules_honors_sub: 'Final Four + individual awards',
    rules_honors_pred: 'Prediction',
    rules_honors_result: 'Actual result',
    rules_honors_points: 'Points',
    rules_honors_champ_1: 'Predicted champion',
    rules_honors_champ_2: 'Predicted champion',
    rules_honors_runner_1: 'Predicted runner-up',
    rules_honors_runner_2: 'Predicted runner-up',
    rules_honors_semi: 'Predicted semi-finalist',
    rules_honors_wins: 'Wins the tournament',
    rules_honors_second: 'Finishes 2nd',
    rules_honors_top4: 'Reaches top 4',
    rules_awards_boot: 'Golden Boot',
    rules_awards_ball: 'Golden Ball',
    rules_awards_young: 'Best Young Player',
    rules_tie_h: 'Tiebreaker',
    rules_tie_1: 'Most exact scores predicted correctly',
    rules_tie_2: 'Most match outcomes predicted correctly',
    rules_tie_3: 'Earliest app registration date',
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
    foot_blurb: 'A private porra for the 2026 FIFA World Cup. Built for friends, family and the office.',
    foot_app: 'App',
    foot_open: 'Open app',
    foot_install: 'Install',
    foot_rules: 'Scoring rules',
    foot_tour: 'Tournament',
    foot_d1: 'Jun 11 — Opening match',
    foot_d2: 'Jun 12 – Jun 27 — Group stage',
    foot_d3: 'Jul 19 — Grand final',
    foot_copy: '© 2026 · World Porra · A friends-only prediction game.',
    foot_disclaimer: 'Not affiliated with FIFA. Made with caffeine and arguments.',
  },
  es: {
    page_title: 'World Porra — Predice cada partido',
    brand: 'World Porra',
    nav_open: 'Abrir app →',
    hero_eyebrow: 'Mundial FIFA 2026 · En vivo',
    hero_h1: 'Predice cada partido.',
    hero_h2: 'Gánale a tus amigos.',
    hero_sub: 'Una porra privada para el Mundial 2026. Bloquea tus picks, escala la clasificación y zanja cualquier debate antes del pitido inicial. 104 partidos. Un campeón.',
    hero_cta1: 'Instalar la app',
    hero_cta2: 'Ver demo',
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
    card1_p: 'Los puntos escalan con las cuotas — apostar por Marruecos contra España vale mucho más que Francia contra Costa Rica. Acierta el resultado exacto y te llevas más puntos. ',
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
    show_cta1: 'Ver reglas completas',
    show_cta2: 'Cómo instalar',
    rules_kicker: 'Reglas de puntos',
    rules_h: 'El sistema completo de puntos.',
    rules_sub: 'Las mismas reglas que aparecen en la app, con cada bonus y multiplicador visible antes de entrar en una porra.',
    rules_general_h: 'General',
    rules_general_lock: 'Los pronósticos se cierran 15 minutos antes de cada partido.',
    rules_general_official: 'Los puntos se calculan usando resultados oficiales de la FIFA.',
    rules_general_deadline: 'Ganador del torneo, grupos y premios deben elegirse antes del primer partido.',
    rules_general_missing: 'Sin pronóstico son 0 puntos.',
    rules_group_h: 'Partidos de fase de grupos',
    rules_group_sub: '72 partidos · cuota del resultado × 2 + bonus por marcador exacto',
    rules_group_formula: 'Redondear(cuota del resultado correcto × 2) + 5 por marcador exacto',
    rules_group_cap: 'Máximo 20 puntos por partido.',
    rules_group_tip: 'Los aciertos más arriesgados dan más puntos porque las cuotas altas pagan más.',
    rules_ko_h: 'Partidos eliminatorios',
    rules_ko_sub: 'Elige quién pasa. Los bonus por marcador exacto crecen por ronda.',
    rules_ko_round: 'Ronda',
    rules_ko_mult: 'Multiplicador',
    rules_ko_bonus: 'Bonus exacto',
    rules_ko_r32: 'Ronda de 32',
    rules_ko_r16: 'Ronda de 16',
    rules_ko_qf: 'Cuartos de final',
    rules_ko_3rd: 'Tercer puesto',
    rules_ko_sf: 'Semifinales',
    rules_ko_final: 'Gran Final',
    rules_ko_draw: 'Si tu marcador es empate, elige también quién pasa en penaltis.',
    rules_jokers_h: 'Comodines',
    rules_jokers_group: 'Comodín de grupos',
    rules_jokers_group_sub: 'Cualquier partido 1-72',
    rules_jokers_ko: 'Comodín de eliminatorias',
    rules_jokers_ko_sub: 'Cualquier partido 73-104',
    rules_jokers_body: 'Cada comodín duplica los puntos totales que ganes en ese partido. Actívalo antes del saque.',
    rules_standings_h: 'Clasificación de grupos',
    rules_standings_sub: '12 grupos · predice el orden final 1-2-3-4',
    rules_standings_first: '1er lugar correcto',
    rules_standings_second: '2do lugar correcto',
    rules_standings_third: '3er lugar correcto',
    rules_standings_fourth: '4to lugar correcto',
    rules_standings_perfect: 'Orden de grupo perfecto',
    rules_standings_consolation: 'Clasificado en otra posición prevista de top 3',
    rules_standings_note: 'La consolación aplica si un equipo que pusiste en el top 3 clasifica, pero no en esa posición exacta.',
    rules_honors_h: 'Cuadro de honor',
    rules_honors_sub: 'Final Four + premios individuales',
    rules_honors_pred: 'Predicción',
    rules_honors_result: 'Resultado real',
    rules_honors_points: 'Puntos',
    rules_honors_champ_1: 'Predijiste campeón',
    rules_honors_champ_2: 'Predijiste campeón',
    rules_honors_runner_1: 'Predijiste subcampeón',
    rules_honors_runner_2: 'Predijiste subcampeón',
    rules_honors_semi: 'Predijiste semifinalista',
    rules_honors_wins: 'Gana el torneo',
    rules_honors_second: 'Queda 2do',
    rules_honors_top4: 'Llega al top 4',
    rules_awards_boot: 'Bota de Oro',
    rules_awards_ball: 'Balón de Oro',
    rules_awards_young: 'Mejor Jugador Joven',
    rules_tie_h: 'Desempate',
    rules_tie_1: 'Mayor número de marcadores exactos acertados',
    rules_tie_2: 'Mayor número de resultados de partido acertados',
    rules_tie_3: 'Fecha de registro más antigua en la app',
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
    foot_copy: '© 2026 · World Porra · Una porra solo para amigos.',
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

const KNOCKOUT_RULES = [
  { labelKey: 'rules_ko_r32', mult: '×2', bonus: '+6 pts' },
  { labelKey: 'rules_ko_r16', mult: '×3', bonus: '+8 pts' },
  { labelKey: 'rules_ko_qf', mult: '×4', bonus: '+10 pts' },
  { labelKey: 'rules_ko_3rd', mult: '×4', bonus: '+10 pts' },
  { labelKey: 'rules_ko_sf', mult: '×5', bonus: '+12 pts' },
  { labelKey: 'rules_ko_final', mult: '×6', bonus: '+15 pts' },
] as const;

const STANDINGS_RULES = [
  { labelKey: 'rules_standings_first', points: '8 pts', highlight: false },
  { labelKey: 'rules_standings_second', points: '6 pts', highlight: false },
  { labelKey: 'rules_standings_third', points: '3 pts', highlight: false },
  { labelKey: 'rules_standings_fourth', points: '3 pts', highlight: false },
  { labelKey: 'rules_standings_perfect', points: '+5 pts', highlight: true },
  { labelKey: 'rules_standings_consolation', points: '2 pts', highlight: false },
] as const;

const HONORS_RULES = [
  { predKey: 'rules_honors_champ_1', resultKey: 'rules_honors_wins', points: '40 pts' },
  { predKey: 'rules_honors_champ_2', resultKey: 'rules_honors_second', points: '15 pts' },
  { predKey: 'rules_honors_runner_1', resultKey: 'rules_honors_second', points: '25 pts' },
  { predKey: 'rules_honors_runner_2', resultKey: 'rules_honors_wins', points: '15 pts' },
  { predKey: 'rules_honors_semi', resultKey: 'rules_honors_top4', points: '15 pts' },
] as const;

type TranslationKey = keyof typeof I18N.en;

export default function LandingPage() {
  const [lang, setLang] = useState<Lang>('en');
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const qrRef = useRef<HTMLCanvasElement>(null);
  const t = I18N[lang];
  const tr = (key: TranslationKey) => t[key];

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
    const url = APP_URL;
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
            <img src="/logo.png" width={32} height={32} alt="" className="brand-mark" />
            <span>{t.brand}</span>
          </a>
          <div className="links">
            <div className="lang-toggle" role="tablist" aria-label="Language">
              <button type="button" className={lang === 'en' ? 'on' : ''} onClick={() => switchLang('en')}>EN</button>
              <button type="button" className={lang === 'es' ? 'on' : ''} onClick={() => switchLang('es')}>ES</button>
            </div>
            <a href="https://github.com/pabloibanezcom/world-porra" target="_blank" rel="noopener noreferrer" className="icon-link" aria-label="GitHub repository" title="View source on GitHub">
              <svg viewBox="0 0 24 24"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-.99-.01-1.95-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.71 1.25 3.37.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.18 1.18a11.04 11.04 0 0 1 5.79 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.58.23 2.75.11 3.04.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.41.35.78 1.05.78 2.12 0 1.53-.01 2.77-.01 3.15 0 .31.21.67.8.55C20.21 21.39 23.5 17.07 23.5 12 23.5 5.65 18.35.5 12 .5z" /></svg>
            </a>
            <a href={APP_URL} className="pill dark sm">{t.nav_open}</a>
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
              <a href={APP_URL} className="pill outline lg">{t.hero_cta2}</a>
            </div>
            <div className="hero-meta reveal d4">
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
                <a href="#scoring" className="pill light lg">{t.show_cta1}</a>
                <a href="#install" className="pill pill-frosted lg">{t.show_cta2}</a>
              </div>
            </div>
            <div className="phone-frame">
              <img src="/screenshots/crop-04-rules.png" alt="Rules" />
            </div>
          </div>
        </div>
      </section>

      {/* Scoring */}
      <section className="scoring" id="scoring">
        <div className="wrap">
          <div className="section-head">
            <div className="reveal">
              <div className="h-eyebrow">{t.rules_kicker}</div>
              <h2>{t.rules_h}</h2>
            </div>
            <p className="reveal d1" style={{ maxWidth: 420, color: '#505a63', fontSize: 16 }}>{t.rules_sub}</p>
          </div>

          <div className="rules-grid">
            <article className="rules-card rules-card-dark reveal">
              <h3>{t.rules_group_h}</h3>
              <p>{t.rules_group_sub}</p>
              <div className="formula-box">
                <span>{t.rules_group_formula}</span>
                <b>{t.rules_group_cap}</b>
              </div>
              <div className="rules-note">{t.rules_group_tip}</div>
            </article>

            <article className="rules-card reveal d1">
              <h3>{t.rules_general_h}</h3>
              <ul className="rules-list">
                <li>{t.rules_general_lock}</li>
                <li>{t.rules_general_official}</li>
                <li>{t.rules_general_deadline}</li>
                <li>{t.rules_general_missing}</li>
              </ul>
            </article>
          </div>

          <div className="rules-grid rules-grid-wide">
            <article className="rules-card reveal">
              <div className="rules-card-head">
                <div>
                  <h3>{t.rules_ko_h}</h3>
                  <p>{t.rules_ko_sub}</p>
                </div>
              </div>
              <div className="rules-table">
                <div className="rules-row rules-row-head">
                  <span>{t.rules_ko_round}</span>
                  <span>{t.rules_ko_mult}</span>
                  <span>{t.rules_ko_bonus}</span>
                </div>
                {KNOCKOUT_RULES.map((rule) => (
                  <div className="rules-row" key={rule.labelKey}>
                    <span>{tr(rule.labelKey)}</span>
                    <b>{rule.mult}</b>
                    <b>{rule.bonus}</b>
                  </div>
                ))}
              </div>
              <div className="rules-note">{t.rules_ko_draw}</div>
            </article>

            <article className="rules-card reveal d1">
              <h3>{t.rules_jokers_h}</h3>
              <div className="joker-pair">
                <div>
                  <b>{t.rules_jokers_group}</b>
                  <span>{t.rules_jokers_group_sub}</span>
                </div>
                <div>
                  <b>{t.rules_jokers_ko}</b>
                  <span>{t.rules_jokers_ko_sub}</span>
                </div>
              </div>
              <div className="joker-mult">×2</div>
              <p>{t.rules_jokers_body}</p>
            </article>
          </div>

          <div className="rules-grid rules-grid-wide">
            <article className="rules-card reveal">
              <h3>{t.rules_standings_h}</h3>
              <p>{t.rules_standings_sub}</p>
              <div className="rules-table compact">
                {STANDINGS_RULES.map((rule) => (
                  <div className={rule.highlight ? 'rules-row highlight' : 'rules-row'} key={rule.labelKey}>
                    <span>{tr(rule.labelKey)}</span>
                    <b>{rule.points}</b>
                  </div>
                ))}
              </div>
              <div className="rules-note">{t.rules_standings_note}</div>
            </article>

            <article className="rules-card reveal d1">
              <h3>{t.rules_honors_h}</h3>
              <p>{t.rules_honors_sub}</p>
              <div className="honors-table">
                <div className="honors-row honors-head">
                  <span>{t.rules_honors_pred}</span>
                  <span>{t.rules_honors_result}</span>
                  <span>{t.rules_honors_points}</span>
                </div>
                {HONORS_RULES.map((rule, index) => (
                  <div className="honors-row" key={`${rule.predKey}-${index}`}>
                    <span>{tr(rule.predKey)}</span>
                    <span>{tr(rule.resultKey)}</span>
                    <b>{rule.points}</b>
                  </div>
                ))}
              </div>
              <div className="award-grid">
                <div><span>{t.rules_awards_boot}</span><b>30 pts</b></div>
                <div><span>{t.rules_awards_ball}</span><b>30 pts</b></div>
                <div><span>{t.rules_awards_young}</span><b>20 pts</b></div>
              </div>
            </article>
          </div>

          <article className="rules-card tiebreak reveal">
            <h3>{t.rules_tie_h}</h3>
            <ol>
              <li>{t.rules_tie_1}</li>
              <li>{t.rules_tie_2}</li>
              <li>{t.rules_tie_3}</li>
            </ol>
          </article>
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
                <a href={APP_URL} className="pill ghost">{t.ios_cta}</a>
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
                <a href={APP_URL} className="pill ghost">{t.and_cta}</a>
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
                <img src="/logo.png" width={32} height={32} alt="" className="brand-mark" />
                <span>World Porra</span>
              </a>
              <p style={{ color: '#505a63', marginTop: 14, fontSize: 14, maxWidth: 340 }}>{t.foot_blurb}</p>
            </div>
            <div>
              <h5>{t.foot_app}</h5>
              <ul>
                <li><a href={APP_URL}>{t.foot_open}</a></li>
                <li><a href="#install">{t.foot_install}</a></li>
                <li><a href="#scoring">{t.foot_rules}</a></li>
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
