import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { COLORS, fmt, fmtM, hoy, mesPeriodo } from '../constants';

const API_URL = 'https://barberpilot-api-production.up.railway.app';

const PERIODOS = [
  { id: 'hoy',    label: 'Hoy'          },
  { id: 'semana', label: 'Esta semana'  },
  { id: 'mes',    label: 'Este mes'     },
  { id: 'todo',   label: 'Histórico'   },
];

const PAGO_STYLE = {
  efectivo:      { bg: 'rgba(77,184,122,.15)',  color: '#4db87a', label: 'EF' },
  debito:        { bg: 'rgba(85,130,212,.15)',  color: '#5580d4', label: 'DB' },
  transferencia: { bg: 'rgba(201,168,76,.15)',  color: '#c9a84c', label: 'TR' },
};

function getFechaDesde(periodo) {
  const d = new Date();
  if (periodo === 'hoy') return hoy();
  if (periodo === 'semana') {
    // Retroceder al lunes de esta semana
    const dia = d.getDay(); // 0=dom, 1=lun...
    const diasAtras = dia === 0 ? 6 : dia - 1; // domingo = 6 días atrás
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
  const [periodo,   setPeriodo]   = useState('hoy');
  const [regs,      setRegs]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);

  const cargar = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await cargarRegistrosPeriodo(barbero.bid, periodo);
      setRegs(data);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [barbero, periodo]);

  useEffect(() => { cargar(); }, [periodo]);

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
            onPress={() => setPeriodo(p.id)}>
            <Text style={[s.periodoBtnTxt, periodo===p.id && s.periodoBtnTxtOn]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={COLORS.gold} /></View>
      ) : (
        <>
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
              <Text style={s.statLbl}>Mis ingresos</Text>
            </View>
            <View style={[s.statCard, s.statGold]}>
              <Text style={[s.statVal,{color:COLORS.gold}]}>
                {fact>=100000?fmtM(fact):'$'+fmt(fact)}
              </Text>
              <Text style={s.statLbl}>Facturado</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statVal}>${fmt(tk)}</Text>
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
});
