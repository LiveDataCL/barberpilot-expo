// Cobrar sheet rules (src/services/cobro.js), tested in Node with the server's payment-method shape.
// Run: node tests/cobro_sheet.test.js
//   Optional live shape check: COBRO_CONFIG_JSON=<file with the staging GET /config/negocio response> node tests/cobro_sheet.test.js
const fs = require('fs');
const path = require('path');
const Module = require('module');
const assert = require('assert');
const babel = require('@babel/core');

function load(file) {
  const { code } = babel.transformFileSync(file, {
    babelrc: false, configFile: false,
    plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
  });
  const m = new Module(file);
  m.filename = file;
  m.paths = Module._nodeModulePaths(path.dirname(file));
  m._compile(code, file);
  return m.exports;
}
const C = load(path.join(__dirname, '..', 'src', 'services', 'cobro.js'));

// The server's payment methods (services/comisiones.js + _reglasComision): clave, etiqueta, pct_barbero, activo, orden.
const METODOS_SERVIDOR = [
  { clave: 'efectivo', etiqueta: 'Efectivo', pct_barbero: 50, activo: true, orden: 1 },
  { clave: 'debito', etiqueta: 'Tarjeta', pct_barbero: 43, activo: true, orden: 2 },
  { clave: 'transferencia', etiqueta: 'Transferencia', pct_barbero: 50, activo: true, orden: 3 },
];
const catalogo = (cargando = false, metodos = METODOS_SERVIDOR) => ({
  cargando, metodosPago: metodos, servicios: [{ id: 's01', nom: 'Corte', precio: 13000 }],
});

let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('PASS ' + name); };

ok('labels come from the server: one per active method, keys are the server claves', () => {
  const m = C.metodosCobro(catalogo());
  assert.strictEqual(m.length, 3);
  assert.deepStrictEqual(m.map((x) => x.clave), ['efectivo', 'debito', 'transferencia']);
  for (const x of m) {
    assert.ok(x.etiqueta && x.etiqueta.length > 0, 'empty label for ' + x.clave);
    assert.ok(x.label.includes(x.etiqueta), 'label must show the server etiqueta');
  }
  assert.strictEqual(m.find((x) => x.clave === 'debito').etiqueta, 'Tarjeta');
  assert.strictEqual(m.find((x) => x.clave === 'debito').pct, 43);
});

ok('inactive or unknown methods are not shown', () => {
  const m = C.metodosCobro(catalogo(false, [
    { clave: 'efectivo', etiqueta: 'Efectivo', pct_barbero: 50, activo: false },
    { clave: 'debito', etiqueta: 'Tarjeta', pct_barbero: 43, activo: true },
    { clave: 'transferencia', etiqueta: 'Transferencia', pct_barbero: 50, activo: true },
    { clave: 'cripto', etiqueta: 'X', pct_barbero: 1, activo: true },
  ]));
  assert.deepStrictEqual(m.map((x) => x.clave), ['debito', 'transferencia']);
});

ok('Confirm is off while the catalogue is loading', () => {
  const e = C.estadoCobro({ catalogo: catalogo(true), servicio: 'Corte', pago: 'efectivo', propina: 0, busy: false });
  assert.strictEqual(e.puedeConfirmar, false);
  assert.ok(/Cargando/.test(e.motivo));
});

ok('Confirm is off until a method is chosen (none preselected)', () => {
  const e = C.estadoCobro({ catalogo: catalogo(), servicio: 'Corte', pago: null, propina: 0, busy: false });
  assert.strictEqual(e.puedeConfirmar, false);
  assert.ok(/Elige un método/.test(e.motivo));
});

ok('Confirm is off when the price is not in the catalogue', () => {
  const e = C.estadoCobro({ catalogo: catalogo(), servicio: 'Servicio que no existe', pago: 'efectivo', propina: 0, busy: false });
  assert.strictEqual(e.puedeConfirmar, false);
  assert.ok(/precio/.test(e.motivo));
});

ok('Confirm is off while a charge is in flight', () => {
  const e = C.estadoCobro({ catalogo: catalogo(), servicio: 'Corte', pago: 'efectivo', propina: 0, busy: true });
  assert.strictEqual(e.puedeConfirmar, false);
});

ok('Efectivo 13.000: barber 6.500, business 6.500', () => {
  const e = C.estadoCobro({ catalogo: catalogo(), servicio: 'Corte', pago: 'efectivo', propina: 0, busy: false });
  assert.strictEqual(e.puedeConfirmar, true);
  assert.strictEqual(e.resumen.bb, 6500);
  assert.strictEqual(e.resumen.neg, 6500);
  assert.strictEqual(e.resumen.textoMonto, '$13.000');
});

ok('Tarjeta (43 %) 13.000: barber 5.590, business 7.410', () => {
  const e = C.estadoCobro({ catalogo: catalogo(), servicio: 'Corte', pago: 'debito', propina: 0, busy: false });
  assert.strictEqual(e.resumen.bb, 5590);
  assert.strictEqual(e.resumen.neg, 7410);
});

ok('tip goes entirely to the barber, never into the commission', () => {
  const propina = C.propinaCalculada('diez', 13000, '');
  assert.strictEqual(propina, 1300);
  const e = C.estadoCobro({ catalogo: catalogo(), servicio: 'Corte', pago: 'transferencia', propina, busy: false });
  assert.strictEqual(e.resumen.bb, 6500);
  assert.strictEqual(e.resumen.neg, 6500);
  assert.strictEqual(e.resumen.barberoRecibe, 7800);
});

ok('typed tip: only digits, never negative', () => {
  assert.strictEqual(C.propinaCalculada('otro', 13000, '2500'), 2500);
  assert.strictEqual(C.propinaCalculada('otro', 13000, ''), 0);
  assert.strictEqual(C.propinaCalculada('ninguna', 13000, '999'), 0);
});

ok('server errors become Spanish reasons; unknown ones show their code', () => {
  assert.ok(/método/.test(C.mensajeDeRespuesta(400, { error: 'queue_id, bid y pago requeridos' }).mensaje));
  assert.strictEqual(C.mensajeDeRespuesta(409, { error: 'already_closed' }).estado, 'ya_cobrado');
  assert.strictEqual(C.mensajeDeRespuesta(409, { error: 'cierre_en_curso' }).estado, 'en_curso');
  assert.strictEqual(C.mensajeDeRespuesta(401, {}).estado, 'sesion');
  assert.strictEqual(C.mensajeDeRespuesta(400, { error: 'metodo_pago_invalido', detalle: 'Método de pago no válido: "x".' }).mensaje, 'Método de pago no válido: "x".');
  assert.ok(/400/.test(C.mensajeDeRespuesta(400, { error: 'algo_raro' }).mensaje));
  assert.ok(/algo_raro/.test(C.mensajeDeRespuesta(400, { error: 'algo_raro' }).mensaje));
  assert.strictEqual(C.mensajeDeRespuesta(500, {}).estado, 'red');
});

ok('close without a charge: reason is 5 to 120 characters, the quick picks are the three agreed', () => {
  assert.strictEqual(C.validarMotivo('no').ok, false);
  assert.strictEqual(C.validarMotivo('  abcd  ').ok, false);
  assert.strictEqual(C.validarMotivo('abcde').ok, true);
  assert.strictEqual(C.validarMotivo('x'.repeat(121)).ok, false);
  assert.strictEqual(C.validarMotivo('x'.repeat(120)).ok, true);
  assert.deepStrictEqual(C.MOTIVOS_RAPIDOS, ['Cliente se retiró', 'Servicio de cortesía', 'Error de registro']);
});

(async () => {
  // Close without a charge: the server's answers become the reasons shown
  const fake = (status, json) => async () => ({ ok: status < 300, status, json: async () => json });
  const motivoCorto = await C.cerrarSinCobro(fake(200, { ok: true }), { queue_id: 1, motivo: 'no' });
  assert.strictEqual(motivoCorto.estado, 'motivo');
  const okSinCobro = await C.cerrarSinCobro(fake(200, { ok: true }), { queue_id: 1, motivo: 'Cliente se retiró' });
  assert.strictEqual(okSinCobro.estado, 'ok');
  assert.strictEqual((await C.cerrarSinCobro(fake(403, { ok: false, error: 'solo_admin_o_encargado' }), { queue_id: 1, motivo: 'Error de registro' })).estado, 'sesion');
  assert.strictEqual((await C.cerrarSinCobro(fake(400, { ok: false, error: 'motivo_requerido', detalle: 'Escribe el motivo.' }), { queue_id: 1, motivo: 'Error de registro' })).mensaje, 'Escribe el motivo.');
  assert.strictEqual((await C.cerrarSinCobro(fake(409, { ok: false, error: 'sin_venta' }), { queue_id: 1, motivo: 'Error de registro' })).estado, 'rechazado');
  assert.strictEqual((await C.cerrarSinCobro(fake(500, {}), { queue_id: 1, motivo: 'Error de registro' })).estado, 'red');
  n++; console.log('PASS close without a charge: answers mapped to Spanish reasons');
  await (async () => {
    const red = await C.enviarCobro(async () => { throw new Error('offline'); }, { queue_id: 1, bid: 'b1', pago: 'efectivo', propina: 0 });
    assert.strictEqual(red.estado, 'red');
    const good = await C.enviarCobro(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }), { queue_id: 1, bid: 'b1', pago: 'efectivo', propina: 0 });
    assert.strictEqual(good.estado, 'ok');
    const bad = await C.enviarCobro(async () => ({ ok: false, status: 400, json: async () => ({ ok: false, error: 'queue_id, bid y pago requeridos' }) }), { queue_id: 1, bid: 'b1', pago: undefined, propina: 0 });
    assert.ok(/método/.test(bad.mensaje));
    n++; console.log('PASS enviarCobro: network, success and server reason');
  })();

  // Live shape check: the staging config (same server code as production). Only when a file is given.
  if (process.env.COBRO_CONFIG_JSON) {
    const data = JSON.parse(fs.readFileSync(process.env.COBRO_CONFIG_JSON, 'utf8'));
    const metodos = Array.isArray(data.metos_pago) ? data.metos_pago : (Array.isArray(data.metodos_pago) ? data.metodos_pago : null);
    assert.ok(metodos && metodos.length > 0, 'config has no payment methods');
    const cat = { cargando: false, metodosPago: metodos, servicios: [{ id: 's01', nom: 'Corte', precio: 13000 }] };
    const m = C.metodosCobro(cat);
    assert.ok(m.length >= 1, 'no active method from the live config');
    for (const x of m) assert.ok(x.etiqueta && x.label.includes(x.etiqueta), 'empty label from live config: ' + x.clave);
    const e = C.estadoCobro({ catalogo: cat, servicio: 'Corte', pago: m[0].clave, propina: 0, busy: false });
    assert.strictEqual(e.puedeConfirmar, true);
    n++; console.log('PASS live config shape: ' + m.map((x) => x.label).join(' | '));
  }
  console.log('SUMMARY: ' + n + ' Cobrar sheet checks passed');
})().catch((e) => { console.log('FAIL ' + e.message); process.exit(1); });
