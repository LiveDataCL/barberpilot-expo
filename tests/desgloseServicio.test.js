// Run: node --test tests/desgloseServicio.test.js   (Node >= 22.7, ESM syntax auto-detected)
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatPesos, desgloseServicio } from '../src/services/desgloseServicio.js';

const texto = (d) => d.filas.map(f => `${f.etiqueta} | ${f.valor}`);

test('formatPesos: dot thousands, no decimals', () => {
  assert.equal(formatPesos(0), '$0');
  assert.equal(formatPesos(950), '$950');
  assert.equal(formatPesos(7500), '$7.500');
  assert.equal(formatPesos(1234567), '$1.234.567');
  assert.equal(formatPesos(5160.4), '$5.160');
  assert.equal(formatPesos(null), '$0');
});

test('cash with tip: price 13000, commission 6500, tip 1000', () => {
  const d = desgloseServicio({ snom: 'Corte', precio: 13000, bb: 6500, propina: 1000 });
  assert.deepEqual(texto(d), [
    'Corte | $13.000 cobrado',
    'Tu ganancia | $6.500',
    'Propina | $1.000',
    'Total por el servicio | $7.500',
  ]);
  assert.equal(d.resumen, 'Corte $6.500 + Propina $1.000 = $7.500');
  assert.equal(d.total, 7500);
});

test('card, no tip: price 12000, commission 5160 (43%) -> no propina line, no summary', () => {
  assert.equal(Math.round(12000 * 0.43), 5160);
  const d = desgloseServicio({ snom: 'Corte', precio: 12000, bb: 5160, propina: 0 });
  assert.deepEqual(texto(d), [
    'Corte | $12.000 cobrado',
    'Tu ganancia | $5.160',
    'Total por el servicio | $5.160',
  ]);
  assert.equal(d.resumen, null);
  assert.ok(!d.filas.some(f => f.tipo === 'propina'));
});

test('card WITH tip: price 13000, commission 5590 (43%), tip 1000 -> tip stays out of the commission', () => {
  assert.equal(Math.round(13000 * 0.43), 5590);
  const d = desgloseServicio({ snom: 'Corte', precio: 13000, bb: 5590, propina: 1000 });
  assert.deepEqual(texto(d), [
    'Corte | $13.000 cobrado',
    'Tu ganancia | $5.590',
    'Propina | $1.000',
    'Total por el servicio | $6.590',
  ]);
  assert.equal(d.resumen, 'Corte $5.590 + Propina $1.000 = $6.590');
  assert.equal(d.filas.find(f => f.tipo === 'ganancia').valor, '$5.590'); // commission untouched by the tip
});

test('missing / undefined tip and fields are treated as zero, never NaN', () => {
  const d = desgloseServicio({ snom: 'Barba', precio: 6000, bb: 3000 });
  assert.equal(d.total, 3000);
  assert.ok(!texto(d).join().includes('NaN'));
  assert.ok(!d.filas.some(f => f.tipo === 'propina'));
});
