import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Image, Alert, ActivityIndicator, Dimensions, Switch,
} from 'react-native';
const API_URL = 'https://barberpilot-api-production.up.railway.app';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SERVICIOS, fmt, hoy } from '../constants';
import { api } from '../services/api';

const { width } = Dimensions.get('window');

const PAGOS = [
  { id: 'efectivo',      label: '💵 Efectivo',       color: COLORS.ok,   bg: 'rgba(77,184,122,.15)'  },
  { id: 'debito',        label: '💳 Débito',          color: COLORS.blue, bg: 'rgba(85,130,212,.15)'  },
  { id: 'transferencia', label: '📲 Transferencia',   color: COLORS.gold, bg: 'rgba(201,168,76,.15)'  },
];

export default function RegistrarScreen({ barbero }) {
  const [sid, setSid]               = useState('s01');
  const [precioLibre, setPrecioLibre] = useState('');
  const [nombreCustom, setNombreCustom] = useState('');
  const [pago, setPago]             = useState('efectivo');
  const [propina, setPropina]       = useState('');
  const [foto, setFoto]             = useState(null);
  const [enviando, setEnviando]     = useState(false);
  const [exito, setExito]           = useState(false);
  // CRM — datos del cliente
  const [guardarCliente, setGuardarCliente] = useState(false);
  const [cliNombre, setCliNombre]   = useState('');
  const [cliTel, setCliTel]         = useState('');
  const [cliCorreo, setCliCorreo]   = useState('');
  const [cliNotas, setCliNotas]     = useState('');
  const [cliBuscando, setCliBuscando] = useState(false);
  const [cliEncontrado, setCliEncontrado] = useState(false);

  const svc    = SERVICIOS.find((s) => s.id === sid) || SERVICIOS[0];
  const precio = svc.id === 'custom' ? (parseInt(precioLibre) || 0) : svc.precio;
  const com    = pago === 'debito' ? 0.43 : 0.5;
  const bb     = Math.round(precio * com) + (parseInt(propina) || 0);
  const neg    = precio - Math.round(precio * com);

  // ── Foto ──────────────────────────────────────────────────
  const tomarFoto = async (fromGallery = false) => {
    const { status } = fromGallery
      ? await ImagePicker.requestMediaLibraryPermissionsAsync()
      : await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Sin permiso', 'Necesitamos acceso a la ' + (fromGallery ? 'galería' : 'cámara'));
      return;
    }
    const result = fromGallery
      ? await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7, allowsEditing: true })
      : await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7, allowsEditing: true });

    if (!result.canceled && result.assets?.[0]) {
      setFoto({ uri: result.assets[0].uri, base64: result.assets[0].base64 });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const elegirFoto = () => {
    Alert.alert('Comprobante de transferencia', 'Selecciona una opción', [
      { text: '📷 Tomar foto ahora',  onPress: () => tomarFoto(false) },
      { text: '🖼 Elegir de galería', onPress: () => tomarFoto(true)  },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  // ── Enviar ────────────────────────────────────────────────
  const enviar = async () => {
    if (precio <= 0) { Alert.alert('Falta el precio', 'Ingresa el precio del servicio'); return; }
    if (svc.id === 'custom' && !nombreCustom.trim()) {
      Alert.alert('Falta el nombre', 'Ingresa el nombre del servicio'); return;
    }
    if (pago === 'transferencia' && !foto) {
      Alert.alert('Falta el comprobante', '¿Deseas enviar sin foto?', [
        { text: 'Adjuntar foto', style: 'cancel' },
        { text: 'Enviar igual',  onPress: () => _enviar() },
      ]);
      return;
    }
    _enviar();
  };

  const _enviar = async () => {
    setEnviando(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const ts  = Date.now();
      const now = new Date();
      const hora = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      const regId = `TK${ts}`;

      const reg = {
        id: regId, bid: barbero.bid, bnom: barbero.nombre,
        sid: svc.id,
        snom: svc.id === 'custom' ? nombreCustom.trim() : svc.nom,
        precio, pago, com, bb, neg,
        propina: parseInt(propina) || 0,
        fecha: hoy(), hora, ts,
      };

      const res = await api.registrar(reg);
      if (!res.ok) throw new Error(res.error || 'Error al registrar');

      // Subir foto si existe
      if (foto?.base64) {
        await api.subirFoto(regId, foto.base64).catch(() => {});
      }

      // Guardar cliente si autorizó
      if (guardarCliente && cliNombre.trim()) {
        try {
          const cliRes = await fetch(`${API_URL}/clientes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nombre: cliNombre.trim(),
              telefono: cliTel.trim() || null,
              correo: cliCorreo.trim() || null,
              notas: cliNotas.trim() || null,
              bid_registro: barbero.bid,
              bnom_registro: barbero.nombre,
            }),
          }).then(r => r.json());
          if (cliRes.ok) {
            await fetch(`${API_URL}/registros/${regId}/cliente`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ cliente_id: cliRes.id }),
            });
          }
        } catch {}
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setExito(true);
      setTimeout(() => {
        setSid('s01'); setPrecioLibre(''); setNombreCustom('');
        setPago('efectivo'); setPropina(''); setFoto(null);
        setGuardarCliente(false); setCliNombre(''); setCliTel('');
        setCliCorreo(''); setCliNotas(''); setCliEncontrado(false); setExito(false);
      }, 2500);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
    setEnviando(false);
  };

  // ── ÉXITO ─────────────────────────────────────────────────
  if (exito) return (
    <View style={[s.center, { backgroundColor: COLORS.bg }]}>
      <Text style={{ fontSize: 60 }}>✅</Text>
      <Text style={[s.exito1]}>¡Registrado!</Text>
      <Text style={s.exito2}>Esperando aprobación</Text>
    </View>
  );

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

      {/* SELECTOR SERVICIO */}
      <Text style={s.sectionLbl}>SERVICIO</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.svcScroll}>
        {SERVICIOS.filter((x) => x.id !== 'custom').map((sv) => (
          <TouchableOpacity
            key={sv.id}
            style={[s.svcChip, sid === sv.id && s.svcChipOn]}
            onPress={() => { setSid(sv.id); Haptics.selectionAsync(); }}
          >
            <Text style={[s.svcChipNom, sid === sv.id && { color: COLORS.gold }]} numberOfLines={2}>
              {sv.nom}
            </Text>
            <Text style={[s.svcChipPrecio, sid === sv.id && { color: COLORS.gold2 }]}>
              ${(sv.precio / 1000).toFixed(0)}K
            </Text>
          </TouchableOpacity>
        ))}
        {/* Especial */}
        <TouchableOpacity
          style={[s.svcChip, sid === 'custom' && s.svcChipOn]}
          onPress={() => { setSid('custom'); Haptics.selectionAsync(); }}
        >
          <Text style={[s.svcChipNom, sid === 'custom' && { color: COLORS.gold }]}>Especial…</Text>
          <Text style={[s.svcChipPrecio, sid === 'custom' && { color: COLORS.gold2 }]}>Libre</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Campos custom */}
      {svc.id === 'custom' && (
        <View style={s.card}>
          <Text style={s.inputLbl}>Nombre del servicio</Text>
          <TextInput
            style={s.input} value={nombreCustom} onChangeText={setNombreCustom}
            placeholder="Ej: Barba express" placeholderTextColor={COLORS.text3}
          />
          <Text style={[s.inputLbl, { marginTop: 14 }]}>Precio</Text>
          <TextInput
            style={s.input} value={precioLibre} onChangeText={setPrecioLibre}
            keyboardType="numeric" placeholder="0" placeholderTextColor={COLORS.text3}
          />
        </View>
      )}

      {/* PROPINA */}
      <Text style={[s.sectionLbl, { marginTop: 20 }]}>PROPINA (opcional)</Text>
      <TextInput
        style={[s.input, s.inputFull]} value={propina} onChangeText={setPropina}
        keyboardType="numeric" placeholder="$0" placeholderTextColor={COLORS.text3}
      />

      {/* FORMA DE PAGO */}
      <Text style={[s.sectionLbl, { marginTop: 20 }]}>FORMA DE PAGO</Text>
      <View style={s.pagoGrid}>
        {PAGOS.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={[s.pagoBtn, pago === p.id && { backgroundColor: p.bg, borderColor: p.color }]}
            onPress={() => { setPago(p.id); Haptics.selectionAsync(); }}
          >
            <Text style={[s.pagoBtnTxt, pago === p.id && { color: p.color }]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* FOTO TRANSFERENCIA */}
      {pago === 'transferencia' && (
        <View style={s.card}>
          <Text style={s.inputLbl}>📎 Comprobante de transferencia</Text>
          {foto ? (
            <View>
              <Image source={{ uri: foto.uri }} style={s.preview} resizeMode="cover" />
              <TouchableOpacity style={s.btnFotoSmall} onPress={() => setFoto(null)}>
                <Text style={s.btnFotoSmallTxt}>✕ Quitar foto</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={s.btnFoto} onPress={elegirFoto}>
              <Text style={s.btnFotoIco}>📷</Text>
              <Text style={s.btnFotoTxt}>Tomar o adjuntar foto</Text>
              <Text style={s.btnFotoSub}>Cámara o galería</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* CRM — DATOS DEL CLIENTE */}
      <View style={s.crmCard}>
        <View style={s.crmHeader}>
          <View>
            <Text style={s.crmTitle}>👤 Datos del cliente</Text>
            <Text style={s.crmSub}>¿El cliente autoriza guardar sus datos?</Text>
          </View>
          <Switch
            value={guardarCliente}
            onValueChange={setGuardarCliente}
            trackColor={{ false: COLORS.border2, true: COLORS.gold3 }}
            thumbColor={guardarCliente ? COLORS.gold : COLORS.text3}
          />
        </View>
        {guardarCliente && (
          <View style={s.crmFields}>
            <View style={{ position: 'relative' }}>
              <TextInput style={s.input} value={cliTel}
                onChangeText={buscarClientePorTel}
                placeholder="Telefono (busca cliente existente)"
                placeholderTextColor={COLORS.text3} keyboardType="phone-pad" />
              {cliBuscando && (
                <ActivityIndicator size="small" color={COLORS.gold}
                  style={{ position: 'absolute', right: 14, top: 14 }} />
              )}
              {cliEncontrado && (
                <View style={{ backgroundColor: 'rgba(77,184,122,.12)',
                  borderRadius: 8, padding: 8, marginTop: 6,
                  flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 14 }}>OK</Text>
                  <Text style={{ fontSize: 13, color: COLORS.ok }}>
                    Cliente encontrado - datos cargados
                  </Text>
                </View>
              )}
            </View>
            <TextInput style={[s.input,{marginTop:8}]} value={cliNombre}
              onChangeText={setCliNombre}
              placeholder="Nombre *" placeholderTextColor={COLORS.text3} />
            <TextInput style={[s.input,{marginTop:8}]} value={cliCorreo}
              onChangeText={setCliCorreo}
              placeholder="Correo (opcional)" placeholderTextColor={COLORS.text3}
              keyboardType="email-address" autoCapitalize="none" />
            <TextInput style={[s.input,{marginTop:8,minHeight:70,textAlignVertical:'top'}]}
              value={cliNotas} onChangeText={setCliNotas}
              placeholder="Notas (ej: le gusta el fade bajo)"
              placeholderTextColor={COLORS.text3} multiline />
          </View>
        )}
      </View>

      {/* PREVIEW BB */}
      <View style={s.preview2}>
        <Text style={s.previewLbl}>RECIBES TÚ</Text>
        <Text style={s.previewVal}>${fmt(bb)}</Text>
        <Text style={s.previewSub}>{Math.round(com * 100)}% comisión · ${fmt(precio)} servicio</Text>
      </View>

      {/* BOTÓN ENVIAR */}
      <TouchableOpacity style={s.btnEnviar} onPress={enviar} disabled={enviando} activeOpacity={0.8}>
        {enviando
          ? <ActivityIndicator color={COLORS.bg} />
          : <Text style={s.btnEnviarTxt}>✓  Enviar para aprobación</Text>
        }
      </TouchableOpacity>

    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll:    { flex: 1, backgroundColor: COLORS.bg },
  content:   { padding: 18, paddingBottom: 40 },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg, gap: 12 },
  exito1:    { fontSize: 32, color: COLORS.ok, fontWeight: '500', letterSpacing: 2 },
  exito2:    { fontSize: 16, color: COLORS.text3, letterSpacing: 1 },

  sectionLbl: { fontSize: 11, color: COLORS.text3, letterSpacing: 2.5,
    textTransform: 'uppercase', marginBottom: 10 },

  svcScroll: { marginHorizontal: -18, paddingLeft: 18, paddingBottom: 4 },
  svcChip:   { width: 110, backgroundColor: COLORS.s2, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border, padding: 14, marginRight: 8,
    alignItems: 'center' },
  svcChipOn: { backgroundColor: 'rgba(201,168,76,.1)', borderColor: COLORS.gold3 },
  svcChipNom:   { fontSize: 13, color: COLORS.text2, textAlign: 'center',
    fontWeight: '500', marginBottom: 4, lineHeight: 18 },
  svcChipPrecio:{ fontSize: 16, color: COLORS.text3, fontWeight: '600' },

  card:      { backgroundColor: COLORS.s1, borderRadius: 14, borderWidth: 1,
    borderColor: COLORS.border, padding: 18, marginTop: 14 },
  inputLbl:  { fontSize: 12, color: COLORS.text3, letterSpacing: 1.5,
    textTransform: 'uppercase', marginBottom: 8 },
  input:     { backgroundColor: COLORS.s2, borderRadius: 10, borderWidth: 1,
    borderColor: COLORS.border2, color: COLORS.text, fontSize: 17,
    padding: 14 },
  inputFull: { marginBottom: 0 },

  pagoGrid:  { flexDirection: 'row', gap: 8 },
  pagoBtn:   { flex: 1, backgroundColor: COLORS.s2, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.border2, padding: 14, alignItems: 'center' },
  pagoBtnTxt:{ fontSize: 13, color: COLORS.text2, fontWeight: '600', textAlign: 'center' },

  btnFoto:   { borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border2,
    borderStyle: 'dashed', padding: 28, alignItems: 'center', gap: 8 },
  btnFotoIco:{ fontSize: 36 },
  btnFotoTxt:{ fontSize: 16, color: COLORS.gold, fontWeight: '600' },
  btnFotoSub:{ fontSize: 13, color: COLORS.text3 },
  preview:   { width: '100%', height: 200, borderRadius: 10, marginTop: 10 },
  btnFotoSmall: { marginTop: 10, padding: 10, alignItems: 'center' },
  btnFotoSmallTxt: { color: COLORS.red, fontSize: 14 },

  preview2:  { backgroundColor: 'rgba(77,184,122,.08)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(77,184,122,.2)',
    padding: 22, alignItems: 'center', marginTop: 22 },
  previewLbl:{ fontSize: 11, color: COLORS.text3, letterSpacing: 2.5,
    textTransform: 'uppercase', marginBottom: 6 },
  previewVal:{ fontSize: 42, color: COLORS.ok, fontWeight: '500',
    fontVariant: ['tabular-nums'] },
  previewSub:{ fontSize: 13, color: COLORS.text3, marginTop: 4 },

  btnEnviar: { backgroundColor: COLORS.gold, borderRadius: 14,
    padding: 18, alignItems: 'center', marginTop: 22 },
  btnEnviarTxt: { fontSize: 18, color: COLORS.bg, fontWeight: '700', letterSpacing: 1 },

  crmCard:   { backgroundColor: COLORS.s1, borderRadius: 14, borderWidth: 1,
    borderColor: COLORS.border, padding: 16, marginTop: 20 },
  crmHeader: { flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center' },
  crmTitle:  { fontSize: 15, color: COLORS.text, fontWeight: '600' },
  crmSub:    { fontSize: 12, color: COLORS.text3, marginTop: 2 },
  crmFields: { marginTop: 14, gap: 0 },
});
