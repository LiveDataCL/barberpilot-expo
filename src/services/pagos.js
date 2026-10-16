// Payment methods and commission preview (stage 3b).
// Names and rates come from the server (GET /config/negocio → metodos_pago,
// kept in the catalog state and its cache). The server computes and stores
// the real commission of every sale, so the rates here are only for showing
// a preview before saving. The tip is never part of the commission: it is
// sent only as `propina`.
import { COLORS } from '../constants';

// Look per payment key (icon and color only — not business values).
const ESTILO_PAGO = {
  efectivo:      { icono: '💵', color: COLORS.ok,   bg: 'rgba(77,184,122,.15)' },
  debito:        { icono: '💳', color: COLORS.blue, bg: 'rgba(85,130,212,.15)' },
  transferencia: { icono: '📲', color: COLORS.gold, bg: 'rgba(201,168,76,.15)' },
};
const ESTILO_OTRO = { icono: '💳', color: COLORS.text2, bg: 'rgba(255,255,255,.06)' };

// Payment keys the server accepts, used only when the server list hasn't
// arrived yet (no names or rates are assumed; the server still validates).
const CLAVES_BASE = ['efectivo', 'debito', 'transferencia'];

function lista(catalogo) {
  return catalogo && Array.isArray(catalogo.metodosPago) ? catalogo.metodosPago : null;
}
export function metodoPago(catalogo, clave) {
  const l = lista(catalogo);
  return l ? l.find(m => m.clave === clave) || null : null;
}
export function etiquetaPago(catalogo, clave) {
  const m = metodoPago(catalogo, clave);
  return m ? m.etiqueta : clave;
}
export function iconoPago(clave) {
  return (ESTILO_PAGO[clave] || ESTILO_OTRO).icono;
}
// Buttons for the active methods, in the server's order.
export function botonesPago(catalogo) {
  const l = lista(catalogo);
  const activos = l ? l.filter(m => m.activo) : CLAVES_BASE.map(clave => ({ clave, etiqueta: clave }));
  return activos.map(m => {
    const e = ESTILO_PAGO[m.clave] || ESTILO_OTRO;
    return { id: m.clave, label: `${e.icono} ${m.etiqueta}`, color: e.color, bg: e.bg };
  });
}
// Barber commission for a SERVICE: { com, bb, neg } or null when the rates
// aren't loaded (the screen then says the commission is computed on save).
export function comisionPreview(catalogo, clave, precio) {
  const m = metodoPago(catalogo, clave);
  if (!m || !m.activo || !(precio > 0)) return null;
  const com = m.pct_barbero / 100;
  const bb = Math.round(precio * com);
  return { com, bb, neg: precio - bb };
}
