// Cobrar (Sillas, admin): the sheet's rules, with no React Native imports so it can be tested in Node.
// The server does the real closing (POST /api/v2/sillas/cobrar); this module prepares what the sheet shows, decides
// whether Confirm is allowed, and turns the answer into a Spanish message. Nothing here decides a charge.
//
// Shape of the server's payment methods (GET /config/negocio → metodos_pago, copied to catalogo.metodosPago):
//   { clave: 'efectivo' | 'debito' | 'transferencia', etiqueta: 'Efectivo' | 'Tarjeta' | ..., pct_barbero: 50, activo: true, orden: 1 }

const CLAVES_ACEPTADAS = ['efectivo', 'debito', 'transferencia'];
const ICONOS = { efectivo: '💵', debito: '💳', transferencia: '📲' };

export function fmtPeso(n) {
  return '$' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Active payment methods from the server's list: key, label, and the barber's share (for display only).
export function metodosCobro(catalogo) {
  const lista = catalogo && Array.isArray(catalogo.metodosPago) ? catalogo.metodosPago : [];
  return lista
    .filter((m) => m && m.activo !== false && CLAVES_ACEPTADAS.includes(m.clave))
    .map((m) => {
      const etiqueta = m.etiqueta || m.clave;
      return {
        clave: m.clave,
        etiqueta,
        label: (ICONOS[m.clave] || '💳') + ' ' + etiqueta,
        pct: typeof m.pct_barbero === 'number' ? m.pct_barbero : null,
      };
    });
}

// Price of the service in the catalogue (by name, or id). null when there is no match.
export function precioDelServicio(catalogo, servicio) {
  const lista = catalogo && Array.isArray(catalogo.servicios) ? catalogo.servicios : [];
  const buscado = String(servicio || '').trim().toLowerCase();
  if (!buscado) return null;
  const hit = lista.find((x) => String(x.nom || '').trim().toLowerCase() === buscado || String(x.id || '').toLowerCase() === buscado);
  return hit && hit.precio > 0 ? hit.precio : null;
}

// Tip options: 'ninguna' | 'diez' (10 % of the service) | 'otro' (a typed amount).
export function propinaCalculada(modo, precio, otroMonto) {
  if (modo === 'diez') return Math.round(precio * 0.10);
  if (modo === 'otro') return Math.max(0, parseInt(otroMonto, 10) || 0);
  return 0;
}

// Summary for the chosen method. The tip is never part of the commission: it goes entirely to the barber.
export function resumenCobro(metodos, clave, precio, propina) {
  const m = (metodos || []).find((x) => x.clave === clave);
  if (!m || m.pct == null || !(precio > 0)) return null;
  const bb = Math.round(precio * m.pct / 100);
  const neg = precio - bb;
  return {
    monto: precio,
    bb,
    neg,
    propina,
    barberoRecibe: bb + propina,
    textoMonto: fmtPeso(precio),
    textoBarbero: fmtPeso(bb + propina),
    textoNegocio: fmtPeso(neg),
  };
}

// What the sheet shows and whether Confirm is allowed. Confirm needs: the catalogue loaded, a method chosen,
// the price known, and no charge already in flight. The first missing piece is the reason shown.
export function estadoCobro({ catalogo, servicio, pago, propina, busy }) {
  const metodos = metodosCobro(catalogo);
  const precio = precioDelServicio(catalogo, servicio);
  return { metodos, precio, ...evaluarCobro({ catalogo, metodos, pago, propina, busy, precio }) };
}

// Pure decision used by estadoCobro and by the tests: { motivo, puedeConfirmar, resumen }.
export function evaluarCobro({ catalogo, metodos, pago, propina, busy, precio }) {
  let motivo = null;
  if (catalogo && catalogo.cargando === true) motivo = 'Cargando precios y métodos de pago…';
  else if (!metodos || metodos.length === 0) motivo = 'No hay métodos de pago configurados. Avisa al administrador.';
  else if (!precio) motivo = 'No encuentro el precio de este servicio. Avisa al administrador antes de cobrar.';
  else if (!pago) motivo = 'Elige un método de pago.';
  else if (busy) motivo = 'Cobrando…';
  const resumen = precio && pago ? resumenCobro(metodos, pago, precio, propina) : null;
  return { motivo, puedeConfirmar: motivo === null && resumen !== null, resumen };
}

// Server answers → { estado, mensaje }. The real reason is shown in Spanish; when the server gives no detail, its code is shown.
export function mensajeDeRespuesta(status, j) {
  const error = (j && j.error) || '';
  const detalle = (j && j.detalle) || '';
  if (status === 401 || status === 403) return { estado: 'sesion', mensaje: 'Tu sesión de administrador venció. Ingresa de nuevo para cobrar.' };
  if (status === 409 && error === 'already_closed') return { estado: 'ya_cobrado', mensaje: 'Este servicio ya estaba cobrado. Revisé la silla.' };
  if (status === 409) return { estado: 'en_curso', mensaje: 'El cobro de este servicio ya está en curso. Espera un momento y revisa la silla.' };
  if (status === 404) return { estado: 'rechazado', mensaje: 'Este cliente ya no está en la cola. Revisa la silla.' };
  if (error === 'queue_id, bid y pago requeridos') return { estado: 'rechazado', mensaje: 'Falta el método de pago o el barbero. Elige el método y vuelve a intentar.' };
  if (error === 'precio_no_disponible' || error === 'precio_no_coincide') return { estado: 'sin_precio', mensaje: 'No hay precio para este servicio en el catálogo. Avisa al administrador antes de cobrar.' };
  if (detalle) return { estado: 'rechazado', mensaje: detalle };
  if (status >= 500) return { estado: 'red', mensaje: 'El servidor respondió con error (código ' + status + '). No se cobró. Revisa la silla antes de intentar otra vez.' };
  return { estado: 'rechazado', mensaje: 'No se cobró (código ' + status + ': ' + (error || 'sin detalle') + '). Avisa al administrador.' };
}

// One call per tap or retry. The server claims the queue entry, so a repeated call never writes a second sale.
export async function enviarCobro(fetchAutenticado, body) {
  let r;
  try {
    r = await fetchAutenticado('/api/v2/sillas/cobrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return {
      estado: 'red',
      mensaje: 'No se pudo confirmar el cobro por la red. Revisaré la silla: si sigue en “Cortando”, puedes intentarlo de nuevo sin riesgo de cobrar dos veces.',
    };
  }
  let j = {};
  try { j = await r.json(); } catch { /* non-JSON: handled by status */ }
  if (r.ok && j.ok) return { estado: 'ok', data: j, mensaje: 'Cobro registrado.' };
  return mensajeDeRespuesta(r.status, j);
}
