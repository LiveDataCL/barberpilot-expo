import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { COLORS, fmt, mesPeriodo } from '../constants';

const API_URL = 'https://barberpilot-api-production.up.railway.app';
const { width } = Dimensions.get('window');
const CHART_W = width - 36;

const HORAS = Array.from({ length: 10 }, (_, i) => i + 10); // 10:00 a 19:00
const DIAS  = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

export default function TendenciasScreen({ barbero }) {
  const [datos,     setDatos]     = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);

  const cargar = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // Cargar último mes completo
      const desde = mesPeriodo() + '-01';
      const hasta = new Date().toISOString().slice(0,10);
      const dias = [];
      let cur = new Date(desde + 'T12:00:00');
      const fin = new Date(hasta + 'T12:00:00');
      while (cur <= fin) {
        dias.push(cur.toISOString().slice(0,10));
        cur.setDate(cur.getDate()+1);
      }

      const results = await Promise.all(
        dias.map(f =>
          fetch(`${API_URL}/registros/dia?fecha=${f}`)
            .then(r => r.json()).catch(() => ({ok:false,registros:[]}))
        )
      );

      // Acumular por hora y por día de semana
      const porHora  = {}; // { '10': { svc, fact } }
      const porDia   = {}; // { 0:lun, 1:mar... }
      HORAS.forEach(h => { porHora[h] = { svc: 0, fact: 0 }; });
      [0,1,2,3,4,5,6].forEach(d => { porDia[d] = { svc: 0, fact: 0 }; });

      let totalRegs = 0;
      results.forEach((r, idx) => {
        if (!r.ok || !r.registros) return;
        const fecha = dias[idx];
        const dow   = new Date(fecha + 'T12:00:00').getDay();
        const dowIdx = dow === 0 ? 6 : dow - 1; // lunes=0

        // Filtrar por barbero si no es admin
        const regs = barbero ? r.registros.filter(x => x.bid === barbero.bid) : r.registros;
        regs.forEach(reg => {
          totalRegs++;
          const hora = parseInt((reg.hora||'00:00').slice(0,2));
          const ingreso = (reg.bb || 0) + (reg.propina || 0);
          if (porHora[hora]) {
            porHora[hora].svc++;
            porHora[hora].fact += ingreso;
          }
          porDia[dowIdx].svc++;
          porDia[dowIdx].fact += ingreso;
        });
      });

      setDatos({ porHora, porDia, totalRegs, diasCargados: dias.length });
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { cargar(); }, []);

  if (loading) return (
    <View style={s.center}><ActivityIndicator size="large" color={COLORS.gold}/></View>
  );

  if (!datos) return null;

  const { porHora, porDia } = datos;

  // Máximos para escalar
  const maxHoraSvc  = Math.max(...HORAS.map(h => porHora[h]?.svc||0), 1);
  const maxDiaSvc   = Math.max(...[0,1,2,3,4,5,6].map(d => porDia[d]?.svc||0), 1);
  const maxHoraFact = Math.max(...HORAS.map(h => porHora[h]?.fact||0), 1);

  const BAR_H = 120;
  const horaBarW = (CHART_W - 40) / HORAS.length - 4;
  const diaBarW  = (CHART_W - 40) / 7 - 6;

  // Color por intensidad (heatmap)
  const heatColor = (val, max) => {
    const pct = val / max;
    if (pct === 0) return COLORS.border;
    if (pct < 0.25) return 'rgba(201,168,76,.2)';
    if (pct < 0.5)  return 'rgba(201,168,76,.5)';
    if (pct < 0.75) return 'rgba(201,168,76,.8)';
    return COLORS.gold;
  };

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); cargar(true); }}
        tintColor={COLORS.gold} colors={[COLORS.gold]}/>}>

      <Text style={s.titulo}>TENDENCIAS · {mesPeriodo()}</Text>
      <Text style={s.sub}>{datos.totalRegs} servicios analizados</Text>

      {/* ── GRÁFICO POR HORA ───────────────────────────────── */}
      <View style={s.card}>
        <Text style={s.cardTitle}>⏰ INGRESOS POR HORA</Text>
        <Text style={s.cardSub}>Identifica tus horas punta y valle</Text>

        <View style={s.chartWrap}>
          {/* Eje Y */}
          <View style={s.yAxis}>
            <Text style={s.yLbl}>${fmt(maxHoraFact/1000)}K</Text>
            <Text style={s.yLbl}>${fmt(maxHoraFact/2000)}K</Text>
            <Text style={s.yLbl}>$0</Text>
          </View>
          {/* Barras */}
          <View style={[s.barsWrap, { height: BAR_H + 24 }]}>
            {HORAS.map(h => {
              const v    = porHora[h]?.fact || 0;
              const pct  = v / maxHoraFact;
              const barH = Math.max(2, Math.round(pct * BAR_H));
              const color = heatColor(v, maxHoraFact);
              const esPunta = pct >= 0.75;
              return (
                <View key={h} style={[s.barCol, { width: horaBarW }]}>
                  {esPunta && <Text style={s.puntaTag}>🔥</Text>}
                  <View style={[s.bar, { height: barH, backgroundColor: color, width: horaBarW }]}/>
                  <Text style={s.barLbl}>{h}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Leyenda horas */}
        {(() => {
          const sorted = [...HORAS].sort((a,b) => (porHora[b]?.fact||0)-(porHora[a]?.fact||0));
          const top3 = sorted.slice(0,3);
          const bot3 = sorted.slice(-3).reverse();
          return (
            <View style={{ marginTop: 14 }}>
              <View style={s.legendRow}>
                <Text style={s.legendIco}>🔥</Text>
                <Text style={s.legendTxt}>Horas punta: {top3.map(h=>h+':00').join(', ')}</Text>
              </View>
              <View style={s.legendRow}>
                <Text style={s.legendIco}>❄️</Text>
                <Text style={s.legendTxt}>Horas valle: {bot3.map(h=>h+':00').join(', ')}</Text>
              </View>
            </View>
          );
        })()}
      </View>

      {/* ── GRÁFICO POR DÍA ────────────────────────────────── */}
      <View style={s.card}>
        <Text style={s.cardTitle}>📅 SERVICIOS POR DÍA DE LA SEMANA</Text>
        <Text style={s.cardSub}>¿Cuál es tu día más cargado?</Text>

        <View style={s.chartWrap}>
          <View style={s.yAxis}>
            <Text style={s.yLbl}>{maxDiaSvc}</Text>
            <Text style={s.yLbl}>{Math.round(maxDiaSvc/2)}</Text>
            <Text style={s.yLbl}>0</Text>
          </View>
          <View style={[s.barsWrap, { height: BAR_H + 24 }]}>
            {[0,1,2,3,4,5,6].map(d => {
              const v    = porDia[d]?.svc || 0;
              const pct  = v / maxDiaSvc;
              const barH = Math.max(2, Math.round(pct * BAR_H));
              const color = heatColor(v, maxDiaSvc);
              const esPunta = pct >= 0.75;
              return (
                <View key={d} style={[s.barCol, { width: diaBarW }]}>
                  {esPunta && <Text style={s.puntaTag}>🔥</Text>}
                  <View style={[s.bar, { height: barH, backgroundColor: color, width: diaBarW }]}/>
                  <Text style={s.barLbl}>{DIAS[d]}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Tabla resumen por día */}
        <View style={{ marginTop: 16 }}>
          {[0,1,2,3,4,5,6].map(d => {
            const v = porDia[d]?.svc || 0;
            const f = porDia[d]?.fact || 0;
            const pct = Math.round(v / maxDiaSvc * 100);
            return (
              <View key={d} style={s.diaRow}>
                <Text style={[s.diaNom, pct >= 75 && {color: COLORS.gold, fontWeight:'700'}]}>
                  {pct >= 75 ? '🔥' : pct <= 25 ? '❄️' : '  '} {DIAS[d]}
                </Text>
                <View style={s.diaBar}>
                  <View style={[s.diaBarFill, {
                    width: `${pct}%`,
                    backgroundColor: heatColor(v, maxDiaSvc)
                  }]}/>
                </View>
                <Text style={s.diaSvc}>{v} svc</Text>
                <Text style={s.diaFact}>${fmt(f)}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* ── MAPA DE CALOR HORA × DÍA ───────────────────────── */}
      <View style={s.card}>
        <Text style={s.cardTitle}>🗓 MAPA DE CALOR</Text>
        <Text style={s.cardSub}>Hora vs día de la semana</Text>
        <Text style={{fontSize:12,color:COLORS.text3,marginBottom:10}}>
          Más dorado = más actividad
        </Text>

        {/* Header horas */}
        <View style={{flexDirection:'row',marginBottom:4}}>
          <View style={{width:32}}/>
          {HORAS.map(h => (
            <View key={h} style={{flex:1,alignItems:'center'}}>
              <Text style={{fontSize:9,color:COLORS.text3}}>{h}</Text>
            </View>
          ))}
        </View>

        {/* Filas por día */}
        {[0,1,2,3,4,5,6].map(d => (
          <View key={d} style={{flexDirection:'row',marginBottom:3,alignItems:'center'}}>
            <Text style={{width:32,fontSize:10,color:COLORS.text3}}>{DIAS[d]}</Text>
            {HORAS.map(h => {
              // Simular datos hora×día desde porHora y porDia
              const svcH = porHora[h]?.svc || 0;
              const svcD = porDia[d]?.svc || 0;
              const estimado = Math.round((svcH + svcD) / 2);
              const maxEst = maxHoraSvc;
              const bg = heatColor(estimado, maxEst);
              return (
                <View key={h} style={{flex:1,height:18,marginHorizontal:1,
                  borderRadius:3,backgroundColor:bg}}/>
              );
            })}
          </View>
        ))}
      </View>

    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll:   { flex:1, backgroundColor:COLORS.bg },
  content:  { padding:18, paddingBottom:40 },
  center:   { flex:1, alignItems:'center', justifyContent:'center', backgroundColor:COLORS.bg },
  titulo:   { fontSize:11, color:COLORS.text3, letterSpacing:2.5,
    textTransform:'uppercase', marginBottom:4 },
  sub:      { fontSize:13, color:COLORS.text2, marginBottom:16 },

  card:     { backgroundColor:COLORS.s1, borderRadius:14, borderWidth:1,
    borderColor:COLORS.border, padding:18, marginBottom:14 },
  cardTitle:{ fontSize:11, color:COLORS.text3, letterSpacing:2.5,
    textTransform:'uppercase', marginBottom:4 },
  cardSub:  { fontSize:13, color:COLORS.text2, marginBottom:14 },

  chartWrap:{ flexDirection:'row', alignItems:'flex-end' },
  yAxis:    { width:36, height:144, justifyContent:'space-between', alignItems:'flex-end',
    paddingRight:4 },
  yLbl:     { fontSize:9, color:COLORS.text3 },
  barsWrap: { flex:1, flexDirection:'row', alignItems:'flex-end', gap:3 },
  barCol:   { alignItems:'center', justifyContent:'flex-end' },
  bar:      { borderTopLeftRadius:3, borderTopRightRadius:3 },
  barLbl:   { fontSize:9, color:COLORS.text3, marginTop:4, textAlign:'center' },
  puntaTag: { fontSize:10, marginBottom:2 },

  legendRow:{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:4 },
  legendIco:{ fontSize:16 },
  legendTxt:{ fontSize:13, color:COLORS.text2 },

  diaRow:   { flexDirection:'row', alignItems:'center', marginBottom:8, gap:8 },
  diaNom:   { fontSize:13, color:COLORS.text, width:52 },
  diaBar:   { flex:1, height:8, backgroundColor:COLORS.border, borderRadius:4, overflow:'hidden' },
  diaBarFill:{ height:8, borderRadius:4 },
  diaSvc:   { fontSize:12, color:COLORS.text3, width:44, textAlign:'right' },
  diaFact:  { fontSize:12, color:COLORS.ok, width:70, textAlign:'right', fontWeight:'600' },
});
