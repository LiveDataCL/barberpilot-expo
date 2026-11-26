// Run: node --test tests/ritmoYLectura.test.js. Pace marker and caption, bonus sentence by tier, tab label, contrast of every text pair
// in MiEvaluacion and the tab bar (computed from the real palette in src/constants), and the font-size floor.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { COLORS } from '../src/constants/index.js';
import { TEXTOS, FORMA_DTO, esDtoValido, vistaDe, textosDeLaVista } from '../src/services/evaluacion.js';

const DTO = {
  barberName: 'Didian', month: '2026-11', totalScore: 77.5, tier: 'A', tierNombre: 'Muy bueno', bonusTier: 'A', bonusPct: 0.25,
  disqualified: { active: false, reason: null }, groupGoalStatus: 'not_met', carryOverDays: 0, isProvisional: true,
  computedAt: '2026-11-25T12:00:00.000Z', conductRows: [], improvementHints: [], productionProjection: null,
  components: {
    production: { earned: 30, max: 40, detail: { servicios: 14, metaServicios: 15 } }, conduct: { earned: 20, max: 30 },
    punctuality: { earned: 15, max: 15, detail: { lateBlocks: 0, diasSinEntrada: 0, diasSinSalida: 0 } },
    upselling: { earned: 10, max: 10, detail: { conProducto: 3, servicios: 14, umbralPct: 10 } }, tips: { earned: 5, max: 5 },
  },
  metaLocal: { cumplidaPct: 58, faltantePct: 42, cumplida: false, ritmoEsperadoPct: 48 },
};
const conMeta = (m) => ({ ...DTO, metaLocal: m });

// ── the pace marker and caption ──
test('pace: the caption carries the number in words and the note says it is based on elapsed working days', () => {
  const r = vistaDe(DTO).metaLocal.ritmo;
  assert.equal(r.texto, 'Ritmo esperado a hoy: 48 %');
  assert.equal(r.nota, 'Según los días de trabajo transcurridos del mes.');
  assert.equal(r.pct, 48);
});

test('pace: null and undefined (old server) hide the marker and the caption; the rest of the goal block stays', () => {
  const sinKey = { ...DTO.metaLocal }; delete sinKey.ritmoEsperadoPct;
  for (const m of [{ ...DTO.metaLocal, ritmoEsperadoPct: null }, sinKey]) {
    const v = vistaDe(conMeta(m));
    assert.equal(v.metaLocal.ritmo, null);
    assert.equal(v.metaLocal.texto, 'Meta del local: 58 % cumplida · 42 % faltante', 'the goal line still shows');
    assert.equal(/Ritmo esperado/.test(textosDeLaVista(v).join(' | ')), false, 'no caption');
  }
});

test('pace: the validator accepts an answer without the pace key, and one with it null', () => {
  const sinKey = { ...DTO.metaLocal }; delete sinKey.ritmoEsperadoPct;
  assert.equal(esDtoValido(conMeta(sinKey)), true, 'missing key: no block, nothing refused');
  assert.equal(esDtoValido(conMeta({ ...DTO.metaLocal, ritmoEsperadoPct: null })), true, 'null is valid');
  assert.equal(esDtoValido(conMeta({ ...DTO.metaLocal, ritmoEsperadoPct: 48 })), true);
});

test('pace: a non-integer or out-of-range value shows no marker (the view never draws an invalid tick)', () => {
  for (const x of [48.5, -1, 101, '48', NaN]) {
    assert.equal(vistaDe(conMeta({ ...DTO.metaLocal, ritmoEsperadoPct: x })).metaLocal.ritmo, null, String(x));
  }
});

test('pace: the marker is not the only signal (the caption is text) and it does not use a money key', () => {
  const v = vistaDe(DTO);
  assert.equal(typeof v.metaLocal.ritmo.texto, 'string');
  assert.equal(esDtoValido(conMeta({ ...DTO.metaLocal, monto: 5 })), false, 'a money key in metaLocal is refused');
});

test('the allowlist lists ritmoEsperadoPct inside metaLocal and nothing else new', () => {
  assert.deepEqual(Object.keys(FORMA_DTO.metaLocal).sort(), ['cumplida', 'cumplidaPct', 'faltantePct', 'ritmoEsperadoPct']);
});

// ── the bonus sentence by tier ──
test('bonus sentence: tiers B, C, D and X get the owner-approved text', () => {
  for (const t of ['B', 'C', 'D', 'X']) {
    const v = vistaDe({ ...DTO, bonusTier: t, bonusPct: 0, tier: t, tierNombre: 'x' });
    assert.equal(v.bonoNota, 'Este estrato no genera bono. Los estratos S y A sí, si se cumple la meta del grupo.', t);
    assert.equal(v.tierBono, 'Estrato ' + t + ' · 0 %', t + ': the line above stays as it was');
  }
});

test('bonus sentence: S and A keep the current text', () => {
  for (const t of ['S', 'A']) {
    assert.equal(vistaDe({ ...DTO, bonusTier: t }).bonoNota, 'Se paga solo si la meta del grupo se cumple.', t);
  }
});

// The panel's copy of the same text lives in another repository. The check runs only when the file is named explicitly
// (PANEL_EVAL_FILE=<path to barberpilot-control evaluacion-individual.js>); otherwise it is skipped with a message.
test('bonus sentence: the panel carries the same owner-approved text (same copy, both places)', (t) => {
  const panelPath = process.env.PANEL_EVAL_FILE;
  if (!panelPath || !fs.existsSync(panelPath)) {
    t.skip('set PANEL_EVAL_FILE to the panel evaluacion-individual.js to run this cross-repo check');
    return;
  }
  const panel = fs.readFileSync(panelPath, 'utf8');
  assert.match(panel, /Este estrato no genera bono\. Los estratos S y A sí, si se cumple la meta del grupo\./);
  assert.match(panel, /Proyección para fin de mes: /);
  assert.equal(/Ritmo esperado a hoy/.test(panel), false, 'the removed wording is gone from the panel');
});

test('texts: the caption and note are the owner-approved strings', () => {
  assert.equal(TEXTOS.bonoSinBono, 'Este estrato no genera bono. Los estratos S y A sí, si se cumple la meta del grupo.');
  assert.equal(TEXTOS.ritmo(48), 'Ritmo esperado a hoy: 48 %');
});

// ── the tab: label, icon and accessibility; route and screen identifiers unchanged ──
test('tab: the shown label is "Perfil" with the person icon, announced as "Mi perfil"; the route id stays "config"', () => {
  const app = fs.readFileSync(new URL('../App.js', import.meta.url), 'utf8');
  assert.match(app, /\{ id: 'config',\s+label: 'Perfil',\s+accesible: 'Mi perfil',\s+icon: 'user'\s+\}/);
  assert.equal(/label: 'Config'|label: 'Mi perfil'|label: 'Tendenc\./.test(app), false, 'no old label left');
});

test('tab: "Tendencias" is announced in full, the shown label is "Tend."; route id unchanged', () => {
  const app = fs.readFileSync(new URL('../App.js', import.meta.url), 'utf8');
  assert.match(app, /\{ id: 'tendencias', label: 'Tend\.',\s+accesible: 'Tendencias', icon: 'trending-up' \}/);
  assert.match(app, /accessibilityLabel=\{t\.accesible \|\| t\.label\}/);
});

test('tab: each label is one line, accessible as a tab, with no uppercase or wide spacing', () => {
  const app = fs.readFileSync(new URL('../App.js', import.meta.url), 'utf8');
  assert.match(app, /numberOfLines=\{1\}/);
  assert.match(app, /accessibilityRole="tab" accessibilityLabel=\{t\.accesible \|\| t\.label\}/);
  assert.match(app, /accessibilityState=\{\{ selected: active \}\}/);
  const nav = app.slice(app.indexOf('navLabel: {'), app.indexOf('navLabel: {') + 200);
  assert.equal(/textTransform|letterSpacing/.test(nav), false, 'no uppercase, no letter-spacing');
  assert.match(nav, /fontSize: 12/);
});

// ── contrast: every text colour against the background it sits on (WCAG 2.x, ratio ≥ 4.5) ──
const lum = (h) => {
  const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const NAV_BG = '#0a0806', DISQ_BG = '#3a1414', SYNC_BG = '#3a2f10', DISQ_TXT = '#f5b5b5';
const PARES = [
  ['actualizado', COLORS.text2, COLORS.bg], ['sinConexion', COLORS.gold2, SYNC_BG], ['provisional', COLORS.gold2, COLORS.s2],
  ['puntaje', COLORS.gold2, COLORS.bg], ['puntajeMax', COLORS.text2, COLORS.bg], ['tierTxt', COLORS.text, COLORS.s2],
  ['bono', COLORS.text, COLORS.bg], ['bonoNota', COLORS.text2, COLORS.bg], ['metaLocalTxt', COLORS.text, COLORS.bg],
  ['ritmoTxt', COLORS.text, COLORS.bg], ['ritmoNota', COLORS.text2, COLORS.bg], ['disqTxt', DISQ_TXT, DISQ_BG],
  ['proyeccionTxt', COLORS.text, COLORS.s1], ['proyeccionBase', COLORS.text2, COLORS.s1], ['seccion', COLORS.text2, COLORS.s1],
  ['punto', COLORS.text, COLORS.s1], ['detalle', COLORS.text2, COLORS.s1], ['puntoNum', COLORS.text, COLORS.s1],
  ['tend_up', COLORS.ok, COLORS.s1], ['tend_down', COLORS.red, COLORS.s1], ['tend_flat', COLORS.text2, COLORS.s1],
  ['tend_insufficient', COLORS.text3, COLORS.s1], ['mejora', COLORS.text, COLORS.s1], ['avisoTxt', COLORS.text, COLORS.s1],
  ['tab inactive', COLORS.text3, NAV_BG], ['tab active (gold)', COLORS.gold, NAV_BG], ['tab active (red)', COLORS.red, NAV_BG],
  ['tab active (purple)', COLORS.purple, NAV_BG],
];
for (const [nombre, texto, fondo] of PARES) {
  test('contrast ≥ 4.5:1: ' + nombre, () => {
    assert.ok(ratio(texto, fondo) >= 4.5, nombre + ' ' + ratio(texto, fondo).toFixed(2));
  });
}

// ── the font-size floor (no text below 12 sp; secondary 13; body 15) ──
test('font sizes: no text below 12 sp in MiEvaluacion or in the tab bar label', () => {
  const mi = fs.readFileSync(new URL('../src/components/MiEvaluacion.js', import.meta.url), 'utf8');
  const tamMi = [...mi.matchAll(/fontSize: (\d+)/g)].map(m => Number(m[1]));
  assert.ok(tamMi.length > 0);
  assert.ok(Math.min(...tamMi) >= 12, 'MiEvaluacion smallest ' + Math.min(...tamMi));
  const app = fs.readFileSync(new URL('../App.js', import.meta.url), 'utf8');
  const etiqueta = app.slice(app.indexOf('navLabel: {'), app.indexOf('navLabel: {') + 200);
  assert.match(etiqueta, /fontSize: 12/, 'tab bar label is 12 sp');
});

test('font families: MiEvaluacion uses Montserrat (loaded by App.js), not the system default', () => {
  const src = fs.readFileSync(new URL('../src/components/MiEvaluacion.js', import.meta.url), 'utf8');
  const sinFuente = [...src.matchAll(/\{ ([^}]*?)\}/g)].filter(m => /fontSize/.test(m[1]) && !/fontFamily/.test(m[1]));
  assert.equal(sinFuente.length, 0, 'every text style sets a Montserrat family');
  assert.match(src, /const REG = 'Montserrat_400Regular';/);
});
