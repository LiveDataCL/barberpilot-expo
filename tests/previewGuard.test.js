// Run: node --test tests/previewGuard.test.js. The guard core is driven with a fetch MOCK: a refused request must never reach the mock.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as G from '../src/services/previewGuardCore.js';

const API = 'https://barberpilot-api-production.up.railway.app';
function mock() {
  const llamadas = [];
  const fn = async (url, init) => { llamadas.push({ url, method: (init && init.method) || 'GET' }); return { ok: true, status: 200, json: async () => ({}) }; };
  return { fn, llamadas };
}

// ── the decision ──
test('preview: the login (POST) is the only write allowed', () => {
  assert.deepEqual(G.decidir('POST', API + '/api/v2/auth/login'), { permitido: true });
});

test('preview: every other write is refused, whatever the path (POST, PUT, PATCH, DELETE)', () => {
  const rutas = ['/queue/checkin', '/queue/control/checkin', '/registros', '/comprobantes', '/clientes', '/api/v2/sillas/cobrar',
    '/api/v2/auth/set-pin', '/api/v2/auth/device/register', '/api/v2/auth/device/unlock', '/push/token', '/push/test',
    '/api/v2/auth/login/extra', '/api/v2/auth/logout', '/registros/x/cliente'];
  for (const m of ['POST', 'PUT', 'PATCH', 'DELETE']) for (const r of rutas) {
    assert.equal(G.decidir(m, API + r).permitido, false, m + ' ' + r);
  }
});

test('preview: reads (GET, HEAD) are allowed, except GET endpoints that change server state', () => {
  assert.equal(G.decidir('GET', API + '/queue/stats').permitido, true);
  assert.equal(G.decidir('HEAD', API + '/config/negocio').permitido, true);
  assert.equal(G.decidir('GET', API + '/mensajes/b1').permitido, false, 'marks messages as read on the server');
  assert.equal(G.decidir('GET', API + '/mensajes/b1').motivo, 'get_con_escritura');
});

test('preview: the method is compared case-insensitively; the query string does not change the path check', () => {
  assert.equal(G.decidir('post', API + '/api/v2/auth/login?x=1').permitido, true);
  assert.equal(G.decidir('post', API + '/api/v2/auth/login/extra').permitido, false);
});

test('preview: a URL that does not parse is refused (fail closed)', () => {
  assert.equal(G.decidir('POST', '::: no es url').permitido, false);
});

// ── the install ──
test('preview: a refused write rejects with the guard code and the mock is never called', async () => {
  const m = mock(); const target = { fetch: m.fn };
  const { activo, wrapper } = G.instalarGuardia({ variante: 'preview', target, realFetch: m.fn });
  assert.equal(activo, true);
  await assert.rejects(target.fetch(API + '/queue/checkin', { method: 'POST' }), (e) => e.code === G.CODIGO_BLOQUEO);
  await assert.rejects(target.fetch(API + '/registros', { method: 'POST', body: '{}' }), (e) => e.code === G.CODIGO_BLOQUEO);
  await assert.rejects(target.fetch(API + '/api/v2/auth/device/unlock', { method: 'POST' }), (e) => e.code === G.CODIGO_BLOQUEO);
  assert.equal(m.llamadas.length, 0, 'fetch was never called for a refused request');
  assert.equal(typeof wrapper, 'function');
});

test('preview: the login goes through to the network, once', async () => {
  const m = mock(); const target = { fetch: m.fn };
  G.instalarGuardia({ variante: 'preview', target, realFetch: m.fn });
  const r = await target.fetch(API + '/api/v2/auth/login', { method: 'POST', body: '{"bid":"b1"}' });
  assert.equal(r.ok, true);
  assert.equal(m.llamadas.length, 1);
  assert.equal(m.llamadas[0].method, 'POST');
});

test('preview: a read (GET) goes through; a refused GET does not', async () => {
  const m = mock(); const target = { fetch: m.fn };
  G.instalarGuardia({ variante: 'preview', target, realFetch: m.fn });
  await target.fetch(API + '/barbero/b1/hoy');
  await assert.rejects(target.fetch(API + '/mensajes/b1'));
  assert.equal(m.llamadas.length, 1);
});

test('preview: every write the App makes is refused (none reaches the mock)', async () => {
  const m = mock(); const target = { fetch: m.fn };
  G.instalarGuardia({ variante: 'preview', target, realFetch: m.fn });
  const escrituras = ['POST /queue/control/checkin', 'POST /push/test', 'POST /clientes', 'POST /registros', 'POST /comprobantes',
    'PATCH /registros/r1', 'PUT /queue/q1/status', 'POST /queue/q1/notify', 'POST /api/v2/sillas/cobrar', 'POST /api/v2/sillas/b1/disponibilidad',
    'DELETE /api/v2/auth/devices/3', 'POST /api/v2/auth/set-pin', 'POST /api/v2/auth/device/register', 'POST /api/v2/auth/device/unlock',
    'POST /push/token'];
  for (const e of escrituras) {
    const [metodo, ruta] = e.split(' ');
    await assert.rejects(target.fetch(API + ruta, { method: metodo }), (x) => x.code === G.CODIGO_BLOQUEO, e);
  }
  assert.equal(m.llamadas.length, 0);
});

test('preview: a blocked call tells the shell (the message is neutral)', async () => {
  const m = mock(); const target = { fetch: m.fn }; const motivos = [];
  G.instalarGuardia({ variante: 'preview', target, realFetch: m.fn, onBloqueo: (x) => motivos.push(x) });
  await assert.rejects(target.fetch(API + '/registros', { method: 'POST' }));
  assert.deepEqual(motivos, ['escritura_no_permitida']);
  assert.equal(G.MENSAJE_BLOQUEO, 'Esta acción no está disponible en la copia de prueba.');
});

test('production (variant unset or anything but "preview"): the install is a no-op and fetch is untouched', () => {
  for (const variante of [undefined, 'produccion', '', 'Preview', 'PREVIEW', 'staging', null]) {
    const m = mock(); const target = { fetch: m.fn };
    const r = G.instalarGuardia({ variante, target, realFetch: m.fn });
    assert.equal(r.activo, false, String(variante));
    assert.equal(target.fetch, m.fn, 'the same function object: nothing replaced');
  }
});

test('the mode cannot be changed at runtime: the core exposes no setter and no storage read', () => {
  const src = fs.readFileSync(new URL('../src/services/previewGuardCore.js', import.meta.url), 'utf8');
  assert.equal(/localStorage|AsyncStorage|SecureStore|process\.env|setVariante|export let/.test(src), false);
  assert.equal(Object.keys(G).some(k => /variante|mode|modo/i.test(k) && typeof G[k] === 'function'), false, 'no function that sets the mode');
});

// ── the self-test ──
test('self-test: with the guard on the global fetch, the refusal is the guard\'s own → "activo"', async () => {
  const m = mock(); const target = { fetch: m.fn };
  G.instalarGuardia({ variante: 'preview', target, realFetch: m.fn });
  assert.equal(await G.autoprueba(target.fetch), 'activo');
  assert.equal(m.llamadas.length, 0, 'the self-test never reached the network');
});

test('self-test: a request that reaches the network → "fallido" (the guard is not in place)', async () => {
  const m = mock();
  assert.equal(await G.autoprueba(m.fn), 'fallido');
  assert.equal(m.llamadas.length, 1, 'this mock stands for an unguarded fetch');
  assert.equal(m.llamadas[0].url, G.URL_AUTOPRUEBA);
});

test('self-test: a network error (not the guard\'s code) → "fallido"', async () => {
  assert.equal(await G.autoprueba(async () => { throw new TypeError('Network request failed'); }), 'fallido');
});

test('self-test targets only the local discard address', () => {
  assert.equal(G.URL_AUTOPRUEBA, 'http://127.0.0.1:9/__guard_selftest');
});

// ── the App wiring (source checks) ──
test('App.js: the guard is the FIRST import', () => {
  const app = fs.readFileSync(new URL('../App.js', import.meta.url), 'utf8');
  const primera = app.split('\n').find(l => /^\s*import\s/.test(l));
  assert.equal(primera.trim(), "import './src/services/previewGuard';");
});

test('App.js: the App is wrapped by the shell, and push registration is off in preview', () => {
  const app = fs.readFileSync(new URL('../App.js', import.meta.url), 'utf8');
  assert.match(app, /<PreviewShell>\s*<AppInterna \/>\s*<\/PreviewShell>/);
  assert.match(app, /function registrarPushToken\(bid\) \{\s*(\/\/[^\n]*\n\s*)*if \(ES_PREVIEW\) return Promise\.resolve\(\);/);
});

test('the shell: nothing of the App before the self-test answers; the banner only when confirmed', () => {
  const shell = fs.readFileSync(new URL('../src/components/PreviewShell.js', import.meta.url), 'utf8');
  assert.match(shell, /if \(!ES_PREVIEW\) return children;/);
  assert.match(shell, /estado === 'pendiente'/);
  assert.match(shell, /estado === 'activo' \?/);
  assert.match(shell, /COPIA DE PRUEBA · SOLO LECTURA/);
  assert.match(shell, /GUARD FAILED - DO NOT USE/);
});

test('app.config.js: the preview disables OTA and marks itself; production returns the config object unchanged', () => {
  const cfg = fs.readFileSync(new URL('../app.config.js', import.meta.url), 'utf8');
  assert.match(cfg, /updates: \{ \.\.\.config\.updates, enabled: false \}/);
  assert.match(cfg, /extra: \{ \.\.\.config\.extra, appVariant: 'preview' \}/);
  assert.match(cfg, /if \(process\.env\.APP_VARIANT !== 'preview'\) return config;/);
});
