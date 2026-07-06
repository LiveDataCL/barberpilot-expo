const METAS_NEGOCIO = {
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

// TODO: replace hardcoded 4 with dynamic barber count from useBarberos() or GET /barberos
const NUM_BARBEROS = 4;

function getDiasHabilesDelMes(año, mes) {
  // mes es 0-indexed (0=enero, 5=junio)
  const diasEnMes = new Date(año, mes + 1, 0).getDate();
  let habiles = 0;
  for (let d = 1; d <= diasEnMes; d++) {
    const dow = new Date(año, mes, d).getDay();
    if (dow !== 0) habiles++; // excluir domingos
  }
  return habiles;
}

export function getMetaBarbero(periodo) {
  const hoy = new Date();
  const mesKey = hoy.getFullYear() + '-' +
    String(hoy.getMonth() + 1).padStart(2, '0');
  const metaMes = METAS_NEGOCIO[mesKey] || 8000000;
  const diasHabiles = getDiasHabilesDelMes(
    hoy.getFullYear(), hoy.getMonth()
  );
  const metaDiariaBarbero =
    (metaMes / diasHabiles) / NUM_BARBEROS;

  if (periodo === 'hoy')
    return Math.round(metaDiariaBarbero * 0.50);
  if (periodo === 'semana')
    return Math.round(metaDiariaBarbero * 6 * 0.50);
  if (periodo === 'mes')
    return Math.round((metaMes / NUM_BARBEROS) * 0.50);
  return Math.round(metaDiariaBarbero * 0.50);
}

export function getMetaNegocio(periodo) {
  const hoy = new Date();
  const mesKey = hoy.getFullYear() + '-' +
    String(hoy.getMonth() + 1).padStart(2, '0');
  const metaMes = METAS_NEGOCIO[mesKey] || 8000000;
  const diasHabiles = getDiasHabilesDelMes(
    hoy.getFullYear(), hoy.getMonth()
  );
  if (periodo === 'hoy')
    return Math.round(metaMes / diasHabiles);
  if (periodo === 'semana')
    return Math.round((metaMes / diasHabiles) * 6);
  if (periodo === 'mes') return metaMes;
  return Math.round(metaMes / diasHabiles);
}
