// Run: node --test tests/proyeccion.test.js. Projection for the end of the month: X = round(cumplidaPct × 100 / ritmoEsperadoPct), client-side.
import test from 'node:test';
import assert from 'node:assert/strict';
import { proyeccionFinMes, vistaDe, TEXTOS } from '../src/services/evaluacion.js';

const DTO = {
  barberName: 'Didian', month: '2026-11', totalScore: 77.5, tier: 'A', tierNombre: 'Muy bueno', bonusTier: 'A', bonusPct: 0.25,
  disqualified: { active: false, reason: null }, groupGoalStatus: 'not_met', carryOverDays: 0, isProvisional: true,
  computedAt: '2026-11-25T12:00:00.000Z', conductRows: [], improvementHints: [],
  components: {
    production: { earned: 30, max: 40, detail: { servicios: 14, metaServicios: 15 } }, conduct: { earned: 20, max: 30 },
    punctuality: { earned: 15, max: 15, detail: { lateBlocks: 0, diasSinEntrada: 0, diasSinSalida: 0 } },
    upselling: { earned: 10, max: 10, detail: { conProducto: 3, servicios: 14, umbralPct: 10 } }, tips: { earned: 5, max: 5 },
  },
  metaLocal: { cumplidaPct: 58, faltantePct: 42, cumplida: false, ritmoEsperadoPct: 66 },
  productionProjection: { projectedPoints: 38.9, max: 40, basisDays: 10, isEstimate: true },
};

test('normal case: 58 % done against a pace of 66 % → projection 88 %', () => {
  const p = proyeccionFinMes({ cumplidaPct: 58, ritmoEsperadoPct: 66, diasTranscurridos: 10 });
  assert.equal(p.pct, 88);
  assert.equal(p.texto, 'Proyección para fin de mes: 88 %');
  assert.equal(p.nota, 'Si mantienes el ritmo actual. Es una estimación y no cambia el puntaje oficial.');
});

test('cap at 100: a projection above 100 shows "100 % o más"', () => {
  const p = proyeccionFinMes({ cumplidaPct: 70, ritmoEsperadoPct: 50, diasTranscurridos: 10 });   // 140
  assert.equal(p.pct, 100);
  assert.equal(p.texto, 'Proyección para fin de mes: 100 % o más');
});

test('exactly 100 also shows "100 % o más"', () => {
  assert.equal(proyeccionFinMes({ cumplidaPct: 50, ritmoEsperadoPct: 50, diasTranscurridos: 10 }).texto, 'Proyección para fin de mes: 100 % o más');
});

test('null pace (and undefined, from an old server): hidden', () => {
  assert.equal(proyeccionFinMes({ cumplidaPct: 58, ritmoEsperadoPct: null, diasTranscurridos: 10 }), null);
  assert.equal(proyeccionFinMes({ cumplidaPct: 58, ritmoEsperadoPct: undefined, diasTranscurridos: 10 }), null);
});

test('fewer than 3 elapsed scheduled days: hidden; 3 days: shown', () => {
  assert.equal(proyeccionFinMes({ cumplidaPct: 58, ritmoEsperadoPct: 66, diasTranscurridos: 2 }), null);
  assert.equal(proyeccionFinMes({ cumplidaPct: 58, ritmoEsperadoPct: 66, diasTranscurridos: 0 }), null);
  assert.notEqual(proyeccionFinMes({ cumplidaPct: 58, ritmoEsperadoPct: 66, diasTranscurridos: 3 }), null);
});

test('zero cumplida: the projection is 0 %', () => {
  assert.equal(proyeccionFinMes({ cumplidaPct: 0, ritmoEsperadoPct: 40, diasTranscurridos: 10 }).texto, 'Proyección para fin de mes: 0 %');
});

test('pace of 0 (first day): hidden, no division by zero', () => {
  assert.equal(proyeccionFinMes({ cumplidaPct: 0, ritmoEsperadoPct: 0, diasTranscurridos: 10 }), null);
});

test('unknown elapsed days (no estimate in the answer): hidden', () => {
  assert.equal(proyeccionFinMes({ cumplidaPct: 58, ritmoEsperadoPct: 66, diasTranscurridos: undefined }), null);
  assert.equal(proyeccionFinMes({ cumplidaPct: 58, ritmoEsperadoPct: 66, diasTranscurridos: null }), null);
});

test('a non-integer or out-of-range pace is hidden', () => {
  assert.equal(proyeccionFinMes({ cumplidaPct: 58, ritmoEsperadoPct: 66.5, diasTranscurridos: 10 }), null);
  assert.equal(proyeccionFinMes({ cumplidaPct: 58, ritmoEsperadoPct: 101, diasTranscurridos: 10 }), null);
});

test('view model: the projection is present with the estimate, hidden without it; the marker caption is "Marca: avance del mes N %"', () => {
  const v = vistaDe(DTO);
  assert.equal(v.metaLocal.proyeccionFin.texto, 'Proyección para fin de mes: 88 %');
  assert.equal(v.metaLocal.ritmo.texto, 'Marca: avance del mes 66 %');
  const sinEstimado = vistaDe({ ...DTO, productionProjection: null });
  assert.equal(sinEstimado.metaLocal.proyeccionFin, null);
  assert.equal(sinEstimado.metaLocal.ritmo.texto, 'Marca: avance del mes 66 %', 'the marker still shows');
});

test('the points-estimate box is unchanged', () => {
  assert.equal(vistaDe(DTO).proyeccion.texto, 'A este ritmo cierras el mes con 38,9 / 40 pts (estimación)');
  assert.equal(TEXTOS.proyeccion(38.9, 40), 'A este ritmo cierras el mes con 38.9 / 40 pts (estimación)');
});
