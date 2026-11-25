// Read-only guard for the PREVIEW build. Pure: no React Native, no Expo, so the node tests can drive it.
// The App installs it only when the build-time variant is 'preview' (see previewGuard.js). Production: the install is a no-op.
// Fail closed: anything not explicitly allowed is refused BEFORE it reaches the network, with a distinct error code.

export const MENSAJE_BLOQUEO = 'Esta acción no está disponible en la copia de prueba.';
export const CODIGO_BLOQUEO = 'GUARD_BLOQUEADO';
// Self-test target: a local discard port. The guard must refuse it (own error); a network error means the guard is not on the global fetch.
export const URL_AUTOPRUEBA = 'http://127.0.0.1:9/__guard_selftest';

// The only write the preview may send: the login. The App has no server logout call (logout clears local state only), so nothing else is allowed.
export const ESCRITURAS_PERMITIDAS = Object.freeze([
  Object.freeze({ method: 'POST', path: '/api/v2/auth/login' }),
]);

// GET requests that change server state (the server marks messages as read on GET /mensajes/:bid): refused too.
export const GET_BLOQUEADOS = Object.freeze([/^\/mensajes\//]);

// Decides one request. Returns { permitido, motivo }. Any URL that does not parse is refused.
export function decidir(method, url) {
  let path;
  try { path = new URL(String(url), 'http://guard.invalid').pathname; }
  catch { return { permitido: false, motivo: 'url_invalida' }; }
  const m = String(method || 'GET').toUpperCase();
  if (m === 'GET' || m === 'HEAD') {
    return GET_BLOQUEADOS.some(re => re.test(path)) ? { permitido: false, motivo: 'get_con_escritura' } : { permitido: true };
  }
  return ESCRITURAS_PERMITIDAS.some(e => e.method === m && e.path === path)
    ? { permitido: true }
    : { permitido: false, motivo: 'escritura_no_permitida' };
}

// Installs the guard on `target.fetch` when variante === 'preview'. `realFetch` is the function captured before the install.
// Returns { activo, wrapper }. With any other variant nothing is touched and the function returns { activo: false }.
export function instalarGuardia({ variante, target, realFetch, onBloqueo }) {
  if (variante !== 'preview') return { activo: false };
  const original = realFetch;
  const wrapper = (input, init) => {
    const url = typeof input === 'string' ? input : (input && input.url) || String(input);
    const method = (init && init.method) || (input && input.method) || 'GET';
    const d = decidir(method, url);
    if (!d.permitido) {
      if (typeof onBloqueo === 'function') { try { onBloqueo(d.motivo); } catch {} }
      return Promise.reject(Object.assign(new Error(MENSAJE_BLOQUEO), { code: CODIGO_BLOQUEO, motivo: d.motivo }));
    }
    return original(input, init);
  };
  target.fetch = wrapper;
  return { activo: true, wrapper };
}

// Self-test, run after the install through the GLOBAL fetch. 'activo': the refusal came from the guard.
// 'fallido': the request reached the network, or failed for another reason. The App then blocks itself.
export async function autoprueba(fetchGlobal) {
  try {
    await fetchGlobal(URL_AUTOPRUEBA, { method: 'POST' });
    return 'fallido';
  } catch (e) {
    return e && e.code === CODIGO_BLOQUEO ? 'activo' : 'fallido';
  }
}
