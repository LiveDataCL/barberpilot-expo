// What one service earns this barber on average (server figure: own history of the last days, or the cold-start estimate).
// null when the server cannot say: the screens then show no services target rather than a wrong one.
export async function cargarIngresoPorServicio(api, bid) {
  try {
    const r = await api.get('/barberos/' + encodeURIComponent(bid) + '/ingreso-por-servicio');
    return r && r.ok && Number.isFinite(r.ingreso_por_servicio) && r.ingreso_por_servicio > 0 ? r.ingreso_por_servicio : null;
  } catch (e) {
    return null;
  }
}
