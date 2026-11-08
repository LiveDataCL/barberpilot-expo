// Run: node --test tests/avanceMeta.test.js   (Node >= 22.7, ESM syntax auto-detected)
import test from 'node:test';
import assert from 'node:assert/strict';
import { avanceMeta, textosProyeccion, etiquetaServiciosPeriodo, ETIQUETA_AVANCE } from '../src/services/avanceMeta.js';

const fmt = (n) => Math.round(n).toLocaleString('es-CL');       // the app's formatter (src/constants)
const bloqueNuevo = { modo: 'mes', regla_avance: 'barbero_asociado', a_la_fecha: { servicios: 37000, productos: 13000 }, proyeccion: 250000, facturado: 50000, preliminar: false };

test('barber-associated figure: services + products of barbers, as the API sends it (a_la_fecha), nothing else added', () => {
  const a = avanceMeta(bloqueNuevo);
  assert.deepEqual(a, { servicios: 37000, productos: 13000, total: 50000 });
  assert.equal(avanceMeta({ ...bloqueNuevo, a_la_fecha: { servicios: '37000', productos: '13000' } }).total, 50000, 'numeric text from the API is read as numbers');
  assert.equal(avanceMeta({ ...bloqueNuevo, propina: 9999, tips: 9999, propinas: 9999 }).total, 50000, 'no tip field is ever read or added');
});

test('labels on the new rule: "Facturación (servicios + productos de barberos)" for the figure and the projection', () => {
  const t = textosProyeccion({ avance: avanceMeta(bloqueNuevo), mes: '2026-11', old: { fact: 999, prod: 888 }, fmt });
  assert.equal(t.titulo, 'PROYECCION FACTURACION (servicios + productos de barberos) 2026-11');
  assert.equal(t.detalle, 'Facturación (servicios + productos de barberos): $50.000');
  assert.equal(ETIQUETA_AVANCE, 'Facturación (servicios + productos de barberos)');
  assert.ok(!t.detalle.includes('999') && !t.detalle.includes('888'), 'the old services-only figures are not shown beside the new projection');
  assert.equal(etiquetaServiciosPeriodo(avanceMeta(bloqueNuevo)), 'Servicios', 'no longer claimed to be the base of the goal and the projection');
});

test('without the marker the card is drawn EXACTLY as before (old month, old API, rule switched off)', () => {
  for (const pb of [undefined, null, {}, { proyeccion: 1, a_la_fecha: { servicios: 5, productos: 6 } }, { ...bloqueNuevo, regla_avance: null }, { ...bloqueNuevo, regla_avance: 'otra' }]) {
    assert.equal(avanceMeta(pb), null);
  }
  const t = textosProyeccion({ avance: null, mes: '2026-10', old: { fact: 35000, prod: 10000 }, fmt });
  assert.equal(t.titulo, 'PROYECCION SERVICIOS 2026-10');
  assert.equal(t.detalle, 'Servicios del mes: $35.000 · Productos: $10.000');
  assert.equal(etiquetaServiciosPeriodo(null), 'Servicios (base de meta y proyección)');
  assert.equal(etiquetaServiciosPeriodo(undefined), 'Servicios (base de meta y proyección)');
});

test('a marked block without usable numbers is never guessed: the old drawing is used (fail closed)', () => {
  for (const a_la_fecha of [undefined, null, {}, { servicios: 'x', productos: 1 }, { servicios: 1 }, { servicios: -1, productos: 2 }, { servicios: NaN, productos: 1 }, { servicios: null, productos: 1 }]) {
    assert.equal(avanceMeta({ ...bloqueNuevo, a_la_fecha }), null, JSON.stringify(a_la_fecha));
  }
});

test('zero is a real figure: a new-rule month with no sales yet shows $0, not the old drawing', () => {
  const a = avanceMeta({ ...bloqueNuevo, a_la_fecha: { servicios: 0, productos: 0 } });
  assert.deepEqual(a, { servicios: 0, productos: 0, total: 0 });
  assert.equal(textosProyeccion({ avance: a, mes: '2026-11', old: { fact: 0, prod: 0 }, fmt }).detalle, 'Facturación (servicios + productos de barberos): $0');
});
