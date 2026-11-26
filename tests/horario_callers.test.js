// Horario tab: the App's REAL request helper (src/services/api.js, fetchAutenticado) for every call HorarioAdmin makes.
// Reads hit STAGING. Writes (marcar, reset-pin, device revoke) are intercepted before they leave: only the request shape
// and the Authorization header are checked, so staging data is not changed by this test.
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
  ok('hoy: each barber has bid, nombre, entrada/salida, entrada_meta/salida_meta keys', hoyJ.barberos && hoyJ.barberos.every(b => 'bid' in b && 'nombre' in b && 'entrada' in b && 'salida' in b && 'entrada_meta' in b && 'salida_meta' in b));
  ok('hoy: fecha and ahora present (the component reads both)', !!hoyJ.fecha && !!hoyJ.ahora);

  const dev = await api.fetchAutenticado('/api/v2/auth/devices');
  const devJ = await dev.json();
  ok('GET /api/v2/auth/devices (admin session via helper) -> 200 ok', dev.status === 200 && devJ.ok === true, `status ${dev.status}`);

  const sinTok = await realFetch(STAGING + '/api/v2/asistencia/hoy');
  ok('same read without a token -> 401 (the helper is what makes the difference)', sinTok.status === 401, `status ${sinTok.status}`);

  // Writes: intercepted. Check the exact body shape and the token header.
  const cabeceraToken = () => ultimo && ultimo.opts && ultimo.opts.headers && (ultimo.opts.headers.Authorization || ultimo.opts.headers.authorization);
  interceptar = true;

  await api.fetchAutenticado('/api/v2/asistencia/marcar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bid: 'b1', tipo: 'entrada' }) });
  ok('Registrar llegada: POST marcar carries the token', !!cabeceraToken() && /^Bearer .+/.test(cabeceraToken()), 'Authorization present');
  ok('Registrar llegada: body is { bid, tipo: entrada }', JSON.parse(ultimo.opts.body).tipo === 'entrada' && JSON.parse(ultimo.opts.body).bid === 'b1');

  await api.fetchAutenticado('/api/v2/asistencia/marcar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bid: 'b1', tipo: 'salida' }) });
  ok('Registrar salida: POST marcar carries the token', /^Bearer .+/.test(cabeceraToken() || ''));

  await api.fetchAutenticado('/api/v2/asistencia/marcar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bid: 'b1', tipo: 'salida', accion: 'anular', motivo: 'Prueba de anulación' }) });
  const bAnular = JSON.parse(ultimo.opts.body);
  ok('Anular: body carries accion anular and motivo', bAnular.accion === 'anular' && bAnular.motivo.length >= 5 && /^Bearer .+/.test(cabeceraToken() || ''));

  await api.fetchAutenticado('/api/v2/staff/b1/reset-pin', { method: 'POST' });
  ok('Restablecer PIN: POST reset-pin carries the token and goes to the admin route', /\/api\/v2\/staff\/b1\/reset-pin$/.test(ultimo.url) && /^Bearer .+/.test(cabeceraToken() || ''));

  await api.fetchAutenticado('/api/v2/auth/devices/123', { method: 'DELETE' });
  ok('Revocar huella: DELETE device carries the token', ultimo.opts.method === 'DELETE' && /^Bearer .+/.test(cabeceraToken() || ''));

  interceptar = false;
  console.log(fallos ? `\n${fallos} FAILED` : '\nALL PASS');
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error('ERROR', e.message); process.exit(1); });
