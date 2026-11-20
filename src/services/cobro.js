import { comisionPreview, botonesPago } from './pagos';
import { fmt } from '../constants';

// Cobrar (Sillas, admin): the sheet's rules. The server does the real closing (POST /api/v2/sillas/cobrar); this module
// only prepares what the sheet shows and turns the answer into a Spanish message. Nothing here decides a charge.

// Price of the service in the catalogue (by name, or id). null when the catalogue has no match: the sheet then blocks Cobrar.
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

// Summary shown before the confirm. The tip is never part of the commission (it goes entirely to the barber).
export function resumenCobro(catalogo, pago, precio, propina) {
  const cp = comisionPreview(catalogo, pago, precio);
  if (!cp) return null;
  return {
    monto: precio,
    barberoRecibe: cp.bb + propina,
    negocioRetiene: cp.neg,
    propina,
    textoMonto: '$' + fmt(precio),
    textoBarbero: '$' + fmt(cp.bb + propina),
    textoNegocio: '$' + fmt(cp.neg),
  };
}

// Payment buttons from the server's list (active methods only), with the barber's share for display.
export function metodosCobro(catalogo) {
  return botonesPago(catalogo).map((m) => ({
    clave: m.clave,
    etiqueta: m.etiqueta,
    pct: (catalogo && Array.isArray(catalogo.metodosPago) && (catalogo.metodosPago.find((x) => x.clave === m.clave) || {}).pct_barbero) || null,
  }));
}

// One call per tap or retry. The server claims the queue entry, so a repeated call never writes a second sale.
// Returns { estado, mensaje, data }.
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
  if (r.status === 401 || r.status === 403) {
    return { estado: 'sesion', mensaje: 'Tu sesión de administrador venció. Ingresa de nuevo para cobrar.' };
  }
  if (r.status === 409 && j.error === 'already_closed') {
    return { estado: 'ya_cobrado', mensaje: 'Este servicio ya estaba cobrado. Revisé la silla.' };
  }
  if (r.status === 409) {
    return { estado: 'en_curso', mensaje: 'El cobro de este servicio ya está en curso. Espera un momento y revisa la silla.' };
  }
  if (j.error === 'precio_no_disponible' || j.error === 'precio_no_coincide') {
    return { estado: 'sin_precio', mensaje: 'No encuentro el precio de este servicio. Avisa al administrador antes de cobrar.' };
  }
  if (r.status >= 500) {
    return { estado: 'red', mensaje: 'El servidor no respondió bien. Revisa la silla antes de intentarlo otra vez.' };
  }
  return { estado: 'rechazado', mensaje: (j.detalle || 'No se pudo cobrar este servicio.') };
}
