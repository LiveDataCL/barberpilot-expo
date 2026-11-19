import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { COLORS, fmt, hoy, mesPeriodo } from '../constants';
import { useBarberos } from '../hooks/useBarberos';
import { fetchAutenticado } from '../services/api';
import { kpisPorBarbero } from '../services/kpisBarberos';

// Análisis del mes. Moved here from the admin profile (its tab is removed in this release) and shown read-only
// in the socio profile. Same figures, same routes (/registros/dia, which accepts the socio session).
export default function AnalisisMes() {
  const { barberos } = useBarberos();
  const [tendData, setTendData] = useState(null);

  const cargarTendencias = async () => {
    try {
      const desde = mesPeriodo() + '-01';
      const hasta = hoy();
      const dias = [];
      let cur = new Date(desde + 'T12:00:00');
      const fin = new Date(hasta + 'T12:00:00');
      while (cur <= fin) { dias.push(cur.toISOString().slice(0,10)); cur.setDate(cur.getDate()+1); }
      const results = await Promise.all(
        dias.map(f => fetchAutenticado(`/registros/dia?fecha=${f}`)
          .then(r => r.json()).catch(() => ({ok:false,registros:[]})))
      );
      let allRegs = [];
      results.forEach(r => { if (r.ok && r.registros) allRegs = allRegs.concat(r.registros); });

      // KPIs por barbero (shared aggregation, same as the Resumen cards)
      const kpisBarbero = kpisPorBarbero(allRegs, barberos);
      const porHora = {}; const porDia = {};
      for (let h=10;h<=19;h++) porHora[h]={svc:0,fact:0};
      for (let d=0;d<=6;d++)   porDia[d]={svc:0,fact:0};

      allRegs.forEach(r => {
        const h = parseInt((r.hora||'00:00').slice(0,2));
        if (porHora[h]) { porHora[h].svc++; porHora[h].fact += r.precio||0; }
        if (r.fecha) {
          const dow = new Date(r.fecha+'T12:00:00').getDay();
          const di = dow===0?6:dow-1;
          porDia[di].svc++; porDia[di].fact+=r.precio||0;
        }
      });
      setTendData({ kpisBarbero, porHora, porDia, totalRegs: allRegs.length });
    } catch {}
  };

  const barberosKey = barberos.map(b => b.bid).join(',');
  useEffect(() => { if (barberos.length > 0) cargarTendencias(); }, [barberosKey]);

  const renderTendAdmin = () => {
    if (!tendData) {
      return <View style={s.center}><ActivityIndicator size="large" color={COLORS.gold}/></View>;
    }
    const DIAS_SEM = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
    const maxHora = Math.max(...Object.values(tendData.porHora).map(x=>x.svc),1);
    const maxDia  = Math.max(...Object.values(tendData.porDia).map(x=>x.svc),1);
    return (
      <ScrollView style={{flex:1,backgroundColor:COLORS.bg}} contentContainerStyle={s.content}>
        <Text style={s.secLbl}>ANÁLISIS DEL MES · {mesPeriodo()}</Text>

        {/* KPIs por barbero */}
        <Text style={[s.secLbl,{marginTop:8}]}>KPIs POR BARBERO</Text>
        {barberos.map(b => {
          const k = tendData.kpisBarbero[b.bid]||{svc:0,fact:0,bb:0,servicios:{}};
          const tk = k.svc>0?Math.round(k.fact/k.svc):0;
          const topSvc = Object.entries(k.servicios).sort((a,c)=>c[1]-a[1]).slice(0,3);
          return (
            <View key={b.bid} style={[s.card,{marginBottom:12}]}>
              <View style={{flexDirection:'row',alignItems:'center',gap:12,marginBottom:12}}>
                <View style={[s.accionAvatar,{backgroundColor:b.bg,width:44,height:44,borderRadius:22}]}>
                  <Text style={[s.accionLetra,{color:b.color,fontSize:18}]}>{b.letra}</Text>
                </View>
                <Text style={{fontSize:18,color:COLORS.text,fontWeight:'700'}}>{b.nombre}</Text>
              </View>
              <View style={s.kpiRow}>
                <View style={s.kpiCard}>
                  <Text style={[s.kpiVal,{color:COLORS.ok}]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{k.svc}</Text>
                  <Text style={s.statLbl} numberOfLines={1}>Servicios</Text>
                </View>
                <View style={[s.kpiCard,s.statGold]}>
                  <Text style={[s.kpiVal,{color:COLORS.gold}]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>${fmt(k.bb)}</Text>
                  <Text style={s.statLbl} numberOfLines={1}>Ingresos</Text>
                </View>
                <View style={s.kpiCard}>
                  <Text style={s.kpiVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>${fmt(tk)}</Text>
                  <Text style={s.statLbl} numberOfLines={1}>Ticket prom.</Text>
                </View>
              </View>
              {topSvc.length>0 && (
                <View>
                  <Text style={{fontSize:10,color:COLORS.text3,letterSpacing:2,
                    textTransform:'uppercase',marginBottom:6}}>Top servicios</Text>
                  {topSvc.map(([nom,cnt]) => (
                    <View key={nom} style={{flexDirection:'row',justifyContent:'space-between',
                      paddingVertical:4,borderBottomWidth:1,borderBottomColor:COLORS.border}}>
                      <Text style={{fontSize:13,color:COLORS.text2,flex:1}}>{nom}</Text>
                      <Text style={{fontSize:13,color:COLORS.gold,fontWeight:'600'}}>{cnt}x</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        {/* Horas punta */}
        <View style={s.card}>
          <Text style={s.cardTitle}>HORAS PUNTA DEL MES</Text>
          <View style={{flexDirection:'row',alignItems:'flex-end',gap:2,height:90,marginBottom:8}}>
            {Array.from({length:10},(_,i)=>i+10).map(h => {
              const v   = tendData.porHora[h]?.svc||0;
              const pct = v/maxHora;
              const barH= Math.max(2,Math.round(pct*78));
              const color= pct>=0.75?COLORS.gold:pct>=0.4?'rgba(201,168,76,.45)':COLORS.border;
              return (
                <View key={h} style={{flex:1,alignItems:'center'}}>
                  {pct>=0.75&&<Text style={{fontSize:8}}>🔥</Text>}
                  <View style={{height:barH,backgroundColor:color,width:'80%',
                    borderTopLeftRadius:2,borderTopRightRadius:2}}/>
                  <Text style={{fontSize:8,color:COLORS.text3,marginTop:2}}>{h}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Días de la semana */}
        <View style={s.card}>
          <Text style={s.cardTitle}>DÍAS DE LA SEMANA</Text>
          {DIAS_SEM.map((dia,d) => {
            const v   = tendData.porDia[d]?.svc||0;
            const f   = tendData.porDia[d]?.fact||0;
            const pct = Math.round(v/maxDia*100);
            const color= pct>=75?COLORS.gold:pct>=40?'rgba(201,168,76,.45)':COLORS.border;
            return (
              <View key={d} style={{flexDirection:'row',alignItems:'center',
                marginBottom:8,gap:8}}>
                <Text style={{width:32,fontSize:12,
                  color:pct>=75?COLORS.gold:COLORS.text2,
                  fontWeight:pct>=75?'700':'400'}}>{dia}</Text>
                <View style={{flex:1,height:8,backgroundColor:COLORS.border,
                  borderRadius:4,overflow:'hidden'}}>
                  <View style={{height:8,width:pct+'%',backgroundColor:color,borderRadius:4}}/>
                </View>
                <Text style={{fontSize:11,color:COLORS.text3,minWidth:24,textAlign:'right'}}>{v}</Text>
                <Text numberOfLines={1} style={{fontSize:11,color:COLORS.ok,minWidth:72,
                  textAlign:'right',fontWeight:'600'}}>${fmt(f)}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  return renderTendAdmin();
}

const s = StyleSheet.create({
  content:  { padding: 18, paddingBottom: 32 },
  center:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  secLbl:   { fontSize: 11, color: COLORS.text3, letterSpacing: 2.5,
    textTransform: 'uppercase', marginBottom: 12, fontFamily: 'Montserrat_500Medium' },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: COLORS.s2,
    borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 16 },
  statGold: { backgroundColor: 'rgba(201,168,76,.07)', borderColor: 'rgba(201,168,76,.2)' },
  // KPI cards: a wrapping grid, two per row at phone width (the third wraps to the next line). Values shrink to fit; they are never cut.
  kpiRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  kpiCard: { width: '48%', flexGrow: 0, flexShrink: 0, backgroundColor: COLORS.s2, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 12 },
  kpiVal:  { fontSize: 18, color: COLORS.text, fontFamily: 'Montserrat_700Bold' },
  statVal:  { fontSize: 26, color: COLORS.text, fontFamily: 'Montserrat_700Bold' },
  statLbl:  { fontSize: 11, color: COLORS.text3, marginTop: 4,
    textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'Montserrat_400Regular' },
  accionAvatar: { width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  accionLetra: { fontSize: 20, fontWeight: '700' },
  card:     { backgroundColor: COLORS.s1, borderRadius: 14, borderWidth: 1,
    borderColor: COLORS.border, padding: 18 },
  cardTitle:{ fontSize: 11, color: COLORS.text3, letterSpacing: 2,
    textTransform: 'uppercase', marginBottom: 14, fontFamily: 'Montserrat_500Medium' },
});
