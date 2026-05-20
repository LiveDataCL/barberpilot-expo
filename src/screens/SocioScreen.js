import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Dimensions,
} from 'react-native';
const { width: SW } = Dimensions.get('window');
import { COLORS, fmt, fmtM, mesPeriodo } from '../constants';

const API_URL = 'https://barberpilot-api-production.up.railway.app';

const PERIODOS = [
  { id: 'hoy',    label: 'Hoy'        },
  { id: 'semana', label: 'Esta semana' },
  { id: 'mes',    label: 'Este mes'   },
];

export default function SocioScreen() {
  const [periodo,    setPeriodo]   = useState('mes');
  const [datos,      setDatos]     = useState(null);
  const [mesDatos,   setMesDatos]  = useState(null);
  const [loading,    setLoading]   = useState(true);
  const [refreshing, setRefreshing]= useState(false);
  const [showModal,  setShowModal] = useState(false);
  const [fechaDesde, setFechaDesde]= useState('');
  const [fechaHasta, setFechaHasta]= useState('');

  const hoyStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  const cargar = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // Datos del mes para proyección
      const mesR = await fetch(`${API_URL}/stats/mes/${mesPeriodo()}`).then(r => r.json());
      
      // Datos según período seleccionado
      let desde = hoyStr();
  

      // Recopilar días
      const hasta = (periodo === 'custom' && fechaHasta) ? fechaHasta : hoyStr();
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

      let regs = [];
      results.forEach(r => {
        if (r.ok && r.registros) regs = regs.concat(r.registros);
      });

      // Calcular stats
      const n    = regs.length;
      const fact = regs.reduce((a, r) => a + (r.precio || 0), 0);
      const bb   = regs.reduce((a, r) => a + (r.bb || 0), 0);
      const neg  = fact - bb;
      const tk   = n > 0 ? Math.round(fact / n) : 0;

      // Por barbero
      const porBarbero = {};
      regs.forEach(r => {
        if (!porBarbero[r.bnom]) porBarbero[r.bnom] = { svc: 0, fact: 0 };
        porBarbero[r.bnom].svc++;
        porBarbero[r.bnom].fact += r.precio || 0;
      });

      // Por pago
      const porPago = {};
      regs.forEach(r => {
        if (!porPago[r.pago]) porPago[r.pago] = { svc: 0, fact: 0 };
        porPago[r.pago].svc++;
        porPago[r.pago].fact += r.precio || 0;
      });

      // Tendencias
      const porHora = {}; const porDia = {};
      for (let h=10;h<=19;h++) porHora[h]={svc:0,fact:0};
      for (let d2=0;d2<=6;d2++) porDia[d2]={svc:0,fact:0};
      regs.forEach(r => {
        const h = parseInt((r.hora||'00:00').slice(0,2));
        if (porHora[h]) { porHora[h].svc++; porHora[h].fact += r.precio||0; }
        if (r.fecha) {
          const dow = new Date(r.fecha+'T12:00:00').getDay();
          const di = dow===0?6:dow-1;
          porDia[di].svc++; porDia[di].fact += r.precio||0;
        }
      });
      setDatos({ n, fact, bb, neg, tk, porBarbero, porPago, porHora, porDia });

      // Proyección del mes
      if (mesR.ok && mesR.datos) {
        const mesFact = mesR.datos.reduce((a, r) => a + (r.facturado || 0), 0);
        const diaHoy  = new Date().getDate();
        const diasMes = new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).getDate();
        const proy    = Math.round(mesFact / diaHoy * diasMes);
        setMesDatos({ fact: mesFact, proy });
      }
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { cargar(); }, [periodo, fechaDesde, fechaHasta]);

  return (
    <ScrollView
      style={s.scroll} contentContainerStyle={s.content}
      refreshControl={
        <RefreshControl refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); cargar(true); }}
          tintColor={COLORS.gold} colors={[COLORS.gold]} />
      }
    >
      {/* Indicador socio */}
      <View style={s.socioBadge}>
        <Text style={s.socioBadgeTxt}>👁 VISTA SOCIOS · SOLO LECTURA</Text>
      </View>

      {/* Proyección del mes */}
      {mesDatos && (
        <View style={s.proyCard}>
          <Text style={s.proyLbl}>PROYECCIÓN {mesPeriodo()}</Text>
          <Text style={s.proyVal}>${fmt(mesDatos.proy)}</Text>
          <Text style={s.proyActual}>Acumulado mes: ${fmt(mesDatos.fact)}</Text>
        </View>
      )}

      {/* Acumulado semanal destacado */}
      {periodo === 'semana' && datos && (
        <View style={[s.proyCard, { backgroundColor: 'rgba(77,184,122,.08)', borderColor: 'rgba(77,184,122,.25)', marginBottom: 12 }]}>
          <Text style={[s.proyLbl, { color: COLORS.ok }]}>ESTA SEMANA · FACTURACIÓN</Text>
          <Text style={[s.proyVal, { color: COLORS.ok, fontSize: 42 }]}>${fmt(datos.fact)}</Text>
          <Text style={s.proyActual}>{datos.n} servicios · ${fmt(datos.tk)} ticket prom.</Text>
        </View>
      )}

      {/* Selector período */}
      <View style={s.periodosRow}>
        {PERIODOS.map(p => (
          <TouchableOpacity key={p.id}
            style={[s.periodoBtn, periodo === p.id && s.periodoBtnOn]}
            onPress={() => p.id === 'custom' ? setShowModal(true) : setPeriodo(p.id)}>
            <Text style={[s.periodoBtnTxt, periodo === p.id && s.periodoBtnTxtOn]}>
              {p.id === 'custom' && fechaDesde ? fechaDesde.slice(5) : p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Modal fechas */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={{ flex:1, backgroundColor:'rgba(0,0,0,.75)', justifyContent:'flex-end' }}>
          <View style={{ backgroundColor:COLORS.s1, borderTopLeftRadius:20,
            borderTopRightRadius:20, padding:24, paddingBottom:40 }}>
            <Text style={{ fontSize:18, color:COLORS.text, fontWeight:'600', marginBottom:16 }}>
              Seleccionar período
            </Text>
            <View style={{ flexDirection:'row', gap:6, flexWrap:'wrap', marginBottom:16 }}>
              {[
                { label:'Esta semana', fn:()=>{ const d=new Date(); const dia=d.getDay();
                    d.setDate(d.getDate()-(dia===0?6:dia-1));
                    setFechaDesde(d.toISOString().slice(0,10)); setFechaHasta(hoyStr()); }},
                { label:'Mes actual', fn:()=>{ const d=new Date();
                    setFechaDesde(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`);
                    setFechaHasta(hoyStr()); }},
                { label:'Mes anterior', fn:()=>{ const d=new Date(); d.setMonth(d.getMonth()-1);
                    const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0');
                    const ld=new Date(y,d.getMonth()+1,0).getDate();
                    setFechaDesde(`${y}-${m}-01`); setFechaHasta(`${y}-${m}-${ld}`); }},
                { label:'Últimos 30 días', fn:()=>{ const d=new Date(); d.setDate(d.getDate()-30);
                    setFechaDesde(d.toISOString().slice(0,10)); setFechaHasta(hoyStr()); }},
              ].map((a,i) => (
                <TouchableOpacity key={i} onPress={a.fn}
                  style={{ paddingHorizontal:12, paddingVertical:8, backgroundColor:COLORS.s2,
                    borderRadius:20, borderWidth:1, borderColor:COLORS.border }}>
                  <Text style={{ fontSize:13, color:COLORS.text2 }}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={{ backgroundColor:COLORS.s2, borderRadius:10, borderWidth:1,
              borderColor:COLORS.border2, color:COLORS.text, fontSize:15,
              padding:13, marginBottom:10 }}
              value={fechaDesde} onChangeText={setFechaDesde}
              placeholder="Desde AAAA-MM-DD" placeholderTextColor={COLORS.text3} />
            <TextInput style={{ backgroundColor:COLORS.s2, borderRadius:10, borderWidth:1,
              borderColor:COLORS.border2, color:COLORS.text, fontSize:15,
              padding:13, marginBottom:18 }}
              value={fechaHasta} onChangeText={setFechaHasta}
              placeholder={`Hasta AAAA-MM-DD (hoy: ${hoyStr()})`}
              placeholderTextColor={COLORS.text3} />
            <View style={{ flexDirection:'row', gap:10 }}>
              <TouchableOpacity style={{ flex:1, padding:14, backgroundColor:COLORS.s2,
                borderRadius:12, alignItems:'center' }}
                onPress={() => setShowModal(false)}>
                <Text style={{ color:COLORS.text2, fontWeight:'600' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex:2, padding:14, backgroundColor:COLORS.gold,
                borderRadius:12, alignItems:'center' }}
                onPress={() => { setPeriodo('custom'); setShowModal(false); }}>
                <Text style={{ color:COLORS.bg, fontWeight:'700', fontSize:15 }}>Ver datos</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={COLORS.gold} size="large" /></View>
      ) : datos ? (
        <>
          {/* KPIs principales */}
          <View style={s.grid2}>
            <View style={s.statCard}>
              <Text style={s.statVal}>{datos.n}</Text>
              <Text style={s.statLbl}>Servicios</Text>
            </View>
            <View style={[s.statCard, s.statGold]}>
              <Text style={[s.statVal, { color: COLORS.gold }]}>
                ${fmt(datos.fact)}
              </Text>
              <Text style={s.statLbl}>Facturación</Text>
            </View>
            <View style={[s.statCard, s.statGreen]}>
              <Text style={[s.statVal, { color: COLORS.ok }]}>
                ${fmt(datos.neg)}
              </Text>
              <Text style={s.statLbl}>Para el negocio</Text>
            </View>
            <View style={s.statCard}>
              <Text style={s.statVal}>${fmt(datos.tk)}</Text>
              <Text style={s.statLbl}>Ticket prom.</Text>
            </View>
          </View>

          {/* Por barbero */}
          {Object.keys(datos.porBarbero).length > 0 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>POR BARBERO</Text>
              {Object.entries(datos.porBarbero)
                .sort((a, b) => b[1].fact - a[1].fact)
                .map(([nom, v]) => {
                  const pct = datos.fact > 0 ? Math.round(v.fact / datos.fact * 100) : 0;
                  return (
                    <View key={nom} style={{ marginBottom: 12 }}>
                      <View style={s.rowBetween}>
                        <Text style={s.barNom}>{nom}</Text>
                        <Text style={s.barVal}>{v.svc} svc · ${fmt(v.fact)}</Text>
                      </View>
                      <View style={s.barBg}>
                        <View style={[s.barFill, {
                          width: `${pct}%`, backgroundColor: COLORS.gold,
                        }]} />
                      </View>
                      <Text style={s.barPct}>{pct}% del total</Text>
                    </View>
                  );
                })}
            </View>
          )}

          {/* Horas punta */}
          {datos.porHora && (
            <View style={s.card}>
              <Text style={s.cardTitle}>HORAS PUNTA</Text>
              <View style={{ flexDirection:'row', alignItems:'flex-end', gap:2, height:80 }}>
                {Array.from({length:10},(_,i)=>i+10).map(h => {
                  const v   = datos.porHora[h]?.svc||0;
                  const max = Math.max(...Object.values(datos.porHora).map(x=>x.svc),1);
                  const pct = v/max;
                  const barH= Math.max(2,Math.round(pct*68));
                  const col = pct>=0.75?COLORS.gold:pct>=0.4?'rgba(201,168,76,.5)':COLORS.border;
                  return (
                    <View key={h} style={{flex:1,alignItems:'center',justifyContent:'flex-end'}}>
                      {pct>=0.75&&<Text style={{fontSize:8}}>🔥</Text>}
                      <View style={{height:barH,backgroundColor:col,width:'85%',
                        borderTopLeftRadius:2,borderTopRightRadius:2}}/>
                      <Text style={{fontSize:8,color:COLORS.text3,marginTop:2}}>{h}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Dias de la semana */}
          {datos.porDia && (
            <View style={s.card}>
              <Text style={s.cardTitle}>DIAS DE LA SEMANA</Text>
              {['Lun','Mar','Mie','Jue','Vie','Sab','Dom'].map((dia,d) => {
                const v  = datos.porDia[d]?.svc||0;
                const f  = datos.porDia[d]?.fact||0;
                const mx = Math.max(...Object.values(datos.porDia).map(x=>x.svc),1);
                const pct= mx>0?Math.round(v/mx*100):0;
                const col= pct>=75?COLORS.gold:pct>=40?'rgba(201,168,76,.45)':COLORS.border;
                return (
                  <View key={d} style={{flexDirection:'row',alignItems:'center',
                    marginBottom:8,gap:8}}>
                    <Text style={{width:32,fontSize:12,
                      color:pct>=75?COLORS.gold:COLORS.text2,
                      fontWeight:pct>=75?'700':'400'}}>{dia}</Text>
                    <View style={{flex:1,height:8,backgroundColor:COLORS.border,
                      borderRadius:4,overflow:'hidden'}}>
                      <View style={{height:8,width:pct+'%',
                        backgroundColor:col,borderRadius:4}}/>
                    </View>
                    <Text style={{fontSize:11,color:COLORS.text3,
                      width:28,textAlign:'right'}}>{v}</Text>
                    <Text style={{fontSize:11,color:COLORS.ok,width:72,
                      textAlign:'right',fontWeight:'600'}}>${fmt(f)}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Por forma de pago */}
          {Object.keys(datos.porPago).length > 0 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>POR FORMA DE PAGO</Text>
              {Object.entries(datos.porPago).map(([pago, v]) => {
                const pct = datos.n > 0 ? Math.round(v.svc / datos.n * 100) : 0;
                const color = pago === 'efectivo' ? COLORS.ok
                  : pago === 'debito' ? COLORS.blue : COLORS.gold;
                return (
                  <View key={pago} style={s.pagoRow}>
                    <Text style={s.pagoNom}>
                      {pago === 'efectivo' ? '💵' : pago === 'debito' ? '💳' : '📲'}
                      {' '}{pago}
                    </Text>
                    <Text style={[s.pagoVal, { color }]}>{v.svc} · ${fmt(v.fact)}</Text>
                    <Text style={s.pagoPct}>{pct}%</Text>
                  </View>
                );
              })}
            </View>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll:   { flex: 1, backgroundColor: COLORS.bg },
  content:  { padding: 18, paddingBottom: 40 },
  center:   { padding: 40, alignItems: 'center' },

  socioBadge: { backgroundColor: 'rgba(85,128,212,.1)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(85,128,212,.3)',
    padding: 10, alignItems: 'center', marginBottom: 16 },
  socioBadgeTxt: { fontSize: 11, color: COLORS.blue, fontWeight: '700', letterSpacing: 2 },

  proyCard: { backgroundColor: 'rgba(201,168,76,.08)', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(201,168,76,.25)',
    padding: 24, alignItems: 'center', marginBottom: 16 },
  proyLbl:  { fontSize: 11, color: COLORS.gold3, letterSpacing: 2.5,
    textTransform: 'uppercase', marginBottom: 8 },
  proyVal:  { fontSize: 36, color: COLORS.gold, fontWeight: '300', fontVariant: ['tabular-nums'] },
  proyActual:{ fontSize: 13, color: COLORS.text3, marginTop: 6 },

  periodosRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  periodoBtn:  { flex: 1, paddingVertical: 10, backgroundColor: COLORS.s2,
    borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  periodoBtnOn:{ backgroundColor: 'rgba(201,168,76,.12)', borderColor: COLORS.gold },
  periodoBtnTxt:{ fontSize: 13, color: COLORS.text2, fontWeight: '500' },
  periodoBtnTxtOn: { color: COLORS.gold, fontWeight: '700' },

  grid2:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: COLORS.s2,
    borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 16 },
  statGreen:{ backgroundColor: 'rgba(77,184,122,.07)', borderColor: 'rgba(77,184,122,.2)' },
  statGold: { backgroundColor: 'rgba(201,168,76,.07)', borderColor: 'rgba(201,168,76,.2)' },
  statVal:  { fontSize: 22, color: COLORS.text, fontWeight: '600' },
  statLbl:  { fontSize: 11, color: COLORS.text3, marginTop: 4,
    textTransform: 'uppercase', letterSpacing: 1 },

  card:     { backgroundColor: COLORS.s1, borderRadius: 14, borderWidth: 1,
    borderColor: COLORS.border, padding: 18, marginBottom: 14 },
  cardTitle:{ fontSize: 11, color: COLORS.text3, letterSpacing: 2.5,
    textTransform: 'uppercase', marginBottom: 14 },

  rowBetween: { flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 4 },
  barNom:   { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  barVal:   { fontSize: 13, color: COLORS.text3 },
  barBg:    { height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden' },
  barFill:  { height: 6, borderRadius: 3 },
  barPct:   { fontSize: 11, color: COLORS.text3, marginTop: 3 },

  pagoRow:  { flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  pagoNom:  { flex: 1, fontSize: 14, color: COLORS.text, textTransform: 'capitalize' },
  pagoVal:  { fontSize: 14, fontWeight: '600', marginRight: 12 },
  pagoPct:  { fontSize: 13, color: COLORS.text3, width: 36, textAlign: 'right' },
});
