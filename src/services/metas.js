// Last-resort fallback values — used only when GET /config/negocio hasn't
// succeeded yet (first launch, offline) and no cached response exists either.
// Live data comes from configNegocio (App.js's catalogo.meta/calendario),
// passed into getMetaBarbero/getMetaNegocio below.
const METAS_NEGOCIO_FALLBACK = {
  '2026-05': 6500000,
  '2026-06': 8000000,
  '2026-07': 9500000,
  '2026-08': 11500000,
  '2026-09': 13500000,
  '2026-10': 15500000,
  '2026-11': 17000000,
  '2026-12': 19000000,
  '2027-01': 17000000,
  '2027-02': 18500000,
  '2027-03': 20000000,
  '2027-04': 21500000,
};
const NUM_BARBEROS_FALLBACK = 4;

function getDiasHabilesDelMesFallback(año, mes) {
  // mes es 0-indexed (0=enero, 5=junio). Sundays-only exclusion — no feriado
  // awareness, unlike the server's calendario.dias_habiles_crudos.
  const diasEnMes = new Date(año, mes + 1, 0).getDate();
  let habiles = 0;
  for (let d = 1; d <= diasEnMes; d++) {
    const dow = new Date(año, mes, d).getDay();
    if (dow !== 0) habiles++;
  }
  return habiles;
}

// Resolves the current month's total business goal + barber count + días
// hábiles from configNegocio when available (real, feriado-aware server
// data), falling back to the hardcoded tables above when it isn't (not yet
// fetched, or fetch failed and no cache exists).
function resolverInsumos(configNegocio) {
  const hoy = new Date();
  const usarServidor = !!(configNegocio && configNegocio.meta && configNegocio.calendario
    && configNegocio.meta.facturacion_meta_calculada != null);
  if (usarServidor) {
    return {
      metaMes: configNegocio.meta.facturacion_meta_calculada,
      numBarberos: configNegocio.meta.barberos_activos || NUM_BARBEROS_FALLBACK,
      diasHabiles: configNegocio.calendario.dias_habiles_crudos || getDiasHabilesDelMesFallback(hoy.getFullYear(), hoy.getMonth()),
    };
  }
  const mesKey = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0');
  return {
    metaMes: METAS_NEGOCIO_FALLBACK[mesKey] || 8000000,
    numBarberos: NUM_BARBEROS_FALLBACK,
    diasHabiles: getDiasHabilesDelMesFallback(hoy.getFullYear(), hoy.getMonth()),
  };
}

export function getMetaBarbero(periodo, configNegocio) {
  const { metaMes, numBarberos, diasHabiles } = resolverInsumos(configNegocio);
  const metaDiariaBarbero = (metaMes / diasHabiles) / numBarberos;

  if (periodo === 'hoy')
    return Math.round(metaDiariaBarbero * 0.50);
  if (periodo === 'semana')
    return Math.round(metaDiariaBarbero * 6 * 0.50);
  if (periodo === 'mes')
    return Math.round((metaMes / numBarberos) * 0.50);
  return Math.round(metaDiariaBarbero * 0.50);
}

export function getMetaNegocio(periodo, configNegocio) {
  const { metaMes, diasHabiles } = resolverInsumos(configNegocio);
  if (periodo === 'hoy')
    return Math.round(metaMes / diasHabiles);
  if (periodo === 'semana')
    return Math.round((metaMes / diasHabiles) * 6);
  if (periodo === 'mes') return metaMes;
  return Math.round(metaMes / diasHabiles);
}
