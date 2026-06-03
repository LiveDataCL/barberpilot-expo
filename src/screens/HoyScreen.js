import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { COLORS, fmt, fmtM, hoy, mesPeriodo } from '../constants';
import CalendarioModal from './CalendarioModal';
import MetaBanner from './MetaBanner';
import { updateDayNotification } from '../services/DayNotification';

const KPI_LABELS = {
  apertura:   'Apertura',
  estacion:   'Estación de trabajo',
  aseo_entre: 'Aseo entre servicios',
  aseo_comun: 'Aseo áreas comunes',
  visajismo:  'Visajismo',
  upselling:  'Upselling',
  atencion:   'Atención al cliente',
  relacion:   'Relación con el cliente',
  uniforme:   'Uniforme',
  cierre:     'Cierre de servicio',
};

const KPI_MAX = 35; // 10 métricas × max 3.5 pts

function calcBonus(disq, pct) {
  if (disq) return 0;
  if (pct >= 90) return 150000;
  if (pct >= 75) return 100000;
  if (pct >= 60) return 50000;
  return 0;
}

const API_URL = 'https://barberpilot-api-production.up.railway.app';

const PERIODOS = [
  { id: 'hoy',    label: 'Hoy'         },
  { id: 'semana', label: 'Esta semana' },
  { id: 'mes',    label: 'Este mes'    },
  { id: 'custom', label: 'Fecha...'    },
  { id: 'custom2', label: 'Historico' },
];

const PAGO_STYLE = {
  efectivo:      { bg: 'rgba(77,184,122,.15)',  color: '#4db87a', label: 'EF' },
  debito:        { bg: 'rgba(85,130,212,.15)',  color: '#5580d4', label: 'DB' },
  transferencia: { bg: 'rgba(201,168,76,.15)',  color: '#c9a84c', label: 'TR' },
};

function getFechaDesde(periodo, customDesde) {
  const d = new Date();
  if (periodo === 'hoy')    return hoy();
  if (periodo === 'custom' || periodo === 'custom2') return customDesde || hoy();
  if (periodo === 'semana') {
    const dia = d.getDay();
    const diasAtras = dia === 0 ? 6 : dia - 1;
    d.setDate(d.getDate() - diasAtras);
  } else if (periodo === 'mes') {
    d.setDate(1);
  } else if (periodo === 'todo') {
    return '2026-01-01';
  }
  return d.toISOString().slice(0,10);
}

async function cargarRegistrosPeriodo(bid, periodo) {
  const desde  = getFechaDesde(periodo);
  const hasta  = hoy();
  const dias   = [];
  let cur = new Date(desde + 'T12:00:00');
  const fin = new Date(hasta + 'T12:00:00');
  while (cur <= fin) {
    dias.push(cur.toISOString().slice(0,10));
    cur.setDate(cur.getDate()+1);
  }
  const results = await Promise.all(
    dias.map(f =>
      fetch(`${API_URL}/registros/dia?fecha=${f}`)
        .then(r => r.json()).catch(() => ({ ok:false, registros:[] }))
    )
  );
  let regs = [];
  results.forEach(r => {
    if (r.ok && r.registros) {
      regs = regs.concat(r.registros.filter(x => x.bid === bid));
    }
  });
  return regs;
}

export default function HoyScreen({ barbero }) {
  const [periodo,       setPeriodo]      = useState('hoy');
  const [regs,          setRegs]         = useState([]);
  const [loading,       setLoading]      = useState(true);
  const [refreshing,    setRefreshing]   = useState(false);
  const [showCal,       setShowCal]      = useState(false);
  const [fechaDesde,    setFechaDesde]   = useState('');
  const [fechaHasta,    setFechaHasta]   = useState('');
  const [agenda,        setAgenda]       = useState([]);
  const [agendaVisible, setAgendaVisible]= useState(false);
  const [kpi,           setKpi]          = useState(null);
  const [kpiVisible,    setKpiVisible]   = useState(false);
  const [avgTicket,     setAvgTicket]    = useState(13000);

  const cargar = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const desde = getFechaDesde(periodo, fechaDesde);
      const hasta = periodo === 'custom' && fechaHasta ? fechaHasta : hoy();
      // Cargar días entre desde y hasta
      const dias = [];
      let cur = new Date(desde + 'T12:00:00');
      const fin = new Date(hasta + 'T12:00:00');
      while (cur <= fin) {
        dias.push(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
      }
      const results = await Promise.all(
        dias.map(f =>
          fetch(`${API_URL}/registros/dia?fecha=${f}`)
            .then(r => r.json()).catch(() => ({ ok: false, registros: [] }))
        )
      );
      let regsNew = [];
      results.forEach(r => {
        if (r.ok && r.registros) {
          regsNew = regsNew.concat(r.registros.filter(x => x.bid === barbero.bid));
        }
      });
      setRegs(regsNew);
      // Actualizar notificación persistente solo en vista de hoy
      if (periodo === 'hoy') {
        const _n    = regsNew.length;
        const _fact = regsNew.reduce((a, r) => a + (r.precio || 0), 0);
        const _bb   = regsNew.reduce((a, r) => a + (r.bb || 0) + (r.propina || 0), 0);
        updateDayNotification(barbero, _n, _fact, _bb);
      }
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [barbero, periodo, fechaDesde, fechaHasta]);

  useEffect(() => { cargar(); }, [periodo]);

  // Cargar agenda al montar y cuando cambia el barbero
  useEffect(() => {
    fetch(`${API_URL}/agenda/hoy`)
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setAgenda((data.agenda || []).filter(a => a.bid === barbero.bid));
        }
      })
      .catch(() => {});
  }, [barbero.bid]);

  // Cargar KPI del mes actual
  useEffect(() => {
    fetch(`${API_URL}/kpi/${mesPeriodo()}`)
      .then(r => r.json())
      .then(data => {
        if (!data.ok) return;
        const rows = (data.evaluaciones || []).filter(e => e.bid === barbero.bid);
        if (!rows.length) return;
        const disqRow   = rows.find(e => e.metrica === '_disq');
        const metricas  = rows.filter(e => e.metrica !== '_disq');
        const rawScore  = metricas.reduce((a, e) => a + parseFloat(e.valor || 0), 0);
        const pct       = Math.min(100, Math.round(rawScore / KPI_MAX * 100));
        const disq      = disqRow?.disq || false;
        setKpi({
          metricas,
          disq,
          disqMotivo: disqRow?.disq_motivo || '',
          rawScore,
          pct,
          bonus: calcBonus(disq, pct),
        });
      })
      .catch(() => {});
  }, [barbero.bid]);

  // avgTicket: ticket promedio real de los últimos 30 días (independiente del período)
  useEffect(() => {
    const fetchAvgTicket = async () => {
      try {
        const desde = new Date();
        desde.setDate(desde.getDate() - 30);
        const desdeStr = desde.toISOString().slice(0, 10);
        const hastaStr = new Date().toISOString().slice(0, 10);
        const days = [];
        let cur = new Date(desdeStr + 'T12:00:00');
        const fin = new Date(hastaStr + 'T12:00:00');
        while (cur <= fin) {
          days.push(cur.toISOString().slice(0, 10));
          cur.setDate(cur.getDate() + 1);
        }
        const results = await Promise.all(
          days.map(f =>
            fetch(`${API_URL}/registros/dia?fecha=${f}`)
              .then(r => r.json())
              .catch(() => ({ ok: false, registros: [] }))
          )
        );
        let allRegs = [];
        results.forEach(r => {
          if (r.ok && r.registros)
            allRegs = allRegs.concat(r.registros.filter(x => x.bid === barbero.bid));
        });
        if (allRegs.length > 0) {
          const avg = Math.round(
            allRegs.reduce((a, r) => a + (r.precio || 0), 0) / allRegs.length
          );
          setAvgTicket(avg);
        }
      } catch(e) {
        console.log('avgTicket fetch error:', e.message);
      }
    };
    fetchAvgTicket();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Stats calculados
  const n    = regs.length;
  const fact = regs.reduce((a,r) => a+(r.precio||0), 0);
  const bb   = regs.reduce((a,r) => a+(r.bb||0)+(r.propina||0), 0);
  const prop = regs.reduce((a,r) => a+(r.propina||0), 0);
  const tk   = n>0 ? Math.round(fact/n) : 0;

  // Desglose por pago
  const porPago = {};
  regs.forEach(r => {
    if (!porPago[r.pago]) porPago[r.pago] = { n:0, bb:0 };
    porPago[r.pago].n++;
    porPago[r.pago].bb += (r.bb||0)+(r.propina||0);
  });

  return (
    <ScrollView
      style={s.scroll} contentContainerStyle={s.content}
      refreshControl={
        <RefreshControl refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); cargar(true); }}
          tintColor={COLORS.gold} colors={[COLORS.gold]} />
      }
    >
      {/* Selector de período */}
      <View style={s.periodos}>
        {PERIODOS.map(p => (
          <TouchableOpacity key={p.id}
            style={[s.periodoBtn, periodo===p.id && s.periodoBtnOn]}
            onPress={() => {
              if (p.id === 'custom' || p.id === 'custom2') { setShowCal(true); }
              else { setPeriodo(p.id); }
            }}>
            <Text style={[s.periodoBtnTxt, periodo===p.id && s.periodoBtnTxtOn]}>
              {p.id === 'custom' && fechaDesde ? fechaDesde.slice(5) : p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <CalendarioModal
        visible={showCal}
        onClose={() => setShowCal(false)}
        onSelect={({ desde, hasta }) => {
          setFechaDesde(desde);
          setFechaHasta(hasta);
          setPeriodo('custom');
        }}
      />

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={COLORS.gold} /></View>
      ) : (
        <>
          {/* Banner de meta */}
          {['hoy', 'semana', 'mes'].includes(periodo) && (
            <MetaBanner periodo={periodo} svc={n} bb={bb} avgTicket={avgTicket} />
          )}

          {/* Hero */}
          <View style={s.hero}>
            <Text style={s.heroNum}>{n}</Text>
            <Text style={s.heroLbl}>
              {periodo==='hoy' ? 'servicios hoy'
                : periodo==='semana' ? 'servicios · últimos 7 días'
                : periodo==='mes' ? 'servicios · este mes'
                : 'servicios · histórico'}
            </Text>
          </View>

          {/* Stats */}
          <View style={s.grid2}>
            <View style={[s.statCard, s.statGreen]}>
              <Text style={[s.statVal,{color:COLORS.ok}]}>
                {bb>=100000?fmtM(bb):'$'+fmt(bb)}
              </Text>
              <Text style={s.statLbl}>Tus ingresos</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statVal}>{n}</Text>
              <Text style={s.statLbl}>Servicios</Text>
            </View>
            <View style={[s.statCard, s.statGold]}>
              <Text style={[s.statVal,{color:COLORS.gold}]}>${fmt(tk)}</Text>
              <Text style={s.statLbl}>Ticket prom.</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statVal}>${fmt(prop)}</Text>
              <Text style={s.statLbl}>Propinas</Text>
            </View>
          </View>

          {/* Desglose por pago */}
          {Object.keys(porPago).length > 0 && periodo !== 'hoy' && (
            <View style={s.card}>
              <Text style={s.cardTitle}>POR FORMA DE PAGO</Text>
              {Object.entries(porPago).map(([pago, v]) => {
                const ps = PAGO_STYLE[pago] || PAGO_STYLE.efectivo;
                const pct = n>0 ? Math.round(v.n/n*100) : 0;
                return (
                  <View key={pago} style={{marginBottom:10}}>
                    <View style={s.rowBetween}>
                      <Text style={s.pagoNom}>
                        {pago==='efectivo'?'💵':pago==='debito'?'💳':'📲'} {pago}
                      </Text>
                      <Text style={[s.pagoVal,{color:ps.color}]}>
                        {v.n} svc · ${fmt(v.bb)}
                      </Text>
                    </View>
                    <View style={s.barBg}>
                      <View style={[s.barFill,{width:`${pct}%`,backgroundColor:ps.color}]}/>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Lista servicios — solo para hoy y semana */}
          {(periodo==='hoy'||periodo==='semana') && regs.length>0 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>
                {periodo==='hoy' ? 'SERVICIOS DEL DÍA' : 'SERVICIOS DE LA SEMANA'}
              </Text>
              {[...regs].sort((a,b)=>(b.ts||0)-(a.ts||0)).map(r => {
                const ps = PAGO_STYLE[r.pago]||PAGO_STYLE.efectivo;
                return (
                  <View key={r.id} style={s.svcRow}>
                    <View style={{width:60}}>
                      <Text style={s.svcFecha}>
                        {periodo==='semana'
                          ? (r.fecha_display||r.fecha||'').slice(0,5)
                          : r.hora?.slice(0,5)||'--'}
                      </Text>
                    </View>
                    <Text style={s.svcNom} numberOfLines={1}>{r.snom}</Text>
                    <View style={[s.pagoBadge,{backgroundColor:ps.bg}]}>
                      <Text style={[s.pagoTxt,{color:ps.color}]}>{ps.label}</Text>
                    </View>
                    <Text style={s.svcBB}>${fmt((r.bb||0)+(r.propina||0))}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Para mes e histórico — top servicios */}
          {(periodo==='mes'||periodo==='todo') && regs.length>0 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>TOP SERVICIOS</Text>
              {(() => {
                const svcMap = {};
                regs.forEach(r => { svcMap[r.snom]=(svcMap[r.snom]||0)+1; });
                return Object.entries(svcMap)
                  .sort((a,b)=>b[1]-a[1]).slice(0,8)
                  .map(([nom,cnt]) => {
                    const pct = n>0?Math.round(cnt/n*100):0;
                    return (
                      <View key={nom} style={{marginBottom:10}}>
                        <View style={s.rowBetween}>
                          <Text style={s.svcNom}>{nom}</Text>
                          <Text style={s.svcBB}>{cnt} ({pct}%)</Text>
                        </View>
                        <View style={s.barBg}>
                          <View style={[s.barFill,{width:`${pct}%`,backgroundColor:COLORS.gold3}]}/>
                        </View>
                      </View>
                    );
                  });
              })()}
            </View>
          )}

          {regs.length===0 && (
            <View style={s.empty}>
              <Text style={s.emptyIco}>✂️</Text>
              <Text style={s.emptyTxt}>Sin servicios en este período</Text>
            </View>
          )}
        </>
      )}

      {/* ── MI PUNTUACIÓN KPI ── */}
      {periodo === 'hoy' && (
        <View style={s.card}>
          <TouchableOpacity
            style={s.agendaHeader}
            onPress={() => setKpiVisible(v => !v)}
          >
            <Text style={s.cardTitle}>MI PUNTUACIÓN · MES ACTUAL</Text>
            <Text style={s.agendaToggle}>{kpiVisible ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {kpiVisible && (
            kpi === null ? (
              <Text style={s.agendaVacia}>Sin evaluación este mes</Text>
            ) : (
              <>
                {kpi.disq && (
                  <View style={s.kpiDisqBanner}>
                    <Text style={s.kpiDisqTxt}>
                      ⚠ Descalificado: {kpi.disqMotivo || 'Ver con la dirección'}
                    </Text>
                  </View>
                )}

                <View style={s.kpiScoreRow}>
                  <View style={s.kpiScoreBox}>
                    <Text style={[s.kpiScore, { color: barbero.color }]}>
                      {kpi.pct}
                    </Text>
                    <Text style={s.kpiScoreSub}>/ 100 pts</Text>
                  </View>
                  <View style={s.kpiBonusBox}>
                    <Text style={s.kpiBonusLbl}>BONO MES</Text>
                    <Text style={[s.kpiBonusVal,
                      { color: kpi.bonus > 0 && !kpi.disq ? COLORS.ok : COLORS.text3 }
                    ]}>
                      {kpi.bonus > 0 && !kpi.disq ? `$${fmt(kpi.bonus)}` : '$0'}
                    </Text>
                  </View>
                </View>

                {kpi.metricas.map(m => (
                  <View key={m.metrica} style={s.kpiMetricRow}>
                    <Text style={s.kpiMetricNom} numberOfLines={1}>
                      {KPI_LABELS[m.metrica] || m.metrica}
                    </Text>
                    <Text style={s.kpiMetricVal}>
                      {parseFloat(m.valor).toFixed(1)}
                    </Text>
                  </View>
                ))}
              </>
            )
          )}
        </View>
      )}

      {/* ── AGENDA DEL DÍA ── */}
      {periodo === 'hoy' && (
        <View style={s.card}>
          <TouchableOpacity
            style={s.agendaHeader}
            onPress={() => setAgendaVisible(v => !v)}
          >
            <Text style={s.cardTitle}>
              📅 AGENDA DEL DÍA ({agenda.length})
            </Text>
            <Text style={s.agendaToggle}>{agendaVisible ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {agendaVisible && (
            agenda.length === 0 ? (
              <Text style={s.agendaVacia}>Sin agenda para hoy</Text>
            ) : (
              agenda.map(a => {
                const estadoColor =
                  a.estado === 'aceptado'   ? '#4db87a' :
                  a.estado === 'completado' ? '#5580d4' : '#c9a84c';
                return (
                  <View key={a.id} style={s.agendaItem}>
                    <Text style={s.agendaHora}>{a.hora}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.agendaCliente}>{a.cliente_nombre}</Text>
                      <Text style={s.agendaSvc}>{a.svc_solicitado}</Text>
                    </View>
                    <View style={[s.agendaBadge,
                      { backgroundColor: estadoColor + '22', borderColor: estadoColor + '55' }]}>
                      <Text style={[s.agendaBadgeTxt, { color: estadoColor }]}>
                        {a.estado}
                      </Text>
                    </View>
                  </View>
                );
              })
            )
          )}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll:    { flex:1, backgroundColor:COLORS.bg },
  content:   { padding:18, paddingBottom:32 },
  center:    { padding:40, alignItems:'center' },

  periodos:  { flexDirection:'row', gap:6, marginBottom:16, flexWrap:'wrap' },
  periodoBtn:{ paddingHorizontal:14, paddingVertical:9, backgroundColor:COLORS.s2,
    borderRadius:20, borderWidth:1, borderColor:COLORS.border },
  periodoBtnOn:{ backgroundColor:'rgba(201,168,76,.12)', borderColor:COLORS.gold },
  periodoBtnTxt:{ fontSize:13, color:COLORS.text2, fontWeight:'500' },
  periodoBtnTxtOn:{ color:COLORS.gold, fontWeight:'700' },

  hero:      { alignItems:'center', paddingVertical:24 },
  heroNum:   { fontSize:72, color:COLORS.ok, fontWeight:'200', lineHeight:80 },
  heroLbl:   { fontSize:14, color:COLORS.text3, letterSpacing:2, textTransform:'uppercase' },

  grid2:     { flexDirection:'row', flexWrap:'wrap', gap:10, marginBottom:14 },
  statCard:  { flex:1, minWidth:'45%', backgroundColor:COLORS.s2, borderRadius:14,
    borderWidth:1, borderColor:COLORS.border, padding:16 },
  statGreen: { backgroundColor:'rgba(77,184,122,.07)', borderColor:'rgba(77,184,122,.2)' },
  statGold:  { backgroundColor:'rgba(201,168,76,.07)', borderColor:'rgba(201,168,76,.2)' },
  statVal:   { fontSize:24, color:COLORS.text, fontWeight:'600' },
  statLbl:   { fontSize:11, color:COLORS.text3, marginTop:4,
    textTransform:'uppercase', letterSpacing:1 },

  card:      { backgroundColor:COLORS.s1, borderRadius:14, borderWidth:1,
    borderColor:COLORS.border, padding:18, marginBottom:14 },
  cardTitle: { fontSize:11, color:COLORS.text3, letterSpacing:2.5,
    textTransform:'uppercase', marginBottom:14 },

  rowBetween:{ flexDirection:'row', justifyContent:'space-between',
    alignItems:'center', marginBottom:4 },
  pagoNom:   { fontSize:14, color:COLORS.text, textTransform:'capitalize' },
  pagoVal:   { fontSize:13, fontWeight:'600' },
  barBg:     { height:6, backgroundColor:COLORS.border, borderRadius:3, overflow:'hidden' },
  barFill:   { height:6, borderRadius:3 },

  svcRow:    { flexDirection:'row', alignItems:'center', paddingVertical:11,
    borderBottomWidth:1, borderBottomColor:COLORS.border },
  svcFecha:  { fontSize:12, color:COLORS.text3 },
  svcNom:    { flex:1, fontSize:15, color:COLORS.text, fontWeight:'500' },
  pagoBadge: { borderRadius:20, paddingHorizontal:8, paddingVertical:3, marginHorizontal:6 },
  pagoTxt:   { fontSize:11, fontWeight:'700', letterSpacing:1 },
  svcBB:     { fontSize:14, color:COLORS.ok, fontWeight:'600', minWidth:64, textAlign:'right' },

  empty:     { alignItems:'center', paddingVertical:50 },
  emptyIco:  { fontSize:40, marginBottom:10 },
  emptyTxt:  { fontSize:15, color:COLORS.text3 },

  // KPI
  kpiDisqBanner: { backgroundColor:'rgba(224,85,85,.12)', borderRadius:10, borderWidth:1,
    borderColor:'rgba(224,85,85,.3)', padding:12, marginBottom:14 },
  kpiDisqTxt:    { fontSize:13, color:COLORS.red, fontWeight:'600' },
  kpiScoreRow:   { flexDirection:'row', alignItems:'center', gap:16, marginBottom:16 },
  kpiScoreBox:   { flex:1, alignItems:'center', backgroundColor:COLORS.s2, borderRadius:14,
    borderWidth:1, borderColor:COLORS.border, padding:16 },
  kpiScore:      { fontSize:48, fontWeight:'200', lineHeight:56 },
  kpiScoreSub:   { fontSize:11, color:COLORS.text3, letterSpacing:1, marginTop:2 },
  kpiBonusBox:   { flex:1, alignItems:'center', backgroundColor:COLORS.s2, borderRadius:14,
    borderWidth:1, borderColor:COLORS.border, padding:16 },
  kpiBonusLbl:   { fontSize:10, color:COLORS.text3, letterSpacing:2, textTransform:'uppercase',
    marginBottom:6 },
  kpiBonusVal:   { fontSize:22, fontWeight:'600' },
  kpiMetricRow:  { flexDirection:'row', justifyContent:'space-between', alignItems:'center',
    paddingVertical:9, borderBottomWidth:1, borderBottomColor:COLORS.border },
  kpiMetricNom:  { fontSize:13, color:COLORS.text2, flex:1 },
  kpiMetricVal:  { fontSize:14, color:COLORS.text, fontWeight:'600', minWidth:36,
    textAlign:'right' },

  agendaHeader:   { flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  agendaToggle:   { fontSize:13, color:COLORS.text3, marginBottom:14 },
  agendaVacia:    { fontSize:13, color:COLORS.text3, marginTop:4 },
  agendaItem:     { flexDirection:'row', alignItems:'center', paddingVertical:10,
    borderBottomWidth:1, borderBottomColor:COLORS.border, gap:8 },
  agendaHora:     { fontSize:12, color:COLORS.text3, width:38 },
  agendaCliente:  { fontSize:14, color:COLORS.text, fontWeight:'600' },
  agendaSvc:      { fontSize:12, color:COLORS.text2, marginTop:1 },
  agendaBadge:    { paddingHorizontal:8, paddingVertical:3, borderRadius:10, borderWidth:1 },
  agendaBadgeTxt: { fontSize:11, fontWeight:'700' },
});
