// Run: node --test tests/sinSumasFacturacion.test.js
// A barber session never sees a SUM of billed amounts (his own or the shop's). Individual sale prices and
// "Ticket prom." are allowed. Checked from the source (the screens are React components).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const leer = (f) => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');

test('Progreso: the monthly card is the barber\'s earnings, titled "Tus ganancias por mes"', () => {
  const src = leer('src/screens/ProgresoScreen.js');
  assert.match(src, /Tus ganancias por mes/);
  assert.equal(/INGRESOS POR MES/.test(src), false, 'old title gone');
  assert.match(src, /bb:\s+r\.a_cobrar/, 'the bar value is the server\'s earnings (a_cobrar = Σ bb + propina)');
});

test('Progreso: the billed total (facturado) is not read or stored by the screen', () => {
  const src = leer('src/screens/ProgresoScreen.js');
  assert.equal(/facturado/.test(src), false);
  assert.equal(/fact\s*:/.test(src), false, 'no billed field in the state');
  assert.equal(/Ingresos/.test(src), false, 'no "Ingresos" label left on the barber card (variation, table)');
});

test('Perfil: the per-method amounts are earnings (bb + propina); no billed sum is kept or shown', () => {
  const src = leer('src/screens/ConfigScreen.js');
  assert.match(src, /porPago\[r\.pago\]\.gan \+= \(r\.bb \|\| 0\) \+ \(r\.propina \|\| 0\);/);
  assert.match(src, /\{v\.n\} svc · \$\{fmt\(v\.gan\)\}/, 'the shown amount is the earnings');
  assert.equal(/v\.fact|fact:/.test(src.replace(/const fact = regs\.reduce[^\n]*\n/, '')), false, 'no billed field stored or shown');
  assert.match(src, /\{pct\}% de tus ganancias/);
  assert.match(src, /statLbl\}>Ganancias<|statLbl">Ganancias</, 'the stat label reads "Ganancias"');
});

test('Mi Mes, Cobrar, Hoy and Tendencias: the displayed sums are earnings (bb + propina), not billed', () => {
  const liq = leer('src/screens/LiquidacionScreen.js');
  assert.match(liq, /const monto = \(r\.bb \|\| 0\) \+ \(r\.propina \|\| 0\);/);
  const hoy = leer('src/screens/HoyScreen.js');
  assert.match(hoy, /const bb\s+= regs\.reduce\(\(a,r\) => a\+\(r\.bb\|\|0\)\+\(r\.propina\|\|0\), 0\);/);
  const ten = leer('src/screens/TendenciasScreen.js');
  assert.match(ten, /const ingreso = \(reg\.bb \|\| 0\) \+ \(reg\.propina \|\| 0\);/);
  assert.match(ten, /GANANCIAS POR HORA/);
});

test('Hoy, Mi Mes, Cobrar and Cola: the billed total is never rendered (it feeds only the ticket average or nothing)', () => {
  for (const f of ['src/screens/HoyScreen.js', 'src/screens/MesScreen.js', 'src/screens/LiquidacionScreen.js', 'src/screens/ColaScreen.js']) {
    const src = leer(f);
    assert.equal(/\{[^}]*\bfact\b[^}]*\}/.test(src), false, f + ' renders no billed value');
  }
});

test('the day notification shows the earnings figure, not the billed day total', () => {
  const src = leer('src/services/DayNotification.js');
  assert.match(src, /Math\.round\(cobra\)/, 'the body uses the earnings argument');
  assert.equal(/factura/.test(src.replace(/export async function updateDayNotification\(barbero, n, factura, cobra\)/, '')), false, 'the billed argument is not shown');
});
