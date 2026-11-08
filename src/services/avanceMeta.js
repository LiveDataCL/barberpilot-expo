// Billing figure and labels of the monthly projection card in "Vista socios" (display only; no formula of its own).
//
// The API decides what counts toward the goal progress and the billing projection (branch feature/kpi-goal-barber-associated): from the start period, sales
// associated with a barber, services AND products, no tips. It says so on the projection block of GET /stats/mes/:periodo with `regla_avance: 'barbero_asociado'`.
// This module reads ONLY that block: the figure is `a_la_fecha` (billing from the start of the month to today: the same number as the KPI's
// `meta.facturacion_servicios`), the label follows the marker. Without the marker (an older month, an older API, or the rule switched off) the card is drawn
// EXACTLY as before. A block that does not carry usable numbers is never guessed: the old drawing is used.
// Self-contained on purpose (no react-native imports) so it can be unit tested with plain `node --test`.

export const REGLA_BARBERO_ASOCIADO = 'barbero_asociado';
export const ETIQUETA_AVANCE = 'Facturación (servicios + productos de barberos)';

const num = (x) => (x === null || x === undefined || x === '' ? NaN : Number(x));

// pb: the projection block (mesR.proyeccion). Returns null when the old drawing applies.
export function avanceMeta(pb) {
  if (!pb || pb.regla_avance !== REGLA_BARBERO_ASOCIADO || !pb.a_la_fecha) return null;
  const servicios = num(pb.a_la_fecha.servicios), productos = num(pb.a_la_fecha.productos);
  if (!Number.isFinite(servicios) || !Number.isFinite(productos) || servicios < 0 || productos < 0) return null;
  return { servicios, productos, total: servicios + productos };
}

// Texts of the projection card. avance: avanceMeta(pb) or null. `old`: { fact, prod } = the figures the card always showed (services / products of the month).
// fmt: the money formatter of the app.
export function textosProyeccion({ avance, mes, old, fmt }) {
  if (avance) {
    return {
      titulo: `PROYECCION FACTURACION (servicios + productos de barberos) ${mes}`,
      detalle: `${ETIQUETA_AVANCE}: $${fmt(avance.total)}`,
    };
  }
  return {
    titulo: `PROYECCION SERVICIOS ${mes}`,
    detalle: `Servicios del mes: $${fmt(old.fact)} · Productos: $${fmt(old.prod)}`,
  };
}

// The line under "TOTAL FACTURADO · período" used to say the services figure is "base de meta y proyección". That is only true on the old rule.
export function etiquetaServiciosPeriodo(avance) {
  return avance ? 'Servicios' : 'Servicios (base de meta y proyección)';
}
