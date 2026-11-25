// Run: node --test tests/pushRegistro.test.js. Push-token registration must never throw, whatever the native layer does
// (the preview build has no google-services, so the token step fails there). Every failure path is driven with fakes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registrarPushToken } from '../src/services/pushRegistro.js';

function montar({ notif = {}, platform = 'android', fetchImpl, json } = {}) {
  const llamadas = { fetch: [], info: [], error: [] };
  const Notifications = {
    AndroidImportance: { MAX: 5 },
    setNotificationChannelAsync: async () => undefined,
    getPermissionsAsync: async () => ({ status: 'granted' }),
    requestPermissionsAsync: async () => ({ status: 'granted' }),
    getExpoPushTokenAsync: async () => ({ data: 'ExponentPushToken[abcdefghijklmnopqrstuvwxyz]' }),
    ...notif,
  };
  const deps = {
    Notifications,
    Platform: { OS: platform },
    Device: { isDevice: true },
    Constants: { expoConfig: { extra: { eas: { projectId: '198017e2-e97b-4995-b52d-b442fe9d316e' } } } },
    apiUrl: 'https://api.example.test',
    fetch: fetchImpl || (async (url, opts) => { llamadas.fetch.push({ url, opts }); return { json: async () => json || { ok: true } }; }),
    log: { info: (...a) => llamadas.info.push(a), error: (...a) => llamadas.error.push(a) },
  };
  return { deps, llamadas };
}

test('success path reaches the API with the right body', async () => {
  let envio = null;
  const { deps } = montar({ fetchImpl: async (url, opts) => { envio = { url, method: opts.method, headers: opts.headers, body: JSON.parse(opts.body) }; return { json: async () => ({ ok: true }) }; } });
  await registrarPushToken('b1', deps);
  // the same request as origin/main before the refactor: URL, method, headers, and exactly { bid, token }
  assert.equal(envio.url, 'https://api.example.test/push/token');
  assert.equal(envio.method, 'POST');
  assert.deepEqual(envio.headers, { 'Content-Type': 'application/json' });
  assert.deepEqual(Object.keys(envio.body).sort(), ['bid', 'token']);
  assert.equal(envio.body.bid, 'b1');
  assert.match(envio.body.token, /^ExponentPushToken/);
});

test('token step fails (no google-services, as in the preview): resolves, logs once, no API call', async () => {
  let llamoApi = false;
  const { deps, llamadas } = montar({
    notif: { getExpoPushTokenAsync: async () => { throw new Error('FirebaseApp is not initialized'); } },
    fetchImpl: async () => { llamoApi = true; return { json: async () => ({}) }; },
  });
  await assert.doesNotReject(registrarPushToken('b1', deps));
  assert.equal(llamoApi, false);
  assert.equal(llamadas.error.length, 1);
  assert.match(llamadas.error[0].join(' '), /FirebaseApp is not initialized/);
});

test('a rejection with no value (undefined) does not become an unhandled error', async () => {
  const { deps, llamadas } = montar({ notif: { getExpoPushTokenAsync: async () => { throw undefined; } } });
  await assert.doesNotReject(registrarPushToken('b1', deps));
  assert.equal(llamadas.error.length, 1, 'logged, not thrown');
});

test('the Android channel step fails: resolves', async () => {
  const { deps } = montar({ notif: { setNotificationChannelAsync: async () => { throw new Error('canal'); } } });
  await assert.doesNotReject(registrarPushToken('b1', deps));
});

test('the permission step fails: resolves', async () => {
  const { deps } = montar({ notif: { getPermissionsAsync: async () => { throw new Error('perm'); } } });
  await assert.doesNotReject(registrarPushToken('b1', deps));
});

test('the network fails, or the API answers something that is not JSON: resolves', async () => {
  const { deps: d1 } = montar({ fetchImpl: async () => { throw new Error('offline'); } });
  await assert.doesNotReject(registrarPushToken('b1', d1));
  const { deps: d2 } = montar({ fetchImpl: async () => ({ json: async () => { throw new SyntaxError('html'); } }) });
  await assert.doesNotReject(registrarPushToken('b1', d2));
});

test('web: aborts before touching the native module', async () => {
  let toco = false;
  const { deps, llamadas } = montar({ platform: 'web', notif: { getPermissionsAsync: async () => { toco = true; return { status: 'granted' }; } } });
  await registrarPushToken('b1', deps);
  assert.equal(toco, false);
  assert.equal(llamadas.info.length, 1);
});

test('the login effect never awaits the registration (a slow or failing push cannot hold login)', () => {
  const app = fs.readFileSync(new URL('../App.js', import.meta.url), 'utf8');
  assert.equal(/await\s+registrarPushToken/.test(app), false);
  assert.match(app, /if \(usuario\.rol === 'barbero' \|\| usuario\.rol === 'admin'\) registrarPushToken\(usuario\.bid\);/);
});

test('the core module logs nothing with the answer itself (only the steps, as before)', () => {
  const src = fs.readFileSync(new URL('../src/services/pushRegistro.js', import.meta.url), 'utf8');
  assert.equal(/console\./.test(src), false, 'logging goes through the injected log');
});
