// Run: node --test tests/perfilGanancias.test.js. The Perfil tab's per-method block shows the barber's EARNINGS (bb + propina per method),
// with the same rule as the Ingresos card and the Hoy tab, and no billed amount. "Probar Push" is removed (push registration untouched).
// ConfigScreen is a React component (no runtime here), so these checks read its source.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../src/screens/ConfigScreen.js', import.meta.url), 'utf8');
const bloque = src.slice(src.indexOf('{/* Por forma de pago */}'), src.indexOf('{/* Top servicios */}'));
const calc = src.slice(src.indexOf('const calcStats'), src.indexOf('// Por servicio'));

test('per method: accumulates the barber earnings (bb + propina) per payment method', () => {
  assert.match(calc, /porPago\[r\.pago\]\.gan \+= \(r\.bb \|\| 0\) \+ \(r\.propina \|\| 0\);/);
  assert.equal(/porPago\[r\.pago\]\.fact/.test(src), false, 'the billed total is not accumulated per method');
});

test('per method: the amount shown is earnings, and the bars are each method\'s share of total earnings', () => {
  assert.match(bloque, /\{v\.n\} svc · \$\{fmt\(v\.gan\)\}/);
  assert.match(bloque, /const pct = datos\.bb > 0 \? Math\.round\(v\.gan \/ datos\.bb \* 100\) : 0;/);
  assert.equal(/v\.fact|precio/.test(bloque), false, 'no billed amount in the per-method block');
});

test('the per-method block says the share is of the barber\'s earnings', () => {
  assert.match(bloque, /% de tus ganancias/);
});

test('"Probar Push" is removed from the Perfil tab; the helper and push registration are untouched', () => {
  assert.equal(/Probar Push/.test(src), false, 'button text gone');
  assert.equal(/onPress=\{testPush\}/.test(src), false, 'no caller of testPush');
  const app = fs.readFileSync(new URL('../App.js', import.meta.url), 'utf8');
  assert.match(app, /registrarPushToken\(usuario\.bid\);/, 'push registration call still there');
});
