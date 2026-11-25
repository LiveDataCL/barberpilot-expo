// Run: node --test tests/evaluacion.test.js   (Node >= 22.7, ESM syntax auto-detected). No dependencies.
// Mi evaluación: the state rules (online, offline, no evaluation, errors), the copy, the allowlist of the answer, and the absence of money,
// other barbers and a month selector. The screen itself is checked by reading its source (no React Native runtime in this test).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TEXTOS, FORMA_DTO, esDtoValido, horaDe, mesDe, resolverEstado, vistaDe, textosDeLaVista } from '../src/services/evaluacion.js';

const DTO = {
  barberName: 'Didian', month: '2026-11', totalScore: 8.4, tier: 'D', tierNombre: 'Insuficiente',
  disqualified: { active: false, reason: null },
  components: {
    production: { earned: 8.4, max: 40, detail: { servicios: 6, metaServicios: 128 } },
    conduct: { earned: 0, max: 30 },
    punctuality: { earned: 12, max: 15, detail: { lateBlocks: 0, diasSinEntrada: 2, diasSinSalida: 1 } },
    upselling: { earned: 0, max: 10, detail: { conProducto: 0, servicios: 6, umbralPct: 10 } },
    tips: { earned: 5, max: 5 },
  },
  conductRows: [
    { label: 'Orden de estación', monthlyAvg: 0, trend: 'flat' },
    { label: 'Aseo entre trabajos', monthlyAvg: 6.5, trend: 'up' },
    { label: 'Atención al cliente', monthlyAvg: 4, trend: 'insufficient' },
  ],
  carryOverDays: 2, bonusTier: 'A', bonusPct: 0.25, groupGoalStatus: 'not_met',
  metaLocal: { cumplidaPct: 62, faltantePct: 38, cumplida: false },
  isProvisional: true, computedAt: '2026-11-25T15:09:00.000Z',
  improvementHints: [{ component: 'production', text: 'Te faltan 10 servicios para la meta individual de servicios del mes (hasta +30 pts)' }],
  productionProjection: { projectedPoints: 8.6, max: 40, basisDays: 21, isEstimate: true },
};
const conDisq = { ...DTO, disqualified: { active: true, reason: 'Descalificado este mes' }, bonusPct: null, bonusTier: 'X' };
const cache = { guardado: '2026-11-25T12:02:00.000Z', dto: DTO };

// ── the answer's shape (allowlist) ──
test('a valid answer passes the allowlist', () => {
  assert.equal(esDtoValido(DTO), true);
  assert.equal(esDtoValido({ ...DTO, productionProjection: null }), true, 'no estimate is allowed');
});

test('an extra key anywhere refuses the answer (no money or other barber can slip in)', () => {
  assert.equal(esDtoValido({ ...DTO, bono_a_pagar: 123456 }), false, 'top level');
  assert.equal(esDtoValido({ ...DTO, components: { ...DTO.components, tips: { earned: 5, max: 5, monto: 9000 } } }), false, 'nested');
  assert.equal(esDtoValido({ ...DTO, productionProjection: { ...DTO.productionProjection, facturacion: 1 } }), false, 'estimate');
  assert.equal(esDtoValido({ ...DTO, conductRows: [{ label: 'x', monthlyAvg: 1, trend: 'up', otro: 'Ana' }] }), false, 'list item');
});

test('a missing key refuses the answer', () => {
  const sin = { ...DTO }; delete sin.tier;
  assert.equal(esDtoValido(sin), false);
  assert.equal(esDtoValido(null), false);
  assert.equal(esDtoValido('texto'), false);
});

test('the allowlist lists the fields of the API answer, and nothing else', () => {
  assert.deepEqual(Object.keys(FORMA_DTO).sort(), Object.keys(DTO).sort());
});

// ── the state rules ──
test('online: the answer is shown, labelled with its time, and stored', () => {
  const r = resolverEstado({ status: 200, cuerpo: { ok: true, disponible: true, evaluacion: DTO }, cache: null });
  assert.equal(r.tipo, 'ok');
  assert.equal(r.guardar, true);
  assert.match(r.hora, /^\d\d:\d\d$/);
});

test('no evaluation this month (inactive or no period): the message, and the cache is cleared', () => {
  const r = resolverEstado({ status: 200, cuerpo: { ok: true, disponible: false, mensaje: 'Sin evaluación este mes' }, cache });
  assert.equal(r.tipo, 'sin_evaluacion');
  assert.equal(r.mensaje, 'Sin evaluación este mes');
  assert.equal(r.borrarCache, true);
  assert.equal(r.dto, undefined, 'no data');
});

test('403 (master-PIN session or inactive staff): the message, never the cached data', () => {
  const r = resolverEstado({ status: 403, cuerpo: { ok: false }, cache });
  assert.equal(r.tipo, 'sin_evaluacion');
  assert.equal(r.dto, undefined);
  assert.equal(r.borrarCache, true);
});

test('401: the session message (the App returns to the login)', () => {
  const r = resolverEstado({ status: 401, cuerpo: null, cache });
  assert.equal(r.tipo, 'sesion');
  assert.equal(r.dto, undefined);
});

test('offline with a cached answer: the last good answer, labelled "sin conexión — datos de hh:mm"', () => {
  const r = resolverEstado({ redErr: true, cache });
  assert.equal(r.tipo, 'sin_conexion');
  assert.equal(r.dto, DTO);
  assert.equal(r.hora, horaDe(cache.guardado));
  assert.equal(r.guardar, false, 'the cached answer is not rewritten');
  assert.equal(`${TEXTOS.sinConexion} ${r.hora}`, `sin conexión — datos de ${r.hora}`);
});

test('a server error (5xx) with a cached answer: the same offline view', () => {
  const r = resolverEstado({ status: 503, cuerpo: null, cache });
  assert.equal(r.tipo, 'sin_conexion');
});

test('offline with no cache: the error message, no data', () => {
  const r = resolverEstado({ redErr: true, cache: null });
  assert.equal(r.tipo, 'error');
  assert.equal(r.mensaje, TEXTOS.errorCarga);
  assert.equal(r.dto, undefined);
});

test('a 200 whose answer does not match the allowlist: nothing new is shown, the cache stays', () => {
  const r = resolverEstado({ status: 200, cuerpo: { ok: true, disponible: true, evaluacion: { ...DTO, bono_a_pagar: 1 } }, cache });
  assert.equal(r.tipo, 'sin_conexion');
  assert.equal(r.dto, DTO);
  assert.equal(r.guardar, false);
  const sinCache = resolverEstado({ status: 200, cuerpo: { ok: true, disponible: true, evaluacion: { ...DTO, bono_a_pagar: 1 } }, cache: null });
  assert.equal(sinCache.tipo, 'error');
});

test('after the month changes, an offline view never shows last month’s answer as current', () => {
  const delMesPasado = { guardado: cache.guardado, dto: { ...DTO, month: '2026-10' } };
  const r = resolverEstado({ redErr: true, cache: delMesPasado, mesActual: '2026-11' });
  assert.equal(r.tipo, 'error', 'no data from October');
  assert.equal(r.dto, undefined);
  const delMes = resolverEstado({ redErr: true, cache, mesActual: '2026-11' });
  assert.equal(delMes.tipo, 'sin_conexion', 'the same month is still shown offline');
});

test('the month of the device clock is YYYY-MM', () => {
  assert.equal(mesDe(new Date(2026, 10, 25)), '2026-11');
  assert.equal(mesDe(new Date(2026, 0, 1)), '2026-01');
});

test('a cache that does not match the allowlist is never shown', () => {
  const r = resolverEstado({ redErr: true, cache: { guardado: cache.guardado, dto: { ...DTO, extra: 1 } } });
  assert.equal(r.tipo, 'error');
});

// ── the copy and the view ──
test('the view shows the barber\'s own name only, with the panel\'s wording', () => {
  const v = vistaDe(DTO);
  assert.equal(v.titulo, 'Didian');
  assert.equal(v.puntajeTxt, '8,4');
  assert.equal(v.maximoTxt, '/ 100 pts');
  assert.equal(v.provisional, 'Provisional hasta el cierre del mes');
  assert.equal(v.metaLocal.texto, 'Meta del local: 62 % cumplida · 38 % faltante');
  assert.equal(v.bonoNota, 'Se paga solo si la meta del grupo se cumple.');
  assert.equal(v.proyeccion.texto, 'A este ritmo cierras el mes con 8,6 / 40 pts (estimación)');
});

test('bonus: "Estrato" with the letter, the percentage with the comma decimal; no English word "Tier" anywhere', () => {
  assert.equal(vistaDe(DTO).tierBono, 'Estrato A · 0,25 %');
  assert.equal(vistaDe(DTO).tier, 'D · Insuficiente', 'the tier chip: letter and label, as in the panel');
  assert.equal(/\bTier\b/.test(textosDeLaVista(vistaDe(DTO)).join(' | ')), false, 'no "Tier" word in the view');
  assert.equal(vistaDe(conDisq).tierBono, 'Sin bono este mes');
  assert.equal(vistaDe(conDisq).descalificado, 'Descalificado este mes');
  assert.equal(vistaDe(DTO).descalificado, null);
});

test('group goal: a status only ("cumplida" / "aún no cumplida")', () => {
  const cumplida = vistaDe({ ...DTO, groupGoalStatus: 'met', metaLocal: { cumplidaPct: 100, faltantePct: 0, cumplida: true } }).metaLocal;
  assert.equal(cumplida.texto, 'Meta cumplida · 0 % faltante');
  assert.equal(cumplida.cumplidaPct, 100);
});

// the local goal: percentages only, integers, never "100 %" unless met, hidden without a goal, money refused
test('meta local: 99 is shown as 99 when not met; the bar never reaches 100 unless met', () => {
  const m = vistaDe({ ...DTO, metaLocal: { cumplidaPct: 99, faltantePct: 1, cumplida: false } }).metaLocal;
  assert.equal(m.texto, 'Meta del local: 99 % cumplida · 1 % faltante');
  assert.equal(m.cumplidaPct, 99);
});

test('meta local: start of month (0 %) shows 0 % cumplida · 100 % faltante', () => {
  const m = vistaDe({ ...DTO, metaLocal: { cumplidaPct: 0, faltantePct: 100, cumplida: false } }).metaLocal;
  assert.equal(m.texto, 'Meta del local: 0 % cumplida · 100 % faltante');
});

test('meta local: BOTH null and undefined hide the block (the deploy order cannot break the screen)', () => {
  const sinKey = { ...DTO }; delete sinKey.metaLocal;
  for (const dto of [{ ...DTO, metaLocal: null }, sinKey]) {
    assert.equal(vistaDe(dto).metaLocal, null, 'no block in the view model');
    assert.equal(/Meta del local|Meta cumplida/.test(textosDeLaVista(vistaDe(dto)).join(' | ')), false, 'no goal text on screen');
  }
  assert.equal(esDtoValido({ ...DTO, metaLocal: null }), true, 'null is a valid answer');
  assert.equal(esDtoValido(sinKey), true, 'an answer from an API without the key is valid (no block, nothing granted)');
  const src = fs.readFileSync(new URL('../src/components/MiEvaluacion.js', import.meta.url), 'utf8');
  assert.match(src, /\{v\.metaLocal \? \(/, 'the screen draws the block only when the view model has one');
  assert.equal(esDtoValido({ ...DTO, metaLocal: { cumplidaPct: 1, faltantePct: 99, cumplida: false, monto: 4200000 } }), false, 'a money key is refused');
  assert.equal(esDtoValido({ ...DTO, metaLocal: { cumplidaPct: 1, faltantePct: 99 } }), false, 'a missing key is refused');
});

test('meta local: no amount or goal value in any text of the view', () => {
  const textos = textosDeLaVista(vistaDe(DTO)).join(' | ');
  assert.equal(/\$|CLP|pesos|\d{6,}/i.test(textos), false, 'money or a goal value');
});

test('components and trend labels', () => {
  const v = vistaDe(DTO);
  assert.equal(v.puntos.length, 5);
  assert.deepEqual(v.puntos.map(p => p.nombre), ['Producción', 'Conducta diaria', 'Puntualidad', 'Venta adicional', 'Propinas']);
  assert.equal(v.puntos[0].puntos, '8,4 / 40');
  assert.equal(v.conducta[1].tendencia, '▲ sube');
  assert.equal(v.conducta[0].tendencia, '● estable');
  assert.equal(v.conducta[2].tendencia, 'sin tendencia aún');
  assert.equal(v.copiados, 'Días con conducta copiada (sin cambios): 2');
});

test('conduct averages always have two decimals, the same as the panel', () => {
  const v = vistaDe(DTO);
  assert.deepEqual(v.conducta.map(r => r.promedio), ['0,00', '6,50', '4,00']);
});

test('punctuality detail: the late blocks and the days without a mark (singular / plural, neutral wording)', () => {
  const det = vistaDe(DTO).puntos.find(p => p.clave === 'punctuality').detalle;
  assert.equal(det, 'bloques de atraso o salida anticipada: 0 · Días sin marca de entrada: 2 · Día sin marca de salida: 1');
  const uno = vistaDe({ ...DTO, components: { ...DTO.components, punctuality: { ...DTO.components.punctuality, detail: { lateBlocks: 0, diasSinEntrada: 1, diasSinSalida: 0 } } } })
    .puntos.find(p => p.clave === 'punctuality').detalle;
  assert.equal(uno, 'bloques de atraso o salida anticipada: 0 · Día sin marca de entrada: 1');
});

test('no estimate → no estimate line; no hints → no hints', () => {
  const v = vistaDe({ ...DTO, productionProjection: null, improvementHints: [] });
  assert.equal(v.proyeccion, null);
  assert.deepEqual(v.mejorar, []);
});

test('no amounts in pesos, no other barber, no month selector in any text of the view', () => {
  const textos = textosDeLaVista(vistaDe(DTO)).join(' | ');
  assert.equal(/\$|CLP|pesos/i.test(textos), false, 'money');
  assert.equal(/\bAna\b|\bSteven\b|\bAngie\b|\bPablo\b/.test(textos), false, 'other barbers');
  assert.equal(/mes anterior|mes siguiente|periodo|selector/i.test(textos), false, 'month selector wording');
});

test('the time label uses hh:mm', () => {
  assert.match(horaDe('2026-11-25T15:09:00.000Z'), /^\d\d:\d\d$/);
  assert.equal(horaDe('no es fecha'), '--:--');
});

// ── the screen: read the source (no React Native runtime here) ──
const pantalla = fs.readFileSync(new URL('../src/components/MiEvaluacion.js', import.meta.url), 'utf8');
const config = fs.readFileSync(new URL('../src/screens/ConfigScreen.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../App.js', import.meta.url), 'utf8');

test('the screen asks for one endpoint, with the session, and no month or barber parameter', () => {
  const llamadas = [...pantalla.matchAll(/fetchAutenticado\(\s*'([^']+)'/g)].map(m => m[1]);
  assert.deepEqual(llamadas, ['/api/v2/me/evaluation']);
  assert.equal(/periodo|month|bid=|barberId/.test(pantalla.match(/fetchAutenticado\([^)]*\)/)[0]), false);
});

test('the screen has no month selector, picker or modal', () => {
  assert.equal(/Picker|<select|Modal|DateTimePicker/.test(pantalla), false);
});

test('the Mi evaluación tab is offered only to barber sessions (the master-PIN admin never sees it)', () => {
  assert.match(config, /const puedeEvaluacion = !!barbero && barbero\.rol === 'barbero';/);
  assert.match(config, /if \(puedeEvaluacion && vista === 'evaluacion'\)/);
});

test('the cached answer of the barber is cleared on logout', () => {
  assert.match(app, /if \(usuario\?\.bid\) borrarCache\(usuario\.bid\);/);
});

test('no console output of the answer in the new code', () => {
  for (const src of [pantalla, fs.readFileSync(new URL('../src/services/evaluacion.js', import.meta.url), 'utf8')]) {
    assert.equal(/console\.(log|warn|error)/.test(src), false);
  }
});
