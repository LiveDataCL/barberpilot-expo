// Per-service breakdown shown to the barber (DISPLAY ONLY).
//
// Every number comes from fields the server already stores on the sale
// (registro): `precio` (what was charged), `bb` (the barber's commission for
// the payment method, computed and stored by the server) and `propina`.
// Nothing is recomputed from a rate here and nothing is written back.
// The tip is NEVER added into the commission figure: it is always its own line.
// "Total por el servicio" = bb + propina, the same sum the rows already showed
// as a single number (HoyScreen / LiquidacionScreen); the cierre and the bonus
// keep reading r.bb and r.propina exactly as before.
//
// Self-contained on purpose (no react-native imports) so it can be unit tested
// with plain `node --test`.

// Chilean pesos: "$" + dot as thousands separator, no decimals. Done by hand
// (not toLocaleString) so the output never depends on the device's Intl data.
export function formatPesos(n) {
  const v = Math.round(Number(n) || 0);
  const abs = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (v < 0 ? '-$' : '$') + abs;
}

const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);

// r: { snom, precio, bb, propina }
// Returns { filas: [{ etiqueta, valor, tipo }], resumen: string|null, total }
//   tipo: 'cobrado' | 'ganancia' | 'propina' | 'total'
// The "propina" row exists only when there is a tip; `resumen` (the
// "Corte $6.500 + Propina $1.000 = $7.500" line) likewise only with a tip.
export function desgloseServicio(r) {
  const nombre = (r && r.snom) || 'Servicio';
  const precio = num(r && r.precio);
  const bb = num(r && r.bb);
  const propina = num(r && r.propina);
  const total = bb + propina;

  const filas = [
    { etiqueta: nombre, valor: `${formatPesos(precio)} cobrado`, tipo: 'cobrado' },
    { etiqueta: 'Tu ganancia', valor: formatPesos(bb), tipo: 'ganancia' },
  ];
  if (propina > 0) filas.push({ etiqueta: 'Propina', valor: formatPesos(propina), tipo: 'propina' });
  filas.push({ etiqueta: 'Total por el servicio', valor: formatPesos(total), tipo: 'total' });

  const resumen = propina > 0
    ? `${nombre} ${formatPesos(bb)} + Propina ${formatPesos(propina)} = ${formatPesos(total)}`
    : null;

  return { filas, resumen, total };
}
