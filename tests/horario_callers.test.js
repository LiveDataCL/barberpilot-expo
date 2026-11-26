// Horario tab: the App's REAL request helper (src/services/api.js, fetchAutenticado) and the REAL helpers of the screen
// (src/services/horario.js) for every call HorarioAdmin makes.
// Reads hit STAGING. Writes (marcar, device revoke) are intercepted before they leave: only the body, the route and the
// Authorization header are checked, so staging data is not changed by this test.
// Run: railway run -p eda920e5-58fd-4b88-9aca-5b7256890feb -e staging -s barberpilot-api-staging -- node tests/horario_callers.test.js
const fs = require('fs');
const path = require('path');
const Module = require('module');
const assert = require('assert');
const babel = require('@babel/core');

const STAGING = 'https://barberpilot-api-staging-staging.up.railway.app';
const almacen = {};
const mocks = {
  'expo-secure-store': {
    getItemAsync: async (k) => (k in almacen ? almacen[k] : null),
    setItemAsync: async (k, v) => { almacen[k] = v; },
    deleteItemAsync: async (k) => { delete almacen[k]; },
  },
  '../constants': { API_URL: STAGING },
};
const origLoad = Module._load;
Module._load = function (req) {
  if (Object.prototype.hasOwnProperty.call(mocks, req)) return mocks[req];
  return origLoad.apply(this, arguments);
};
function load(file) {
  const { code } = babel.transformFileSync(file, { babelrc: false, configFile: false, plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')] });
  const m = new Module(file);
  m.filename = file;
  m.paths = Module._nodeModulePaths(path.dirname(file));
  m._compile(code, file);
  return m.exports;
}
const api = load(path.join(__dirname, '..', 'src', 'services', 'api.js'));
const horario = load(path.join(__dirname, '..', 'src', 'services', 'horario.js'));

const realFetch = global.fetch;
let interceptar = false;
let ultimo = null;
// Writes: record the request, answer 200 locally, send nothing.
global.fetch = async (url, opts = {}) => {
  if (interceptar) {
    ultimo = { url, opts };
    return new Response(JSON.stringify({ ok: true, intercepted: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return realFetch(url, opts);
};

const login = async (bid, pin) => {
  const r = await realFetch(STAGING + '/api/v2/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenant_id: 'saulfino', bid, pin }) });
  return (await r.json()).token;
};

(async () => {
  const MASTER = process.env.ADMIN_MASTER_PIN;
  assert.ok(MASTER, 'ADMIN_MASTER_PIN is required');
  almacen.bp_auth_token = await login('admin', MASTER);
  let fallos = 0;
  const ok = (n, c, d = '') => { if (!c) fallos++; console.log(`${c ? 'PASS' : 'FAIL'} ${n}${d ? ' — ' + d : ''}`); };

  // Reads against staging, through the App's helper (token attached by fetchAutenticado)
  const hoy = await api.fetchAutenticado('/api/v2/asistencia/hoy');
  const hoyJ = await hoy.json();
  ok('GET /api/v2/asistencia/hoy (admin session via helper) -> 200 with barberos', hoy.status === 200 && Array.isArray(hoyJ.barberos), `status ${hoy.status}`);
  ok('hoy: each barber has bid, nombre, entrada, salida, entrada_meta, salida_meta', hoyJ.barberos.every(b => 'bid' in b && 'nombre' in b && 'entrada' in b && 'salida' in b && 'entrada_meta' in b && 'salida_meta' in b));
  ok('hoy: fecha, ahora and motivo_obligatorio_min present (the screen reads all three)', !!hoyJ.fecha && !!hoyJ.ahora && typeof hoyJ.motivo_obligatorio_min === 'number');

  const dev = await api.fetchAutenticado('/api/v2/auth/devices');
  ok('GET /api/v2/auth/devices (admin session via helper) -> 200 ok', dev.status === 200 && (await dev.json()).ok === true);

  const sinTok = await realFetch(STAGING + '/api/v2/asistencia/hoy');
  ok('same read without a token -> 401 (the helper is what makes the difference)', sinTok.status === 401, `status ${sinTok.status}`);

  // Request bodies: the screen builds them with cuerpoMarcar, exactly as the panel's registrarHora does
  ok('cuerpoMarcar: "Marcar ahora" -> {bid, tipo} only', JSON.stringify(horario.cuerpoMarcar('b1', 'entrada', '', 'motivo ignorado')) === JSON.stringify({ bid: 'b1', tipo: 'entrada' }));
  ok('cuerpoMarcar: typed time -> {bid, tipo, hora}', JSON.stringify(horario.cuerpoMarcar('b1', 'salida', '09:30', '')) === JSON.stringify({ bid: 'b1', tipo: 'salida', hora: '09:30' }));
  ok('cuerpoMarcar: reason is sent only together with a time, trimmed', JSON.stringify(horario.cuerpoMarcar('b1', 'entrada', '09:30', '  llegó antes  ')) === JSON.stringify({ bid: 'b1', tipo: 'entrada', hora: '09:30', motivo: 'llegó antes' }));
  ok('cuerpoMarcar: a reason without a time is dropped (as the panel does)', !('motivo' in horario.cuerpoMarcar('b1', 'entrada', '', 'sin hora')));

  // Writes: through the real helper, intercepted
  interceptar = true;
  const cabeceraToken = () => (ultimo && ultimo.opts && ultimo.opts.headers && (ultimo.opts.headers.Authorization || ultimo.opts.headers.authorization)) || '';

  await api.fetchAutenticado('/api/v2/asistencia/marcar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(horario.cuerpoMarcar('b1', 'entrada', '', '')) });
  ok('Marcar ahora (entrada): POST marcar, token attached, body {bid, tipo}', /\/api\/v2\/asistencia\/marcar$/.test(ultimo.url) && /^Bearer .+/.test(cabeceraToken()) && JSON.stringify(JSON.parse(ultimo.opts.body)) === JSON.stringify({ bid: 'b1', tipo: 'entrada' }));

  await api.fetchAutenticado('/api/v2/asistencia/marcar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(horario.cuerpoMarcar('b1', 'salida', '18:05', 'salida temprana')) });
  ok('Corregir salida con hora y motivo: body {bid, tipo, hora, motivo}', JSON.stringify(JSON.parse(ultimo.opts.body)) === JSON.stringify({ bid: 'b1', tipo: 'salida', hora: '18:05', motivo: 'salida temprana' }) && /^Bearer .+/.test(cabeceraToken()));

  await api.fetchAutenticado('/api/v2/auth/devices/123', { method: 'DELETE' });
  ok('Revocar huella: DELETE device carries the token', ultimo.opts.method === 'DELETE' && /^Bearer .+/.test(cabeceraToken()));

  interceptar = false;

  // Screen text helpers (the panel's wording and rules)
  ok('RE_HHMM accepts 09:30 and rejects 9:30 and 24:00', horario.RE_HHMM.test('09:30') && !horario.RE_HHMM.test('9:30') && !horario.RE_HHMM.test('24:00'));
  ok('jornadaTexto: 7h 30m, and "Revisar horas" when salida is not after entrada', horario.jornadaTexto('09:00', '16:30') === '7h 30m' && horario.jornadaTexto('10:00', '10:00') === 'Revisar horas' && horario.jornadaTexto('10:00', null) === '—');
  ok('notaDe: ajuste, legado and marca use the panel wording', horario.notaDe({ origen: 'ajuste', hora_servidor: '10:02', por: 'Admin' }) === 'ajustada · anotada a las 10:02 por Admin' && horario.notaDe({ origen: 'legado' }) === 'registrada desde el panel anterior' && horario.notaDe({ origen: 'ahora', hora_servidor: '10:02', por: 'Admin' }) === 'marcada a las 10:02 por Admin');

  console.log(fallos ? `\n${fallos} FAILED` : '\nALL PASS');
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error('ERROR', e.message); process.exit(1); });
