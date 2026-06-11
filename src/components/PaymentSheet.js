import React, { useState, useEffect, useRef } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, SERVICIOS, fmt, hoy } from '../constants';
import { api } from '../services/api';

const PAGOS = [
  { id: 'efectivo',      label: '💵 Efectivo',     color: COLORS.ok,   bg: 'rgba(77,184,122,.15)'  },
  { id: 'debito',        label: '💳 Débito',        color: COLORS.blue, bg: 'rgba(85,130,212,.15)'  },
  { id: 'transferencia', label: '📲 Transferencia', color: COLORS.gold, bg: 'rgba(201,168,76,.15)'  },
];

export default function PaymentSheet({ visible, entry, barbero, onClose, onCompleted }) {
  const [pago,         setPago]         = useState('efectivo');
  const [propina,      setPropina]      = useState('');
  const [manualPrecio, setManualPrecio] = useState('');
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');

  // Stable registro ID for this sheet session — same ID on every retry so the
  // server's duplicate guard (POST /registros 409) blocks a second insert.
  const regIdRef = useRef(null);

  // Reset every time the sheet opens.
  // Billing ID is anchored to entry.id (queue entry UUID) — never to Date.now().
  // This means close+reopen for the same service always produces the same billing
  // ID, so the server's ON CONFLICT guard catches duplicates even across retries.
  useEffect(() => {
    if (visible && entry) {
      setPago('efectivo');
      setPropina('');
      setManualPrecio('');
      setLoading(false);
      setError('');
      regIdRef.current = 'TK' + String(entry.id).replace(/-/g, '');
    }
  }, [visible, entry?.id]);

  if (!entry) return null;

  // ── Price lookup ──────────────────────────────────────────────
  const svc = SERVICIOS.find(s => s.nom === entry.service);
  const catalogPrecio = svc?.precio ?? null;
  const hasManual     = catalogPrecio === null;
  const servicePrecio = hasManual ? (parseInt(manualPrecio) || 0) : catalogPrecio;

  // ── Live commission ───────────────────────────────────────────
  const com       = pago === 'debito' ? 0.43 : 0.50;
  const propinaNum = parseInt(propina) || 0;
  const bb        = Math.round(servicePrecio * com) + propinaNum;
  const neg       = servicePrecio - Math.round(servicePrecio * com);
  const total     = servicePrecio + propinaNum;

  // ── Submit ────────────────────────────────────────────────────
  const handleCerrar = async () => {
    if (loading) return;
    setError('');
    setLoading(true);
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}

    const now = new Date();
    const reg = {
      id:      regIdRef.current,
      bid:     barbero.bid,
      bnom:    barbero.nombre,
      sid:     'queue',
      snom:    entry.service,
      precio:  servicePrecio,
      pago:    pago,
      com:     com,
      bb:      bb,
      neg:     neg,
      propina: propinaNum,
      fecha:   hoy(),
      hora:    `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`,
      ts:      Date.now(),
    };

    try {
      // Step 1: create billing record
      const regRes = await api.registrar(reg);
      if (!regRes.ok && regRes.error !== 'duplicate') {
        throw new Error(regRes.error || 'Error al registrar el servicio');
      }

      // Step 2: mark queue entry as DONE
      const doneRes = await api.updateStatus(entry.id, 'DONE');
      if (!doneRes.ok) {
        throw new Error(doneRes.error || 'Error al completar el turno');
      }

      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      onCompleted();
    } catch (e) {
      setError('Error al cerrar: ' + (e.message || 'Intenta de nuevo'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.backdrop}>
          {/* Tap outside to dismiss */}
          <TouchableOpacity style={s.backdropTouch} activeOpacity={1} onPress={onClose} />

          <View style={s.sheet}>
            {/* Handle bar */}
            <View style={s.handle} />

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={s.scrollContent}
            >
              {/* Header */}
              <Text style={s.title}>Cerrar servicio</Text>
              <Text style={s.subtitle}>
                {entry.client_name} · {entry.service}
              </Text>

              {/* Service summary card */}
              <View style={s.summaryCard}>
                <View style={s.summaryLeft}>
                  <Text style={s.summaryServiceName}>{entry.service}</Text>
                  {entry.drink ? (
                    <Text style={s.summaryDrink}>☕ {entry.drink}</Text>
                  ) : null}
                </View>
                {!hasManual ? (
                  <Text style={s.summaryPrice}>${fmt(servicePrecio)}</Text>
                ) : (
                  <View style={s.manualPriceWrap}>
                    <Text style={s.manualPriceLbl}>Precio</Text>
                    <TextInput
                      style={s.manualPriceInput}
                      value={manualPrecio}
                      onChangeText={setManualPrecio}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={COLORS.text3}
                    />
                  </View>
                )}
              </View>

              {/* Payment method */}
              <Text style={s.sectionLbl}>FORMA DE PAGO</Text>
              <View style={s.pagoGrid}>
                {PAGOS.map(p => (
                  <TouchableOpacity
                    key={p.id}
                    style={[s.pagoBtn, pago === p.id && { backgroundColor: p.bg, borderColor: p.color }]}
                    onPress={() => { setPago(p.id); Haptics.selectionAsync().catch(() => {}); }}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.pagoBtnTxt, pago === p.id && { color: p.color }]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Commission preview */}
              <View style={s.commCard}>
                <View style={s.commRow}>
                  <Text style={s.commLbl}>Barbero</Text>
                  <Text style={[s.commVal, { color: COLORS.ok }]}>${fmt(bb)}</Text>
                </View>
                <View style={s.commDivider} />
                <View style={s.commRow}>
                  <Text style={s.commLbl}>Negocio</Text>
                  <Text style={[s.commVal, { color: COLORS.text3 }]}>${fmt(neg)}</Text>
                </View>
              </View>

              {/* Tip */}
              <Text style={[s.sectionLbl, { marginTop: 20 }]}>PROPINA (opcional)</Text>
              <TextInput
                style={s.input}
                value={propina}
                onChangeText={setPropina}
                keyboardType="numeric"
                placeholder="$0"
                placeholderTextColor={COLORS.text3}
              />

              {/* Error */}
              {error ? <Text style={s.errorTxt}>{error}</Text> : null}

              {/* CTA */}
              <TouchableOpacity
                style={[s.ctaBtn, (loading || (hasManual && servicePrecio === 0)) && s.ctaBtnDisabled]}
                onPress={handleCerrar}
                disabled={loading || (hasManual && servicePrecio === 0)}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color={COLORS.bg} />
                  : <Text style={s.ctaBtnTxt}>Cerrar servicio · ${fmt(total)}</Text>
                }
              </TouchableOpacity>

              {/* Cancel */}
              <TouchableOpacity style={s.cancelLink} onPress={onClose}>
                <Text style={s.cancelTxt}>Cancelar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  backdropTouch: { flex: 1 },
  sheet: {
    backgroundColor: COLORS.s1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border2,
    maxHeight: '92%',
  },
  handle: {
    width: 40, height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  scrollContent: { padding: 20, paddingBottom: 48 },

  // Header
  title:    { fontSize: 20, color: COLORS.text, fontWeight: '600',
    letterSpacing: 0.3, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif' },
  subtitle: { fontSize: 14, color: COLORS.text2, marginTop: 4, marginBottom: 18 },

  // Summary card
  summaryCard: {
    backgroundColor: COLORS.s2, borderRadius: 14,
    borderLeftWidth: 3, borderLeftColor: COLORS.gold,
    borderWidth: 1, borderColor: COLORS.border2,
    padding: 16, flexDirection: 'row',
    alignItems: 'center', marginBottom: 22,
  },
  summaryLeft:        { flex: 1 },
  summaryServiceName: { fontSize: 16, color: COLORS.text, fontWeight: '600' },
  summaryDrink:       { fontSize: 12, color: COLORS.text3, marginTop: 4 },
  summaryPrice:       { fontSize: 22, color: COLORS.gold, fontWeight: '600' },
  manualPriceWrap:    { alignItems: 'flex-end' },
  manualPriceLbl:     { fontSize: 11, color: COLORS.text3, letterSpacing: 1,
    textTransform: 'uppercase', marginBottom: 4 },
  manualPriceInput:   { backgroundColor: COLORS.s3, borderRadius: 8, borderWidth: 1,
    borderColor: COLORS.border2, color: COLORS.text, fontSize: 18,
    padding: 8, minWidth: 88, textAlign: 'right' },

  // Section label
  sectionLbl: { fontSize: 11, color: COLORS.text3, letterSpacing: 2.5,
    textTransform: 'uppercase', marginBottom: 10 },

  // Payment
  pagoGrid:  { flexDirection: 'row', gap: 8, marginBottom: 16 },
  pagoBtn:   { flex: 1, backgroundColor: COLORS.s2, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.border2, padding: 12, alignItems: 'center' },
  pagoBtnTxt:{ fontSize: 12, color: COLORS.text2, fontWeight: '600', textAlign: 'center' },

  // Commission
  commCard:    { backgroundColor: COLORS.s2, borderRadius: 12, borderWidth: 1,
    borderColor: COLORS.border, padding: 14, marginBottom: 6 },
  commRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 4 },
  commDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 6 },
  commLbl:     { fontSize: 13, color: COLORS.text3 },
  commVal:     { fontSize: 17, fontWeight: '600' },

  // Tip input
  input: { backgroundColor: COLORS.s2, borderRadius: 10, borderWidth: 1,
    borderColor: COLORS.border2, color: COLORS.text, fontSize: 17,
    padding: 14, marginBottom: 4 },

  // Error
  errorTxt: { fontSize: 13, color: COLORS.red, marginTop: 10, textAlign: 'center' },

  // CTA
  ctaBtn: { backgroundColor: COLORS.gold, borderRadius: 14,
    padding: 18, alignItems: 'center', marginTop: 24, minHeight: 56 },
  ctaBtnDisabled: { opacity: 0.55 },
  ctaBtnTxt:  { fontSize: 17, color: COLORS.bg, fontWeight: '700', letterSpacing: 0.5 },

  // Cancel
  cancelLink: { alignItems: 'center', paddingVertical: 16 },
  cancelTxt:  { fontSize: 14, color: COLORS.text3 },
});
