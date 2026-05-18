import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { COLORS } from '../constants';

const API_URL = 'https://barberpilot-api-production.up.railway.app';

export default function MensajesScreen({ barbero }) {
  const [mensajes, setMensajes] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const cargar = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r = await fetch(`${API_URL}/mensajes/${barbero.bid}`);
      const json = await r.json();
      if (json.ok) setMensajes(json.mensajes || []);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { cargar(); }, []);

  const formatFecha = (ts) => {
    const d = new Date(ts);
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })
      + ' ' + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return (
    <View style={s.center}><ActivityIndicator size="large" color={COLORS.gold} /></View>
  );

  return (
    <ScrollView
      style={s.scroll} contentContainerStyle={s.content}
      refreshControl={
        <RefreshControl refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); cargar(true); }}
          tintColor={COLORS.gold} colors={[COLORS.gold]} />
      }
    >
      <Text style={s.titulo}>NOTAS DEL SALÓN</Text>

      {mensajes.length === 0 ? (
        <View style={s.empty}>
          <Text style={{ fontSize: 44, marginBottom: 12 }}>💬</Text>
          <Text style={s.emptyTxt}>Sin mensajes aún</Text>
          <Text style={s.emptySub}>Las notas del administrador{'\n'}aparecerán aquí</Text>
        </View>
      ) : (
        mensajes.map(m => (
          <View key={m.id} style={s.msgCard}>
            <View style={s.msgHeader}>
              <View style={s.msgFromBadge}>
                <Text style={s.msgFrom}>⚡ Admin</Text>
              </View>
              <Text style={s.msgFecha}>{formatFecha(m.creado_en)}</Text>
            </View>
            <Text style={s.msgContenido}>{m.contenido}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll:   { flex: 1, backgroundColor: COLORS.bg },
  content:  { padding: 18, paddingBottom: 40 },
  center:   { flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.bg },
  titulo:   { fontSize: 11, color: COLORS.text3, letterSpacing: 2.5,
    textTransform: 'uppercase', marginBottom: 16 },
  empty:    { alignItems: 'center', paddingVertical: 60 },
  emptyTxt: { fontSize: 18, color: COLORS.text2, fontWeight: '500' },
  emptySub: { fontSize: 14, color: COLORS.text3, textAlign: 'center',
    marginTop: 8, lineHeight: 22 },
  msgCard:  { backgroundColor: COLORS.s1, borderRadius: 14, borderWidth: 1,
    borderColor: COLORS.border, padding: 16, marginBottom: 12,
    borderLeftWidth: 3, borderLeftColor: COLORS.gold },
  msgHeader:{ flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10 },
  msgFromBadge: { backgroundColor: 'rgba(201,168,76,.12)', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4 },
  msgFrom:  { fontSize: 12, color: COLORS.gold, fontWeight: '700', letterSpacing: 1 },
  msgFecha: { fontSize: 12, color: COLORS.text3 },
  msgContenido: { fontSize: 16, color: COLORS.text, lineHeight: 24 },
});
