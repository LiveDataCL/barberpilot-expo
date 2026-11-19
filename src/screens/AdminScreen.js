import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Alert,
  Dimensions, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { API_URL, COLORS, fmt, fmtM, hoy, mesPeriodo, SERVICIOS_FALLBACK } from '../constants';
import { useBarberos } from '../hooks/useBarberos';
import { api, fetchAutenticado } from '../services/api';
import { kpisPorBarbero } from '../services/kpisBarberos';
import { botonesPago, comisionPreview, etiquetaPago } from '../services/pagos';
const { width } = Dimensions.get('window');

function minsHasta(hora) {
  if (!hora) return null;
  const [h, m] = hora.split(':').map(Number);
  const now = new Date();
  return (h * 60 + m) - (now.getHours() * 60 + now.getMinutes());
}

// Same phrasing/thresholds as saulfino-web/checkin.html's inline last-visit
// formatter (lookupPhone()) — kept identical on purpose so staff see the
// same wording here as clients see on the public check-in page.
function formatUltimaVisitaRelativa(fechaStr) {
  if (!fechaStr) return null;
  const d = new Date(fechaStr), now = new Date();
  const days = Math.floor((now - d) / 86400000);
  return days === 0 ? 'hoy'
    : days === 1 ? 'ayer'
    : days < 7 ? 'hace ' + days + ' días'
    : days < 30 ? 'hace ' + Math.floor(days / 7) + 'sem.'
    : 'hace ' + Math.floor(days / 30) + 'mes';
}

const TABS_ADMIN = [
  { id: 'resumen',    label: 'Resumen',   icon: 'stats-chart-outline' },
  { id: 'agenda',     label: 'Agenda',    icon: 'calendar-outline' },
  { id: 'registrar',  label: 'Registrar', icon: 'add-circle-outline' },
  { id: 'recepcion',  label: 'Recepción', icon: 'notifications-outline' },
  { id: 'sillas',     label: 'Sillas',    icon: 'cut-outline' },
  { id: 'tendencias', label: 'Análisis',  icon: 'flame-outline' },
  { id: 'barberos',   label: 'Perfiles',  icon: 'people-outline' },
];

export default function AdminScreen({ onLogout, catalogo }) {
  // Live catalog when available; SERVICIOS_FALLBACK only as last resort.
  const SERVICIOS = (catalogo?.servicios && catalogo.servicios.length > 0) ? catalogo.servicios : SERVICIOS_FALLBACK;
  const preciosCargando = !catalogo || catalogo.cargando === true;
  // Sillas: the board state of each barber (GET /api/v2/sillas/estado), refreshed with the screen's 30 s cargar()
  const [sillas, setSillas] = useState(null);
  const [sillasErr, setSillasErr] = useState(null);
  const [sillasBusy, setSillasBusy] = useState(null);
  const [tab, setTab]             = useState('resumen');
  const [resumen, setResumen]     = useState(null);
  const [regsHoy, setRegsHoy]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Registro de servicio por admin
  const [regBid,     setRegBid]     = useState('b1');
  const [regSid,     setRegSid]     = useState('s01');
  const [regPago,    setRegPago]    = useState('efectivo');
  const [regPropina, setRegPropina] = useState('');
  const [regCustomNom, setRegCustomNom] = useState('');
  const [regCustomPrecio, setRegCustomPrecio] = useState('');
  const [regEnviando, setRegEnviando] = useState(false);
  const [regExito,    setRegExito]    = useState(false);
  const [tendData,    setTendData]    = useState(null);

  // ── Barbero seleccionado para ver su perfil ──────────────────
  const [verBarbero, setVerBarbero] = useState(null);
  const [datosBarbero, setDatosBarbero] = useState(null);

  // ── Avatares de barberos ──────────────────────────────────────
  const [avatarImgs, setAvatarImgs] = useState({});

  // ── Agenda ───────────────────────────────────────────────────
  const [agendaHoy,   setAgendaHoy]   = useState({});
  const [agendaPend,  setAgendaPend]  = useState(new Set());
  const [badgeAgenda, setBadgeAgenda] = useState(0);

  // ── Recepción (walk-in check-in) ──────────────────────────────
  const [recTel,          setRecTel]          = useState('');
  const [recNombre,       setRecNombre]       = useState('');
  const [recBuscando,     setRecBuscando]     = useState(false);
  const [recUltimaVisita, setRecUltimaVisita] = useState(null);
  const [recBid,          setRecBid]          = useState(null);
  const [recSvcNom,       setRecSvcNom]       = useState(null);
  const [recBebida,       setRecBebida]       = useState('');
  const [recEnviando,     setRecEnviando]     = useState(false);
  const [recResultado,    setRecResultado]    = useState(null);
  const recLookupTimer = useRef(null);

  const { barberos } = useBarberos();
  const kpisHoy = useMemo(() => kpisPorBarbero(regsHoy, barberos), [regsHoy, barberos]);

  const cargarAgendaHoy = useCallback(async () => {
    if (!barberos.length) return;
    const fecha = hoy();
    const results = await Promise.all(
      barberos.map(b =>
        api.agenda(b.bid, fecha)
          .then(d => ({ bid: b.bid, appts: (d.appointments || []).filter(a => a.estado !== 'cancelado') }))
          .catch(() => ({ bid: b.bid, appts: [] }))
      )
    );
    const map = {};
    let proximas = 0;
    results.forEach(({ bid, appts }) => {
      map[bid] = appts;
      appts.forEach(a => {
        const m = minsHasta(a.hora_inicio);
        if (m !== null && m >= 0 && m <= 30) proximas++;
      });
    });
    setAgendaHoy(map);
    setBadgeAgenda(proximas);
  }, [barberos]);

  useEffect(() => {
    cargarAgendaHoy();
    const t = setInterval(cargarAgendaHoy, 30000);
    return () => clearInterval(t);
  }, [cargarAgendaHoy]);

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

  const cargar = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [resRes, diaRes] = await Promise.all([
        fetchAutenticado(`/admin/resumen`).then(r => r.json()),
        fetchAutenticado(`/registros/dia?fecha=${hoy()}`).then(r => r.json()),
      ]);
      if (resRes.ok)  setResumen(resRes);
      if (diaRes.ok && Array.isArray(diaRes.registros)) setRegsHoy(diaRes.registros);
      try { setSillas(await api.get('/api/v2/sillas/estado')); setSillasErr(null); }
      catch (e) { setSillasErr(e.message || 'Sin conexión'); }
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    cargar();
    const interval = setInterval(() => cargar(true), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (tab === 'tendencias' && !tendData) cargarTendencias();
  }, [tab]);

  const handlePasarAColaAdmin = async (cita, barb) => {
    const key = 'apt_' + cita.id;
    setAgendaPend(p => new Set([...p, key]));
    try {
      await api.post('/queue/checkin', {
        client_name: cita.client_name,
        phone:       cita.client_phone || null,
        barber_id:   barb.nombre.toLowerCase(),
        service:     cita.svc_nom,
        drink:       null,
      });
      await cargarAgendaHoy();
    } catch (e) {
      Alert.alert('Error', e.message || 'No se pudo agregar a la cola.');
    } finally {
      setAgendaPend(p => { const n = new Set(p); n.delete(key); return n; });
    }
  };

  const verPerfilBarbero = async (b) => {
    setVerBarbero(b);
    try {
      const [hoyRes, mesRes] = await Promise.all([
        api.hoy(b.bid),
        api.mes(b.bid, mesPeriodo()),
      ]);
      setDatosBarbero({ hoy: hoyRes, mes: mesRes });
    } catch {}
  };

  useEffect(() => {
    (async () => {
      const imgs = {};
      for (const b of barberos) {
        const uri = await SecureStore.getItemAsync(`bp_avatar_img_${b.bid}`).catch(() => null);
        if (uri) imgs[b.bid] = uri;
      }
      setAvatarImgs(imgs);
    })();
  }, []);

  const cambiarAvatarAdmin = async (b) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Sin permiso', 'Se necesita acceso a la galería'); return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const dir = FileSystem.documentDirectory + 'avatars/';
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
    const dest = dir + `avatar_${b.bid}.jpg`;
    await FileSystem.copyAsync({ from: result.assets[0].uri, to: dest });
    await SecureStore.setItemAsync(`bp_avatar_img_${b.bid}`, dest);
    await SecureStore.deleteItemAsync(`bp_avatar_${b.bid}`).catch(() => {});
    setAvatarImgs(prev => ({ ...prev, [b.bid]: dest }));
  };

  // ── RENDER TABS ─────────────────────────────────────────────

  const registrarServicioAdmin = async () => {
    const svc = SERVICIOS.find(s => s.id === regSid) || SERVICIOS[0];
    const precio = svc.id === 'custom' ? (parseInt(regCustomPrecio)||0) : svc.precio;
    if (precio <= 0) { Alert.alert('Falta el precio'); return; }
    const b = barberos.find(x => x.bid === regBid);
    const prevReg = comisionPreview(catalogo, regPago, precio);   // informative; the server recomputes
    const ts  = Date.now();
    const now = new Date();
    const hora = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
    const reg = {
      id: 'TK'+ts, bid: regBid, bnom: b?.nombre||regBid,
      sid: svc.id,
      snom: svc.id==='custom' ? regCustomNom.trim()||'Servicio especial' : svc.nom,
      precio, pago: regPago, ...(prevReg ? { com: prevReg.com, bb: prevReg.bb, neg: prevReg.neg } : {}),
      propina: parseInt(regPropina)||0,
      fecha: hoy(), hora, ts,
    };
    setRegEnviando(true);
    try {
      // Admin registra directo como confirmado (authenticated call: the session token is sent by api.registrar)
      const res = await api.registrar(reg);
      if (!res.ok) {
        Alert.alert('No se registró', res.error === 'duplicate' ? 'Ese servicio ya estaba registrado.' : 'Intenta de nuevo.');
      } else {
        setRegExito(true);
        setRegPropina(''); setRegCustomNom(''); setRegCustomPrecio('');
        await sendPushToBarber(regBid, '✂️ Nuevo servicio', svc.id==='custom' ? regCustomNom : svc.nom);
        setTimeout(() => setRegExito(false), 2500);
        cargar(true);
      }
    } catch (e) { Alert.alert('Error al registrar', e.message || 'Intenta de nuevo.'); }
    setRegEnviando(false);
  };

  // ── Recepción: buscar cliente por teléfono (debounced, público) ──────────
  const buscarTelRecepcion = (tel) => {
    setRecTel(tel);
    setRecUltimaVisita(null);
    if (recLookupTimer.current) clearTimeout(recLookupTimer.current);
    if (!tel || tel.length < 8) { setRecBuscando(false); return; }
    recLookupTimer.current = setTimeout(async () => {
      setRecBuscando(true);
      try {
        const r = await fetch(`${API_URL}/clientes/lookup?phone=${encodeURIComponent(tel)}`).then(x => x.json());
        if (r.ok && r.found && r.cliente) {
          setRecNombre(r.cliente.nombre || '');
          // ultima_visita here comes from cliente.ultima_visita (a raw
          // Postgres date, parseable directly by new Date() — same field
          // saulfino-web/checkin.html itself uses for this exact relative-
          // time phrase), not from ultimos_servicios[0].fecha_display, which
          // is pre-formatted DD/MM/YYYY text and not safe to re-parse with
          // new Date().
          setRecUltimaVisita({
            relativo: formatUltimaVisitaRelativa(r.cliente.ultima_visita),
            barbero:  r.ultimo_barbero || null,
            bebida:   r.ultima_bebida || null,
            visitas:  r.cliente.visitas || 0,
          });
        }
      } catch {}
      setRecBuscando(false);
    }, 300);
  };

  // ── Recepción: registrar + iniciar (POST /queue/control/checkin) ─────────
  const registrarRecepcion = async () => {
    if (!recNombre.trim()) { Alert.alert('Falta el nombre'); return; }
    if (!recBid) { Alert.alert('Elige un barbero'); return; }
    if (!recSvcNom) { Alert.alert('Elige un servicio'); return; }
    setRecEnviando(true);
    try {
      const body = {
        client_name: recNombre.trim(),
        phone: recTel.trim() || null,
        bid: recBid,
        // Sent verbatim — matched against the servicios catalog server-side
        // by exact string. Never transform/abbreviate/retype this value,
        // it would silently break that downstream match and any duration
        // analytics keyed off the exact service name.
        service: recSvcNom,
        bebida: recBebida.trim() || null,
        bebida_es_otro: !!recBebida.trim(),
      };
      const res = await fetch(`${API_URL}/queue/control/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => r.json());
      if (!res.ok) {
        Alert.alert('Error', res.error || 'No se pudo registrar');
        setRecEnviando(false);
        return;
      }
      setRecResultado({
        nombre: recNombre.trim(),
        status: res.status,
        resolvedBarberId: res.resolved_barber_id,
        resolvedBarberName: res.resolved_barber_name,
        queuePosition: res.queue_position,
        esperaMin: res.estimated_wait_min,
      });
      setRecTel(''); setRecNombre(''); setRecBid(null); setRecSvcNom(null); setRecBebida('');
      setRecUltimaVisita(null);
      setTimeout(() => setRecResultado(null), 2500);
    } catch (e) {
      Alert.alert('Error de conexión', e.message || '');
    }
    setRecEnviando(false);
  };

  const sendPushToBarber = async (bid, title, body) => {
    try {
      await fetch(`${API_URL}/push/test`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ bid, title, body }),
      });
    } catch {}
  };

  const renderRegistrar = () => {
    const svc    = SERVICIOS.find(s => s.id === regSid) || SERVICIOS[0];
    const precio = svc.id === 'custom' ? (parseInt(regCustomPrecio) || 0) : svc.precio;
    // Preview from the server's rates; "Recibe" = commission + tip, shown as such.
    const prevV  = comisionPreview(catalogo, regPago, precio);
    const com    = prevV ? prevV.com : null;
    const bb     = prevV ? prevV.bb + (parseInt(regPropina) || 0) : null;
    const PAGOS  = botonesPago(catalogo);
    if (regExito) {
      return (
        <View style={s.center}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>OK</Text>
          <Text style={{ fontSize: 20, color: COLORS.ok, fontWeight: '600' }}>Registrado</Text>
          <Text style={{ fontSize: 14, color: COLORS.text3, marginTop: 6 }}>
            Asignado a {barberos.find(b => b.bid === regBid) ? barberos.find(b => b.bid === regBid).nombre : regBid}
          </Text>
        </View>
      );
    }
    return (
      <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg }}
        contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

        <Text style={s.secLbl}>ASIGNAR A BARBERO</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 18 }}>
          {barberos.map(function(b) {
            return (
              <TouchableOpacity key={b.bid}
                style={[s.accionCard, regBid === b.bid && { borderColor: b.color, backgroundColor: 'rgba(201,168,76,.08)' }]}
                onPress={function() { setRegBid(b.bid); }}>
                <View style={[s.accionAvatar, { backgroundColor: b.bg }]}>
                  <Text style={[s.accionLetra, { color: b.color }]}>{b.letra}</Text>
                </View>
                <Text style={[s.accionNom, regBid === b.bid && { color: b.color }]}>{b.nombre}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={s.secLbl}>SERVICIO</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -18, paddingLeft: 18, marginBottom: 16 }}>
          {SERVICIOS.filter(function(sv) { return sv.id !== 'custom'; }).map(function(sv) {
            return (
              <TouchableOpacity key={sv.id}
                style={{ width: 105, backgroundColor: regSid === sv.id ? 'rgba(201,168,76,.12)' : COLORS.s2,
                  borderRadius: 12, borderWidth: 1,
                  borderColor: regSid === sv.id ? COLORS.gold : COLORS.border,
                  padding: 12, marginRight: 8, alignItems: 'center' }}
                onPress={function() { setRegSid(sv.id); }}>
                <Text style={{ fontSize: 12, color: regSid === sv.id ? COLORS.gold : COLORS.text2,
                  textAlign: 'center', fontWeight: '500', marginBottom: 4 }}>{sv.nom}</Text>
                <Text style={{ fontSize: 14, color: regSid === sv.id ? COLORS.gold2 : COLORS.text3,
                  fontWeight: '600' }}>{'$' + sv.precio / 1000 + 'K'}</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={{ width: 105, backgroundColor: regSid === 'custom' ? 'rgba(201,168,76,.12)' : COLORS.s2,
              borderRadius: 12, borderWidth: 1,
              borderColor: regSid === 'custom' ? COLORS.gold : COLORS.border,
              padding: 12, marginRight: 18, alignItems: 'center' }}
            onPress={function() { setRegSid('custom'); }}>
            <Text style={{ fontSize: 12, color: regSid === 'custom' ? COLORS.gold : COLORS.text2,
              textAlign: 'center', fontWeight: '500', marginBottom: 4 }}>Especial</Text>
            <Text style={{ fontSize: 14, color: COLORS.text3 }}>Libre</Text>
          </TouchableOpacity>
        </ScrollView>

        {regSid === 'custom' && (
          <View style={{ marginBottom: 14 }}>
            <TextInput style={s.input} value={regCustomNom} onChangeText={setRegCustomNom}
              placeholder="Nombre del servicio" placeholderTextColor={COLORS.text3} />
            <TextInput style={[s.input, { marginTop: 8 }]} value={regCustomPrecio}
              onChangeText={setRegCustomPrecio} placeholder="Precio"
              placeholderTextColor={COLORS.text3} keyboardType="numeric" />
          </View>
        )}

        <Text style={s.secLbl}>FORMA DE PAGO</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          {PAGOS.map(function(p) {
            return (
              <TouchableOpacity key={p.id}
                style={{ flex: 1, padding: 12, borderRadius: 12, borderWidth: 1.5,
                  alignItems: 'center',
                  borderColor: regPago === p.id ? p.color : COLORS.border2,
                  backgroundColor: regPago === p.id ? 'rgba(77,184,122,.08)' : COLORS.s2 }}
                onPress={function() { setRegPago(p.id); }}>
                <Text style={{ fontSize: 12, color: regPago === p.id ? p.color : COLORS.text2,
                  fontWeight: '600' }}>{p.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={s.secLbl}>PROPINA (OPCIONAL)</Text>
        <TextInput style={[s.input, { marginBottom: 16 }]} value={regPropina}
          onChangeText={setRegPropina} placeholder="$0"
          placeholderTextColor={COLORS.text3} keyboardType="numeric" />

        <View style={{ backgroundColor: 'rgba(77,184,122,.08)', borderRadius: 14,
          borderWidth: 1, borderColor: 'rgba(77,184,122,.2)',
          padding: 20, alignItems: 'center', marginBottom: 18 }}>
          <Text style={{ fontSize: 11, color: COLORS.text3, letterSpacing: 2,
            textTransform: 'uppercase', marginBottom: 6 }}>
            {'RECIBE ' + (barberos.find(function(b) { return b.bid === regBid; }) || {}).nombre}
          </Text>
          <Text style={{ fontSize: 40, color: COLORS.ok, fontWeight: '500' }}>{bb == null ? 'al guardar' : '$' + fmt(bb)}</Text>
          <Text style={{ fontSize: 13, color: COLORS.text3, marginTop: 4 }}>
            {com == null ? '' : Math.round(com * 100) + '% sobre $' + fmt(precio) + ((parseInt(regPropina) || 0) > 0 ? ' + propina' : '')}
          </Text>
        </View>

        <TouchableOpacity
          style={{ backgroundColor: COLORS.gold, borderRadius: 14, padding: 18, alignItems: 'center',
            opacity: (regEnviando || preciosCargando) ? 0.55 : 1 }}
          onPress={registrarServicioAdmin} disabled={regEnviando || preciosCargando}>
          {regEnviando || preciosCargando
            ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator color={COLORS.bg} />
                {preciosCargando && !regEnviando && (
                  <Text style={{ fontSize: 15, color: COLORS.bg, fontWeight: '700' }}>Actualizando precios…</Text>
                )}
              </View>
            )
            : <Text style={{ fontSize: 17, color: COLORS.bg, fontWeight: '700' }}>Registrar servicio</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    );
  };

  const renderRecepcion = () => {
    if (recResultado) {
      const r = recResultado;
      let titulo, detalle;
      if (r.status === 'IN_SERVICE') {
        // Unambiguous: this client is already in the chair, not waiting.
        titulo = 'Servicio iniciado con ' + (r.resolvedBarberName || '');
        detalle = r.nombre;
      } else if (r.resolvedBarberId === 'pool') {
        titulo = 'Sin barberos disponibles ahora';
        detalle = 'Cliente en cola, se asignará al primero libre';
      } else {
        titulo = 'En cola';
        detalle = 'Posición #' + r.queuePosition + ', esperando a ' + (r.resolvedBarberName || '') + ' · ~' + r.esperaMin + ' min';
      }
      return (
        <View style={s.center}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>OK</Text>
          <Text style={{ fontSize: 20, color: COLORS.ok, fontWeight: '600' }}>
            {titulo}
          </Text>
          <Text style={{ fontSize: 14, color: COLORS.text3, marginTop: 6, textAlign: 'center', paddingHorizontal: 24 }}>
            {detalle}
          </Text>
        </View>
      );
    }
    return (
      <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg }}
        contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

        <Text style={s.secLbl}>TELÉFONO (OPCIONAL)</Text>
        <View style={{ position: 'relative', marginBottom: 14 }}>
          <TextInput style={s.input} value={recTel}
            onChangeText={buscarTelRecepcion}
            placeholder="+56 9 1234 5678" placeholderTextColor={COLORS.text3}
            keyboardType="phone-pad" />
          {recBuscando && (
            <ActivityIndicator size="small" color={COLORS.gold}
              style={{ position: 'absolute', right: 14, top: 14 }} />
          )}
        </View>

        {recUltimaVisita && (
          <View style={{ backgroundColor: 'rgba(77,184,122,.08)', borderRadius: 10,
            borderWidth: 1, borderColor: 'rgba(77,184,122,.2)', padding: 12, marginBottom: 14 }}>
            <Text style={{ fontSize: 12, color: COLORS.ok, fontWeight: '600', marginBottom: 2 }}>
              Cliente conocido · {recUltimaVisita.visitas} visita{recUltimaVisita.visitas === 1 ? '' : 's'}
            </Text>
            <Text style={{ fontSize: 12, color: COLORS.text2 }}>
              {'Última visita: ' + (recUltimaVisita.relativo || '—')
                + (recUltimaVisita.barbero ? ' · ' + recUltimaVisita.barbero : '')
                + (recUltimaVisita.bebida ? ' · ' + recUltimaVisita.bebida : '')}
            </Text>
          </View>
        )}

        <Text style={s.secLbl}>NOMBRE *</Text>
        <TextInput style={[s.input, { marginBottom: 16 }]} value={recNombre}
          onChangeText={setRecNombre} placeholder="Nombre del cliente"
          placeholderTextColor={COLORS.text3} />

        <Text style={s.secLbl}>BARBERO</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 18 }}>
          <TouchableOpacity
            style={[s.accionCard, recBid === 'any' && { borderColor: COLORS.gold, backgroundColor: 'rgba(201,168,76,.08)' }]}
            onPress={function() { setRecBid('any'); }}>
            <View style={[s.accionAvatar, { backgroundColor: 'rgba(201,168,76,.18)' }]}>
              <Text style={[s.accionLetra, { color: COLORS.gold }]}>⚡</Text>
            </View>
            <Text style={[s.accionNom, recBid === 'any' && { color: COLORS.gold }]}>Primer disponible</Text>
          </TouchableOpacity>
          {barberos.map(function(b) {
            return (
              <TouchableOpacity key={b.bid}
                style={[s.accionCard, recBid === b.bid && { borderColor: b.color, backgroundColor: 'rgba(201,168,76,.08)' }]}
                onPress={function() { setRecBid(b.bid); }}>
                <View style={[s.accionAvatar, { backgroundColor: b.bg }]}>
                  <Text style={[s.accionLetra, { color: b.color }]}>{b.letra}</Text>
                </View>
                <Text style={[s.accionNom, recBid === b.bid && { color: b.color }]}>{b.nombre}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={s.secLbl}>SERVICIO *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -18, paddingLeft: 18, marginBottom: 16 }}>
          {SERVICIOS.filter(function(sv) { return sv.id !== 'custom'; }).map(function(sv) {
            return (
              <TouchableOpacity key={sv.id}
                style={{ width: 105, backgroundColor: recSvcNom === sv.nom ? 'rgba(201,168,76,.12)' : COLORS.s2,
                  borderRadius: 12, borderWidth: 1,
                  borderColor: recSvcNom === sv.nom ? COLORS.gold : COLORS.border,
                  padding: 12, marginRight: 8, alignItems: 'center', justifyContent: 'center' }}
                onPress={function() {
                  // service is sent to POST /queue/control/checkin verbatim
                  // and matched against the servicios catalog server-side by
                  // exact string — never transform/abbreviate/retype sv.nom,
                  // it would silently break that match.
                  setRecSvcNom(sv.nom);
                }}>
                <Text style={{ fontSize: 12, color: recSvcNom === sv.nom ? COLORS.gold : COLORS.text2,
                  textAlign: 'center', fontWeight: '500' }}>{sv.nom}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={s.secLbl}>BEBIDA (OPCIONAL)</Text>
        <TextInput style={[s.input, { marginBottom: 20 }]} value={recBebida}
          onChangeText={setRecBebida} placeholder="Ej: Café, agua…"
          placeholderTextColor={COLORS.text3} />

        <TouchableOpacity
          style={{ backgroundColor: COLORS.gold, borderRadius: 14, padding: 18, alignItems: 'center',
            opacity: recEnviando ? 0.55 : 1 }}
          onPress={registrarRecepcion} disabled={recEnviando}>
          {recEnviando
            ? <ActivityIndicator color={COLORS.bg} />
            : <Text style={{ fontSize: 17, color: COLORS.bg, fontWeight: '700' }}>Registrar e iniciar</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    );
  };

  // ── Sillas (same data and rules as the panel and the TV) ─────────────
  // The state comes from the server. Mapping from the server's state to the words on screen:
  const etiquetaSilla = (b) => {
    if (b.state === 'cortando') return (b.estimated_end && b.remaining_min > 0)
      ? 'Cortando · termina ~' + b.estimated_end : 'Cortando · termina en breve';
    if (b.state === 'espera') return 'Con cliente en espera';
    if (b.state === 'siguiente') return 'Siguiente';
    if (b.state === 'disponible') return 'Disponible';
    if (b.state === 'ausente') return 'Ausente' + (b.return_at ? ' · vuelve ~' + b.return_at : '');
    return '—';
  };
  // The server sends first names, not queue ids: the queue id comes from the barber list (same first name).
  const colaDe = (primerNombre) => {
    const hit = barberos.find((x) => (x.nombre || '').split(' ')[0] === primerNombre);
    return hit ? hit.queue_id : null;
  };
  const cambiarSilla = async (b, disponible) => {
    const cola = colaDe(b.first_name);
    if (!cola) { Alert.alert('No se pudo', 'No encuentro a este barbero en la lista.'); return; }
    setSillasBusy(cola);
    try {
      await api.post('/api/v2/sillas/' + encodeURIComponent(cola) + '/disponibilidad', { available: disponible });
      await cargar(true);
    } catch (e) {
      Alert.alert('No se guardó', e.message || 'Intenta de nuevo.');
    } finally {
      setSillasBusy(null);
    }
  };

  const renderSillas = () => (
    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); cargar(true); }}
        tintColor={COLORS.gold} colors={[COLORS.gold]} />}
      contentContainerStyle={s.content}>
      <Text style={s.secLbl}>SILLAS · AHORA</Text>
      {sillasErr && (
        <Text style={{ fontSize: 12, color: COLORS.red, marginBottom: 12 }}>
          No se pudo actualizar las sillas. Se reintenta cada 30 s.
        </Text>
      )}
      {!sillas && !sillasErr && <ActivityIndicator color={COLORS.gold} style={{ marginTop: 24 }} />}
      {sillas && (sillas.barbers || []).map((b) => {
        const ausente = b.status === 'ausente';
        const puedeAccion = ausente || b.status === 'en_turno';
        const cola = colaDe(b.first_name);
        const ocupado = sillasBusy !== null && sillasBusy === cola;
        return (
          <View key={b.first_name + '-' + b.order} style={{
            backgroundColor: COLORS.s2, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border,
            padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text numberOfLines={1} style={{ fontSize: 16, color: COLORS.text, fontWeight: '600' }}>
                {b.first_name}
              </Text>
              <Text style={{ fontSize: 13, color: b.state === 'cortando' ? COLORS.gold : COLORS.text2, marginTop: 4 }}>
                {etiquetaSilla(b)}
              </Text>
            </View>
            {puedeAccion && (
            <TouchableOpacity
              disabled={!cola || ocupado}
              onPress={() => cambiarSilla(b, ausente)}
              style={{ borderWidth: 1, borderColor: COLORS.gold, borderRadius: 10,
                paddingVertical: 8, paddingHorizontal: 12, opacity: (!cola || ocupado) ? 0.4 : 1 }}>
              {ocupado
                ? <ActivityIndicator color={COLORS.gold} />
                : <Text style={{ fontSize: 13, color: COLORS.gold, fontWeight: '600' }}>{ausente ? 'Volvió' : 'Salió'}</Text>}
            </TouchableOpacity>
            )}
          </View>
        );
      })}
    </ScrollView>
  );

  const renderResumen = () => (
    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); cargar(true); }}
        tintColor={COLORS.gold} colors={[COLORS.gold]} />}
    >
      <View style={s.content}>
        {/* Header admin */}
        <View style={s.adminBadge}>
          <Text style={s.adminBadgeTxt}>⚡ PANEL ADMINISTRADOR</Text>
        </View>

        {/* KPIs del día */}
        <Text style={s.secLbl}>HOY · {hoy()}</Text>
        <View style={s.grid2}>
          <View style={[s.statCard, s.statGold]}>
            <Text style={[s.statVal, { color: COLORS.gold }]}>
              {resumen?.hoy?.servicios || 0}
            </Text>
            <Text style={s.statLbl}>Servicios</Text>
          </View>
          <View style={[s.statCard, s.statGreen]}>
            <Text style={[s.statVal, { color: COLORS.ok }]}>
              ${fmt(resumen?.hoy?.facturado || 0)}
            </Text>
            <Text style={s.statLbl}>Facturado</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statVal}>${fmt(resumen?.hoy?.total_barberos || 0)}</Text>
            <Text style={s.statLbl}>A barberos</Text>
          </View>
        </View>

        {/* Resumen por barbero hoy */}
        <Text style={[s.secLbl, { marginTop: 24 }]}>PRODUCCIÓN HOY POR BARBERO</Text>
        {barberos.map(b => {
          const svcB  = kpisHoy[b.bid]?.svc || 0;
          const bbB   = kpisHoy[b.bid]?.bb  || 0;
          return (
            <View key={b.bid} style={[s.barberoPerfil, { marginBottom: 8 }]}>
              <View style={[s.accionAvatar, { backgroundColor: b.bg, width: 44, height: 44, borderRadius: 22 }]}>
                <Text style={[s.accionLetra, { color: b.color, fontSize: 18 }]}>{b.letra}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.barberoPNom}>{b.nombre}</Text>
                <Text style={s.barberoPSub}>{svcB} servicios · ${fmt(bbB)} ingresos</Text>
              </View>
            </View>
          );
        })}

        {/* Accesos rápidos a tabs */}
        <Text style={[s.secLbl, { marginTop: 20 }]}>ACCESO RÁPIDO</Text>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          {[
            { id: 'registrar', label: 'Registrar', icon: '➕', color: COLORS.gold },
            { id: 'barberos',  label: 'Barberos',  icon: '✂️', color: COLORS.text2 },
          ].map(item => (
            <TouchableOpacity key={item.id}
              style={{ flex: 1, minWidth: '45%', backgroundColor: COLORS.s2,
                borderRadius: 14, borderWidth: 1, borderColor: COLORS.border,
                padding: 16, alignItems: 'center', gap: 6 }}
              onPress={() => setTab(item.id)}>
              <Text style={{ fontSize: 28 }}>{item.icon}</Text>
              <Text style={{ fontSize: 12, color: item.color, fontWeight: '600',
                textAlign: 'center', letterSpacing: 0.5 }}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

      </View>
    </ScrollView>
  );

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
              <View style={{flexDirection:'row',gap:8,marginBottom:10}}>
                <View style={[s.statCard,{flex:1}]}>
                  <Text style={[s.statVal,{fontSize:20,color:COLORS.ok}]}>{k.svc}</Text>
                  <Text style={s.statLbl}>Servicios</Text>
                </View>
                <View style={[s.statCard,s.statGold,{flex:1}]}>
                  <Text style={[s.statVal,{fontSize:20,color:COLORS.gold}]}>${fmt(k.bb)}</Text>
                  <Text style={s.statLbl}>Ingresos</Text>
                </View>
                <View style={[s.statCard,{flex:1}]}>
                  <Text style={[s.statVal,{fontSize:20}]}>${fmt(tk)}</Text>
                  <Text style={s.statLbl}>Ticket prom.</Text>
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
                <Text style={{fontSize:11,color:COLORS.text3,width:28,textAlign:'right'}}>{v}</Text>
                <Text style={{fontSize:11,color:COLORS.ok,width:72,
                  textAlign:'right',fontWeight:'600'}}>${fmt(f)}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  // Restablecer PIN (TD-024 batch 2): clears the barber's PIN; he then logs in once with the master PIN and sets his own.
  const restablecerPin = (b) => {
    Alert.alert(
      'Restablecer PIN de ' + b.nombre + '?',
      'Se borra su PIN y se cierran sus sesiones. La próxima vez entra con el PIN maestro y crea su PIN nuevo. Queda registrado.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Restablecer', style: 'destructive', onPress: async () => {
          try {
            await api.post('/api/v2/staff/' + encodeURIComponent(b.bid) + '/reset-pin', {});
            Alert.alert('Listo', 'PIN de ' + b.nombre + ' restablecido.');
          } catch (e) {
            Alert.alert('No se restableció', e.message || 'Intenta de nuevo.');
          }
        } },
      ]
    );
  };

  const renderBarberos = () => (
    <ScrollView>
      <View style={s.content}>
        <Text style={s.secLbl}>PERFILES Y AVATARES</Text>
        {barberos.map(b => (
          <View key={b.bid} style={s.barberoPerfil}>
            <View style={{ position: 'relative' }}>
              <View style={[s.accionAvatar, {
                backgroundColor: b.bg, width: 56, height: 56,
                borderRadius: 28, overflow: 'hidden',
              }]}>
                {avatarImgs[b.bid]
                  ? <Image source={{ uri: avatarImgs[b.bid] }} style={{ width: 56, height: 56 }} />
                  : <Text style={[s.accionLetra, { color: b.color, fontSize: 24 }]}>{b.letra}</Text>
                }
              </View>
            </View>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={s.barberoPNom}>{b.nombre}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity style={s.btnBarberoAcc}
                  onPress={() => verPerfilBarbero(b)}>
                  <Text style={s.btnBarberoAccTxt}>📊 Producción</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btnBarberoAcc, { borderColor: 'rgba(201,168,76,.4)' }]}
                  onPress={() => cambiarAvatarAdmin(b)}>
                  <Text style={[s.btnBarberoAccTxt, { color: COLORS.gold }]}>📷 Avatar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btnBarberoAcc, { borderColor: 'rgba(224,85,85,.5)' }]}
                  onPress={() => restablecerPin(b)} accessibilityLabel={'Restablecer PIN de ' + b.nombre}>
                  <Text style={[s.btnBarberoAccTxt, { color: COLORS.red }]}>🔑 Restablecer PIN</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}

        {/* Detalle del barbero seleccionado */}
        {verBarbero && datosBarbero && (
          <View style={[s.card, { marginTop: 20 }]}>
            <View style={s.rowBetween}>
              <Text style={s.cardTitle}>
                {verBarbero.nombre.toUpperCase()} · HOY
              </Text>
              <TouchableOpacity onPress={() => { setVerBarbero(null); setDatosBarbero(null); }}>
                <Text style={{ color: COLORS.text3, fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={s.grid2}>
              <View style={s.statCard}>
                <Text style={s.statVal}>{datosBarbero.hoy?.servicios || 0}</Text>
                <Text style={s.statLbl}>Svc hoy</Text>
              </View>
              <View style={[s.statCard, s.statGreen]}>
                <Text style={[s.statVal, { color: COLORS.ok }]}>
                  ${fmt(datosBarbero.hoy?.a_cobrar || 0)}
                </Text>
                <Text style={s.statLbl}>A cobrar</Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statVal}>{datosBarbero.mes?.servicios || 0}</Text>
                <Text style={s.statLbl}>Svc mes</Text>
              </View>
              <View style={[s.statCard, s.statGold]}>
                <Text style={[s.statVal, { color: COLORS.gold }]}>
                  {fmtM(datosBarbero.mes?.a_cobrar || 0)}
                </Text>
                <Text style={s.statLbl}>Mes</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );

  const renderAgenda = () => {
    const todasCitas = barberos.flatMap(b =>
      (agendaHoy[b.bid] || []).map(a => ({ ...a, _barb: b }))
    ).sort((a, b) => (a.hora_inicio || '').localeCompare(b.hora_inicio || ''));

    const proximasCount = todasCitas.filter(a => {
      const m = minsHasta(a.hora_inicio);
      return m !== null && m >= 0 && m <= 30;
    }).length;

    return (
      <ScrollView style={s.scroll}>
        <View style={s.content}>
          {proximasCount > 0 && (
            <View style={s.agAlerta}>
              <Text style={s.agAlertaTxt}>
                🔔 {proximasCount} cita{proximasCount > 1 ? 's' : ''} en los próximos 30 min
              </Text>
            </View>
          )}
          {todasCitas.length === 0 && (
            <View style={s.empty}>
              <Text style={s.emptyTxt}>Sin citas agendadas hoy</Text>
            </View>
          )}
          {todasCitas.map(cita => {
            const b     = cita._barb;
            const m     = minsHasta(cita.hora_inicio);
            const key   = 'apt_' + cita.id;
            const isPend  = agendaPend.has(key);
            const horaStr = cita.hora_inicio?.slice(0, 5) || '—';
            const esProx  = m !== null && m >= 0 && m <= 30;
            const minsLbl = m === null ? '' : m <= 0 ? ' · ahora' : m < 60 ? ` · en ${m} min` : '';
            return (
              <View key={key} style={[s.agCard, esProx && s.agCardProx]}>
                <View style={s.agCardHead}>
                  <View style={s.agHoraBox}>
                    <Text style={s.agHoraTxt}>{horaStr}</Text>
                  </View>
                  {esProx && (
                    <View style={s.agProxBadge}>
                      <Text style={s.agProxTxt}>🔔{minsLbl}</Text>
                    </View>
                  )}
                  <View style={[s.agBarbChip, { backgroundColor: b.bg }]}>
                    <Text style={[s.agBarbTxt, { color: b.color }]}>{b.nombre}</Text>
                  </View>
                </View>
                <Text style={s.agNom}>{cita.client_name}</Text>
                <Text style={s.agSvc}>{cita.svc_nom}</Text>
                {cita.client_phone ? <Text style={s.agPhone}>📱 {cita.client_phone}</Text> : null}
                <TouchableOpacity
                  style={[s.agBtnCola, isPend && { opacity: 0.4 }]}
                  onPress={() => handlePasarAColaAdmin(cita, b)}
                  disabled={isPend}
                >
                  <Text style={s.agBtnColaTxt}>
                    {isPend ? 'Agregando…' : '↓  Cliente llegó · Pasar a cola'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Nav tabs admin */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.adminTabsOuter} contentContainerStyle={s.adminTabs}>
        {TABS_ADMIN.map(t => (
          <TouchableOpacity key={t.id} style={[s.adminTab, tab === t.id && s.adminTabOn]}
            onPress={() => setTab(t.id)}>
            <Ionicons name={t.icon} size={22} color={tab === t.id ? COLORS.gold : COLORS.text3} />
            {t.id === 'agenda' && badgeAgenda > 0 && (
              <View style={[s.badge, { backgroundColor: COLORS.gold }]}>
                <Text style={[s.badgeTxt, { color: COLORS.bg }]}>{badgeAgenda}</Text>
              </View>
            )}
            <Text numberOfLines={1} style={[s.adminTabLbl, tab === t.id && { color: COLORS.gold }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Contenido */}
      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={COLORS.gold} /></View>
      ) : (
        tab === 'resumen'    ? renderResumen()    :
        tab === 'agenda'     ? renderAgenda()     :
        tab === 'registrar'  ? renderRegistrar()  :
        tab === 'recepcion'  ? renderRecepcion()  :
        tab === 'sillas'     ? renderSillas()     :
        tab === 'tendencias' ? renderTendAdmin()  :
        renderBarberos()
      )}

    </View>
  );
}

const s = StyleSheet.create({
  content:  { padding: 18, paddingBottom: 32 },
  center:   { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty:    { alignItems: 'center', paddingVertical: 60 },
  emptyTxt: { fontSize: 16, color: COLORS.text3 },

  adminBadge: { backgroundColor: 'rgba(201,168,76,.12)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(201,168,76,.3)',
    padding: 10, alignItems: 'center', marginBottom: 20 },
  adminBadgeTxt: { fontSize: 13, color: COLORS.gold, fontFamily: 'Montserrat_700Bold', letterSpacing: 2 },

  secLbl:   { fontSize: 11, color: COLORS.text3, letterSpacing: 2.5,
    textTransform: 'uppercase', marginBottom: 12, fontFamily: 'Montserrat_500Medium' },

  grid2:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: COLORS.s2,
    borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 16 },
  statGreen:{ backgroundColor: 'rgba(77,184,122,.07)', borderColor: 'rgba(77,184,122,.2)' },
  statGold: { backgroundColor: 'rgba(201,168,76,.07)', borderColor: 'rgba(201,168,76,.2)' },
  statVal:  { fontSize: 26, color: COLORS.text, fontFamily: 'Montserrat_700Bold' },
  statLbl:  { fontSize: 11, color: COLORS.text3, marginTop: 4,
    textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'Montserrat_400Regular' },

  // Two per row: the old flex:1 row squeezed 4-5 cards into ~60px each and broke names mid-word
  accionCard: { width: '48%', flexGrow: 0, marginBottom: 8, backgroundColor: COLORS.s2, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border, padding: 14, alignItems: 'center' },
  accionAvatar: { width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  accionLetra: { fontSize: 20, fontWeight: '700' },
  accionNom:  { fontSize: 14, color: COLORS.text, fontWeight: '600', textAlign: 'center' },


  rowBetween: { flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 14 },



  barberoPerfil: { flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.s1, borderRadius: 14, borderWidth: 1,
    borderColor: COLORS.border, padding: 16, marginBottom: 10 },
  barberoPNom: { fontSize: 20, color: COLORS.text, fontWeight: '600' },
  barberoPSub: { fontSize: 12, color: COLORS.text3, marginTop: 2 },
  btnBarberoAcc: { paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: COLORS.s2, borderRadius: 10, borderWidth: 1,
    borderColor: COLORS.border },
  btnBarberoAccTxt: { fontSize: 12, color: COLORS.text2, fontWeight: '600' },

  card:     { backgroundColor: COLORS.s1, borderRadius: 14, borderWidth: 1,
    borderColor: COLORS.border, padding: 18 },
  cardTitle:{ fontSize: 11, color: COLORS.text3, letterSpacing: 2,
    textTransform: 'uppercase', marginBottom: 14, fontFamily: 'Montserrat_500Medium' },

  // flexGrow 0: a horizontal ScrollView in a column stretches by default and leaves an empty block under the tabs
  adminTabsOuter: { flexGrow: 0, backgroundColor: COLORS.s1, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  adminTabs: { flexDirection: 'row', paddingHorizontal: 4 },
  // Sized to the label, never narrower than 88: one line, no mid-word breaks
  adminTab:  { minWidth: 88, paddingHorizontal: 10, alignItems: 'center', paddingVertical: 8,
    position: 'relative' },
  adminTabOn:{ borderBottomWidth: 2, borderBottomColor: COLORS.gold },
  adminTabLbl:  { fontSize: 12, color: COLORS.text3, marginTop: 3, letterSpacing: 0,
    fontFamily: 'Montserrat_500Medium' },
  badge:    { position: 'absolute', top: 6, right: '20%',
    backgroundColor: COLORS.red, borderRadius: 10,
    minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4 },
  badgeTxt: { fontSize: 10, color: '#fff', fontWeight: '700' },

  input:     { backgroundColor: COLORS.s2, borderRadius: 10, borderWidth: 1,
    borderColor: COLORS.border2, color: COLORS.text, fontSize: 16, padding: 14 },
  scroll:    { flex: 1, backgroundColor: COLORS.bg },

  // ── Agenda tab ───────────────────────────────────────────────
  agAlerta:  { backgroundColor: 'rgba(201,168,76,.12)', borderRadius: 12, padding: 14,
    marginBottom: 16, borderWidth: 1, borderColor: COLORS.gold3 },
  agAlertaTxt: { color: COLORS.gold, fontSize: 14, fontWeight: '600' },

  agCard:    { backgroundColor: COLORS.s1, borderRadius: 14, borderWidth: 1,
    borderColor: COLORS.border, padding: 14, marginBottom: 10 },
  agCardProx:{ borderColor: COLORS.gold3, backgroundColor: 'rgba(201,168,76,.04)' },

  agCardHead:{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  agHoraBox: { width: 52, height: 34, borderRadius: 10, backgroundColor: 'rgba(85,128,212,.12)',
    alignItems: 'center', justifyContent: 'center' },
  agHoraTxt: { fontSize: 13, color: COLORS.blue, fontWeight: '700', letterSpacing: 0.3 },

  agProxBadge: { backgroundColor: 'rgba(201,168,76,.14)', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.gold3 },
  agProxTxt:   { fontSize: 10, color: COLORS.gold, fontWeight: '700', letterSpacing: 0.5 },

  agBarbChip:{ marginLeft: 'auto', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  agBarbTxt: { fontSize: 11, fontWeight: '700' },

  agNom:  { fontSize: 17, color: COLORS.text, fontWeight: '600', marginBottom: 3 },
  agSvc:  { fontSize: 13, color: COLORS.text2, marginBottom: 6 },
  agPhone:{ fontSize: 12, color: COLORS.text3, marginBottom: 10 },

  agBtnCola:    { backgroundColor: 'rgba(85,128,212,.1)', borderRadius: 12,
    paddingVertical: 13, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(85,128,212,.3)', marginTop: 2 },
  agBtnColaTxt: { fontSize: 15, color: COLORS.blue, fontWeight: '600', letterSpacing: 0.2 },
});
