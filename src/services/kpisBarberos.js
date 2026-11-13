// Per-barber figures from a list of registros (one day in Resumen, one month in Análisis).
// ONE implementation for both tabs: the rules here are the ones Análisis always used.
//   svc   = number of services
//   fact  = facturado (sum of precio)
//   bb    = barber income (sum of bb + propina), as Análisis has always shown it
//   servicios = count per service name
// Registros of a barber not in `barberos` are ignored.
export function kpisPorBarbero(registros, barberos) {
  const kpis = {};
  (barberos || []).forEach(b => { kpis[b.bid] = { svc: 0, fact: 0, bb: 0, servicios: {} }; });
  (registros || []).forEach(r => {
    const k = kpis[r.bid];
    if (!k) return;
    k.svc++;
    k.fact += r.precio || 0;
    k.bb   += (r.bb || 0) + (r.propina || 0);
    k.servicios[r.snom] = (k.servicios[r.snom] || 0) + 1;
  });
  return kpis;
}
