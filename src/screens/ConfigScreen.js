import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Switch, Alert,
} from 'react-native';
import { API_URL, COLORS, fmt, fmtM, mesPeriodo, hoy, TODOS_PERFILES } from '../constants';
import * as SecureStore from 'expo-secure-store';
import { api } from '../services/api';

const PERIODOS = [
  { id: 'hoy',    label: 'Hoy'           },
  { id: 'semana', label: 'Esta semana'   },
  { id: 'mes',    label: 'Este mes'      },
  { id: 'todo',   label: 'Histórico'     },
];

const PAGOS_OPT = ['Todos', 'efectivo', 'debito', 'transferencia'];

export default function ConfigScreen({ barbero, onLogout }) {
  const [periodo,   setPeriodo]   = useState('mes');
  const [filtroPago, setFiltroPago] = useState('Todos');
  const [datos,     setDatos]     = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [refreshing,setRefreshing]= useState(false);
  // Cambio de PIN
  const [pinActual,  setPinActual]  = useState('');
  const [pinNuevo,   setPinNuevo]   = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinMsg,     setPinMsg]     = useState(null);

  const cargarDatos = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // Calcular fecha desde/hasta según período
      const hoyStr = hoy();
      let desde = hoyStr;
      if (periodo === 'semana') {
        const d = new Date(); d.setDate(d.getDate() - 7);
        desde = d.toISOString().slice(0,10);
      } else if (periodo === 'mes') {
        desde = mesPeriodo() + '-01';
      } else if (periodo === 'todo') {
        desde = '2026-01-01';
      }

      // Cargar todos los registros del período
      const dias = [];
      let cur = new Date(desde + 'T12:00:00');
      const fin = new Date(hoyStr + 'T12:00:00');
      while (cur <= fin) {
        dias.push(cur.toISOString().slice(0,10));
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
        if (r.ok && r.registros) {
          regs = regs.concat(
            r.registros.filter(x => x.bid === barbero.bid)
          );
        }
      });

      // Aplicar filtro de pago
      if (filtroPago !== 'Todos') {
        regs = regs.filter(r => r.pago === filtroPago);
      }

      setDatos(calcStats(regs));
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { cargarDatos(); }, [periodo, filtroPago]);

  const calcStats = (regs) => {
    const n    = regs.length;
    const fact = regs.reduce((a, r) => a + (r.precio || 0), 0);
    const bb   = regs.reduce((a, r) => a + (r.bb || 0) + (r.propina || 0), 0);
    const prop = regs.reduce((a, r) => a + (r.propina || 0), 0);
    const tk   = n > 0 ? Math.round(fact / n) : 0;

    // Por forma de pago
    const porPago = {};
    regs.forEach(r => {
      if (!porPago[r.pago]) porPago[r.pago] = { n: 0, fact: 0 };
      porPago[r.pago].n++;
      porPago[r.pago].fact += r.precio || 0;
    });

    // Por servicio
    const porSvc = {};
    regs.forEach(r => {
      if (!porSvc[r.snom]) porSvc[r.snom] = { n: 0, fact: 0 };
      porSvc[r.snom].n++;
      porSvc[r.snom].fact += r.precio || 0;
    });
    const topSvc = Object.entries(porSvc)
      .sort((a, b) => b[1].n - a[1].n).slice(0, 8);

    // Por hora (distribución)
    const porHora = {};
    regs.forEach(r => {
      const h = (r.hora || '00:00').slice(0, 2);
      porHora[h] = (porHora[h] || 0) + 1;
    });
    const horaMax = Object.entries(porHora)
      .sort((a, b) => b[1] - a[1])[0];

    return { n, fact, bb, prop, tk, porPago, topSvc, horaMax };
  };

  const testPush = async () => {
    try {
      const res = await fetch(`${API_URL}/push/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bid: barbero.bid }),
      });
      const json = await res.json();
      Alert.alert(json.ok ? '✓ Push enviado' : '⚠ Error', json.message || JSON.stringify(json));
    } catch (e) {
      Alert.alert('Error de red', e.message);
    }
  };

  const cambiarPin = async () => {
    if (!pinActual || !pinNuevo || !pinConfirm) {
      setPinMsg({ ok: false, txt: 'Completa todos los campos' }); return;
    }
    const pinMinLen = barbero?.rol === 'admin' ? 6 : 4;
    if (pinNuevo.length < pinMinLen) {
      setPinMsg({ ok: false, txt: `El PIN debe tener al menos ${pinMinLen} dígitos` }); return;
    }
    if (pinNuevo !== pinConfirm) {
      setPinMsg({ ok: false, txt: 'Los PINs nuevos no coinciden' }); return;
    }
    // Verificar PIN actual guardado
    try {
      const guardado = await SecureStore.getItemAsync('bp_pin_' + barbero.bid);
      const pinCorrecto = guardado || barbero.pin;
      if (pinActual !== pinCorrecto) {
        setPinMsg({ ok: false, txt: 'PIN actual incorrecto' }); return;
      }
      await SecureStore.setItemAsync('bp_pin_' + barbero.bid, pinNuevo);
      setPinMsg({ ok: true, txt: '✓ PIN actualizado correctamente' });
      setPinActual(''); setPinNuevo(''); setPinConfirm('');
      setTimeout(() => setPinMsg(null), 3000);
    } catch {
      setPinMsg({ ok: false, txt: 'Error al guardar el PIN' });
    }
  };

  return (
    <ScrollView
      style={s.scroll} contentContainerStyle={s.content}
      refreshControl={
        <RefreshControl refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); cargarDatos(true); }}
          tintColor={COLORS.gold} colors={[COLORS.gold]} />
      }
    >
      {/* ── FILTRO PERÍODO ─────────────────────────────── */}
      <Text style={s.secLbl}>PERÍODO</Text>
      <View style={s.chips}>
        {PERIODOS.map(p => (
          <TouchableOpacity key={p.id}
            style={[s.chip, periodo === p.id && s.chipOn]}
            onPress={() => setPeriodo(p.id)}>
            <Text style={[s.chipTxt, periodo === p.id && s.chipTxtOn]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── FILTRO FORMA DE PAGO ────────────────────────── */}
      <Text style={[s.secLbl, { marginTop: 20 }]}>FORMA DE PAGO</Text>
      <View style={s.chips}>
        {PAGOS_OPT.map(p => (
          <TouchableOpacity key={p}
            style={[s.chip, filtroPago === p && s.chipOn]}
            onPress={() => setFiltroPago(p)}>
            <Text style={[s.chipTxt, filtroPago === p && s.chipTxtOn]}>
              {p === 'efectivo' ? '💵 Efectivo'
                : p === 'debito' ? '💳 Débito'
                : p === 'transferencia' ? '📲 Transf.'
                : '📋 Todos'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── ANÁLISIS ────────────────────────────────────── */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={COLORS.gold} size="large" />
        </View>
      ) : datos ? (
        <>
          {/* Resumen */}
          <View style={[s.card, { marginTop: 20 }]}>
            <Text style={s.cardTitle}>RESUMEN DEL PERÍODO</Text>
            <View style={s.grid2}>
              <View style={s.statCard}>
                <Text style={s.statVal}>{datos.n}</Text>
                <Text style={s.statLbl}>Servicios</Text>
              </View>
              <View style={[s.statCard, s.statGreen]}>
                <Text style={[s.statVal, { color: COLORS.ok }]}>${fmt(datos.bb)}</Text>
                <Text style={s.statLbl}>Ingresos</Text>
              </View>
              <View style={[s.statCard, s.statGold]}>
                <Text style={[s.statVal, { color: COLORS.gold }]}>${fmt(datos.tk)}</Text>
                <Text style={s.statLbl}>Ticket prom.</Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statVal}>${fmt(datos.prop)}</Text>
                <Text style={s.statLbl}>Propinas</Text>
              </View>
            </View>
          </View>

          {/* Por forma de pago */}
          {Object.keys(datos.porPago).length > 0 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>POR FORMA DE PAGO</Text>
              {Object.entries(datos.porPago).map(([pago, v]) => {
                const pct = datos.n > 0 ? Math.round(v.n / datos.n * 100) : 0;
                const color = pago === 'efectivo' ? COLORS.ok
                  : pago === 'debito' ? COLORS.blue : COLORS.gold;
                return (
                  <View key={pago} style={{ marginBottom: 12 }}>
                    <View style={s.rowBetween}>
                      <Text style={s.pagoNom}>
                        {pago === 'efectivo' ? '💵 Efectivo'
                          : pago === 'debito' ? '💳 Débito' : '📲 Transferencia'}
                      </Text>
                      <Text style={[s.pagoVal, { color }]}>
                        {v.n} svc · ${fmt(v.fact)}
                      </Text>
                    </View>
                    <View style={s.barBg}>
                      <View style={[s.barFill, { width: `${pct}%`, backgroundColor: color }]} />
                    </View>
                    <Text style={s.barPct}>{pct}% del total</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Top servicios */}
          {datos.topSvc.length > 0 && (
            <View style={s.card}>
              <Text style={s.cardTitle}>TOP SERVICIOS</Text>
              {datos.topSvc.map(([nom, v]) => {
                const pct = datos.n > 0 ? Math.round(v.n / datos.n * 100) : 0;
                return (
                  <View key={nom} style={{ marginBottom: 12 }}>
                    <View style={s.rowBetween}>
                      <Text style={s.svcNom} numberOfLines={1}>{nom}</Text>
                      <Text style={s.svcVal}>{v.n} ({pct}%)</Text>
                    </View>
                    <View style={s.barBg}>
                      <View style={[s.barFill, { width: `${pct}%`, backgroundColor: COLORS.gold3 }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Hora pico */}
          {datos.horaMax && (
            <View style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 16 }]}>
              <Text style={{ fontSize: 36 }}>⏰</Text>
              <View>
                <Text style={s.cardTitle}>HORA PICO</Text>
                <Text style={[s.statVal, { color: COLORS.gold }]}>
                  {datos.horaMax[0]}:00 hrs
                </Text>
                <Text style={s.statLbl}>{datos.horaMax[1]} servicios en esa hora</Text>
              </View>
            </View>
          )}
        </>
      ) : null}

      {/* ── TEST PUSH (temporal) ────────────────────────── */}
      <TouchableOpacity style={[s.logoutBtn, { marginTop: 10, borderColor: COLORS.gold }]}
        onPress={testPush}>
        <Text style={[s.logoutTxt, { color: COLORS.gold }]}>🔔 Probar Push</Text>
      </TouchableOpacity>

      {/* ── CERRAR SESIÓN ───────────────────────────────── */}
      <TouchableOpacity style={s.logoutBtn} onPress={() => Alert.alert(
        'Cerrar sesión',
        '¿Seguro que quieres salir?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Salir', style: 'destructive', onPress: () => {
            console.log('[LOGOUT] button pressed — calling onLogout');
            onLogout();
          }},
        ]
      )}>
        <Text style={s.logoutTxt}>🚪 Cerrar sesión</Text>
      </TouchableOpacity>

      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll:   { flex: 1, backgroundColor: COLORS.bg },
  content:  { padding: 18, paddingBottom: 40 },
  center:   { padding: 40, alignItems: 'center' },

  secLbl:   { fontSize: 11, color: COLORS.text3, letterSpacing: 2.5,
    textTransform: 'uppercase', marginBottom: 10 },
  chips:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:     { paddingHorizontal: 14, paddingVertical: 9,
    backgroundColor: COLORS.s2, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.border },
  chipOn:   { backgroundColor: 'rgba(201,168,76,.15)', borderColor: COLORS.gold },
  chipTxt:  { fontSize: 13, color: COLORS.text2, fontWeight: '500' },
  chipTxtOn:{ color: COLORS.gold, fontWeight: '700' },

  card:     { backgroundColor: COLORS.s1, borderRadius: 14, borderWidth: 1,
    borderColor: COLORS.border, padding: 18, marginBottom: 14 },
  cardTitle:{ fontSize: 11, color: COLORS.text3, letterSpacing: 2.5,
    textTransform: 'uppercase', marginBottom: 14 },

  grid2:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: COLORS.s2,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 14 },
  statGreen:{ backgroundColor: 'rgba(77,184,122,.07)', borderColor: 'rgba(77,184,122,.2)' },
  statGold: { backgroundColor: 'rgba(201,168,76,.07)', borderColor: 'rgba(201,168,76,.2)' },
  statVal:  { fontSize: 22, color: COLORS.text, fontWeight: '600' },
  statLbl:  { fontSize: 11, color: COLORS.text3, marginTop: 4,
    textTransform: 'uppercase', letterSpacing: 1 },

  rowBetween: { flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 4 },
  pagoNom:  { fontSize: 14, color: COLORS.text },
  pagoVal:  { fontSize: 13, fontWeight: '600' },
  svcNom:   { fontSize: 14, color: COLORS.text, flex: 1 },
  svcVal:   { fontSize: 13, color: COLORS.text3 },

  barBg:    { height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden' },
  barFill:  { height: 6, borderRadius: 3 },
  barPct:   { fontSize: 11, color: COLORS.text3, marginTop: 3 },

  logoutBtn:{ marginTop: 24, backgroundColor: COLORS.s2,
    borderWidth: 1, borderColor: COLORS.border2,
    borderRadius: 14, padding: 18, alignItems: 'center' },
  logoutTxt:{ fontSize: 16, color: COLORS.text2, fontWeight: '500' },
});
