import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Alert,
  Modal, Dimensions, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { COLORS, fmt, fmtM, hoy, mesPeriodo, BARBEROS, SERVICIOS } from '../constants';
import { api } from '../services/api';

const API_URL = 'https://barberpilot-api-production.up.railway.app';
const { width } = Dimensions.get('window');

const TABS_ADMIN = [
  { id: 'resumen',    label: 'Resumen',   icon: '📊' },
  { id: 'registrar',  label: 'Registrar', icon: '➕' },
  { id: 'aprobar',    label: 'Aprobar',   icon: '✅' },
  { id: 'tendencias', label: 'Análisis',  icon: '🔥' },
  { id: 'mensajes',   label: 'Mensajes',  icon: '💬' },
  { id: 'barberos',   label: 'Perfiles',  icon: '👤' },
];

export default function AdminScreen({ onLogout }) {
  const [tab, setTab]             = useState('resumen');
  const [resumen, setResumen]     = useState(null);
  const [pendientes, setPendientes] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [badgeAprob, setBadgeAprob] = useState(0);

  // ── Mensajes ────────────────────────────────────────────────
  const [msgBid, setMsgBid]       = useState(null);
  const [msgTexto, setMsgTexto]   = useState('');
  const [enviando, setEnviando]   = useState(false);
  const [modalMsg, setModalMsg]   = useState(false);
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

  const cargarTendencias = async () => {
    try {
      const API_URL2 = 'https://barberpilot-api-production.up.railway.app';
      const desde = mesPeriodo() + '-01';
      const hasta = hoy();
      const dias = [];
      let cur = new Date(desde + 'T12:00:00');
      const fin = new Date(hasta + 'T12:00:00');
      while (cur <= fin) { dias.push(cur.toISOString().slice(0,10)); cur.setDate(cur.getDate()+1); }
      const results = await Promise.all(
        dias.map(f => fetch(`${API_URL2}/registros/dia?fecha=${f}`)
          .then(r => r.json()).catch(() => ({ok:false,registros:[]})))
      );
      let allRegs = [];
      results.forEach(r => { if (r.ok && r.registros) allRegs = allRegs.concat(r.registros); });

      // KPIs por barbero
      const kpisBarbero = {};
      BARBEROS.forEach(b => { kpisBarbero[b.bid] = { svc:0, fact:0, bb:0, servicios:{} }; });
      const porHora = {}; const porDia = {};
      for (let h=10;h<=19;h++) porHora[h]={svc:0,fact:0};
      for (let d=0;d<=6;d++)   porDia[d]={svc:0,fact:0};

      allRegs.forEach(r => {
        if (kpisBarbero[r.bid]) {
          kpisBarbero[r.bid].svc++;
          kpisBarbero[r.bid].fact += r.precio||0;
          kpisBarbero[r.bid].bb   += (r.bb||0)+(r.propina||0);
          kpisBarbero[r.bid].servicios[r.snom] = (kpisBarbero[r.bid].servicios[r.snom]||0)+1;
        }
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
      const [resRes, pendRes] = await Promise.all([
        fetch(`${API_URL}/admin/resumen`).then(r => r.json()),
        fetch(`${API_URL}/pendientes`).then(r => r.json()),
      ]);
      if (resRes.ok)  setResumen(resRes);
      if (pendRes.ok) {
        setPendientes(pendRes.pendientes || []);
        setBadgeAprob(pendRes.total || 0);
      }
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    cargar();
    const interval = setInterval(() => cargar(true), 30000);
    return () => clearInterval(interval);
  }, []);

  const aprobar = async (id) => {
    try {
      await fetch(`${API_URL}/registros/${id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'confirmado' }),
      });
      cargar(true);
    } catch {}
  };

  const rechazar = async (id) => {
    Alert.alert('Rechazar servicio', '¿Confirmas el rechazo?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Rechazar', style: 'destructive', onPress: async () => {
        await fetch(`${API_URL}/registros/${id}/estado`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado: 'rechazado' }),
        });
        cargar(true);
      }},
    ]);
  };

  const aprobarTodos = () => {
    Alert.alert('Aprobar todos', `¿Aprobar los ${pendientes.length} servicios pendientes?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Aprobar todos', onPress: async () => {
        await Promise.all(pendientes.map(p =>
          fetch(`${API_URL}/registros/${p.id}/estado`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado: 'confirmado' }),
          })
        ));
        cargar(true);
      }},
    ]);
  };

  const enviarMensaje = async () => {
    if (!msgTexto.trim() || !msgBid) return;
    setEnviando(true);
    try {
      const b = BARBEROS.find(x => x.bid === msgBid);
      await fetch(`${API_URL}/mensajes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bid_destino: msgBid,
          bnom_destino: b?.nombre || msgBid,
          contenido: msgTexto.trim(),
          bid_origen: 'admin',
        }),
      });
      setMsgTexto('');
      setModalMsg(false);
      Alert.alert('✓ Enviado', `Mensaje enviado a ${b?.nombre}`);
    } catch { Alert.alert('Error', 'No se pudo enviar'); }
    setEnviando(false);
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
      for (const b of BARBEROS) {
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
    const b = BARBEROS.find(x => x.bid === regBid);
    const com = regPago === 'debito' ? 0.43 : 0.5;
    const bb  = Math.round(precio * com);
    const ts  = Date.now();
    const now = new Date();
    const hora = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
    const reg = {
      id: 'TK'+ts, bid: regBid, bnom: b?.nombre||regBid,
      sid: svc.id,
      snom: svc.id==='custom' ? regCustomNom.trim()||'Servicio especial' : svc.nom,
      precio, pago: regPago, com, bb, neg: precio-bb,
      propina: parseInt(regPropina)||0,
      fecha: hoy(), hora, ts,
    };
    setRegEnviando(true);
    try {
      // Admin registra directo como confirmado
      const res = await fetch(`${API_URL}/registros`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(reg),
      }).then(r => r.json());
      if (res.ok) {
        setRegExito(true);
        setRegPropina(''); setRegCustomNom(''); setRegCustomPrecio('');
        await sendPushToBarber(regBid, '✂️ Nuevo servicio', svc.id==='custom' ? regCustomNom : svc.nom);
        setTimeout(() => setRegExito(false), 2500);
        cargar(true);
      }
    } catch { Alert.alert('Error al registrar'); }
    setRegEnviando(false);
  };

  const sendPushToBarber = async (bid, title, body) => {
    try {
      await fetch(`${API_URL}/push/test`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({bid}),
      });
    } catch {}
  };

  const renderRegistrar = () => {
    const svc    = SERVICIOS.find(s => s.id === regSid) || SERVICIOS[0];
    const precio = svc.id === 'custom' ? (parseInt(regCustomPrecio) || 0) : svc.precio;
    const com    = regPago === 'debito' ? 0.43 : 0.5;
    const bb     = Math.round(precio * com) + (parseInt(regPropina) || 0);
    const PAGOS  = [
      { id: 'efectivo',      label: 'Efectivo',   color: COLORS.ok   },
      { id: 'debito',        label: 'Debito',      color: COLORS.blue },
      { id: 'transferencia', label: 'Transf.',     color: COLORS.gold },
    ];
    if (regExito) {
      return (
        <View style={s.center}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>OK</Text>
          <Text style={{ fontSize: 20, color: COLORS.ok, fontWeight: '600' }}>Registrado</Text>
          <Text style={{ fontSize: 14, color: COLORS.text3, marginTop: 6 }}>
            Asignado a {BARBEROS.find(b => b.bid === regBid) ? BARBEROS.find(b => b.bid === regBid).nombre : regBid}
          </Text>
        </View>
      );
    }
    return (
      <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg }}
        contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

        <Text style={s.secLbl}>ASIGNAR A BARBERO</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
          {BARBEROS.map(function(b) {
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
            {'RECIBE ' + (BARBEROS.find(function(b) { return b.bid === regBid; }) || {}).nombre}
          </Text>
          <Text style={{ fontSize: 40, color: COLORS.ok, fontWeight: '500' }}>{'$' + fmt(bb)}</Text>
          <Text style={{ fontSize: 13, color: COLORS.text3, marginTop: 4 }}>
            {Math.round(com * 100) + '% sobre $' + fmt(precio)}
          </Text>
        </View>

        <TouchableOpacity
          style={{ backgroundColor: COLORS.gold, borderRadius: 14, padding: 18, alignItems: 'center' }}
          onPress={registrarServicioAdmin} disabled={regEnviando}>
          {regEnviando
            ? <ActivityIndicator color={COLORS.bg} />
            : <Text style={{ fontSize: 17, color: COLORS.bg, fontWeight: '700' }}>Registrar servicio</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    );
  };


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
            <Text style={[s.statVal, { color: COLORS.red }]}>
              {badgeAprob}
            </Text>
            <Text style={s.statLbl}>Pendientes</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statVal}>${fmt(resumen?.hoy?.total_barberos || 0)}</Text>
            <Text style={s.statLbl}>A barberos</Text>
          </View>
        </View>

        {/* Accesos rápidos */}
        <Text style={[s.secLbl, { marginTop: 20 }]}>ACCIONES RÁPIDAS</Text>
        <View style={s.accionGrid}>
          {BARBEROS.map(b => (
            <TouchableOpacity key={b.bid} style={s.accionCard}
              onPress={() => { setMsgBid(b.bid); setModalMsg(true); }}>
              <View style={[s.accionAvatar, { backgroundColor: b.bg }]}>
                <Text style={[s.accionLetra, { color: b.color }]}>{b.letra}</Text>
              </View>
              <Text style={s.accionNom}>{b.nombre}</Text>
              <Text style={s.accionSub}>Enviar nota</Text>
              <Text style={{ fontSize: 18, marginTop: 4 }}>📋</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Pendientes urgentes */}
        {badgeAprob > 0 && (
          <TouchableOpacity style={s.urgente} onPress={() => setTab('aprobar')}>
            <Text style={s.urgenteTxt}>
              ⚠️ {badgeAprob} servicio{badgeAprob !== 1 ? 's' : ''} esperando aprobación
            </Text>
            <Text style={s.urgenteLink}>Ver ahora →</Text>
          </TouchableOpacity>
        )}

        {/* Resumen por barbero hoy */}
        <Text style={[s.secLbl, { marginTop: 24 }]}>PRODUCCIÓN HOY POR BARBERO</Text>
        {BARBEROS.map(b => {
          const regsB = (resumen?.registros_hoy || []).filter(r => r.bid === b.bid);
          const svcB  = resumen?.barberos_hoy?.[b.bid]?.svc || 0;
          const bbB   = resumen?.barberos_hoy?.[b.bid]?.bb  || 0;
          return (
            <View key={b.bid} style={[s.barberoPerfil, { marginBottom: 8 }]}>
              <View style={[s.accionAvatar, { backgroundColor: b.bg, width: 44, height: 44, borderRadius: 22 }]}>
                <Text style={[s.accionLetra, { color: b.color, fontSize: 18 }]}>{b.letra}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.barberoPNom}>{b.nombre}</Text>
                <Text style={s.barberoPSub}>{svcB} servicios · ${fmt(bbB)} ingresos</Text>
              </View>
              <TouchableOpacity
                style={{ backgroundColor: 'rgba(201,168,76,.12)', borderRadius: 8,
                  paddingHorizontal: 12, paddingVertical: 8 }}
                onPress={() => { setMsgBid(b.bid); setModalMsg(true); }}>
                <Text style={{ fontSize: 16 }}>📋</Text>
              </TouchableOpacity>
            </View>
          );
        })}

        {/* Accesos rápidos a tabs */}
        <Text style={[s.secLbl, { marginTop: 20 }]}>ACCESO RÁPIDO</Text>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          {[
            { id: 'registrar', label: 'Registrar', icon: '➕', color: COLORS.gold },
            { id: 'aprobar',   label: 'Aprobar',   icon: '✅', color: COLORS.ok },
            { id: 'mensajes',  label: 'Mensajes',  icon: '💬', color: COLORS.blue },
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

  const renderAprobar = () => (
    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); cargar(true); }}
        tintColor={COLORS.gold} colors={[COLORS.gold]} />}
    >
      <View style={s.content}>
        {pendientes.length === 0 ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>✅</Text>
            <Text style={s.emptyTxt}>Todo al día — sin pendientes</Text>
          </View>
        ) : (
          <>
            <View style={s.rowBetween}>
              <Text style={s.secLbl}>{pendientes.length} PENDIENTE{pendientes.length !== 1 ? 'S' : ''}</Text>
              <TouchableOpacity style={s.btnAprobarTodos} onPress={aprobarTodos}>
                <Text style={s.btnAprobarTodosTxt}>✓ Aprobar todos</Text>
              </TouchableOpacity>
            </View>
            {pendientes.map(r => {
              const bb = parseInt(r.bb || 0) + parseInt(r.propina || 0);
              const pagoColor = r.pago === 'efectivo' ? COLORS.ok
                : r.pago === 'debito' ? COLORS.blue : COLORS.gold;
              return (
                <View key={r.id} style={s.pendCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.pendNom}>{r.snom}</Text>
                    <Text style={s.pendSub}>
                      {r.bnom} · {r.hora?.slice(0,5)} ·{' '}
                      <Text style={{ color: pagoColor }}>{r.pago}</Text>
                    </Text>
                    <Text style={s.pendPrecio}>${fmt(r.precio)}</Text>
                  </View>
                  <View style={s.pendMonto}>
                    <Text style={s.pendBB}>${fmt(bb)}</Text>
                    <Text style={s.pendBBLbl}>barbero</Text>
                  </View>
                  <View style={s.pendBtns}>
                    <TouchableOpacity style={s.btnOk} onPress={() => aprobar(r.id)}>
                      <Text style={s.btnOkTxt}>✓</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.btnNo} onPress={() => rechazar(r.id)}>
                      <Text style={s.btnNoTxt}>✗</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </View>
    </ScrollView>
  );

  const renderMensajes = () => (
    <ScrollView>
      <View style={s.content}>
        <Text style={s.secLbl}>ENVIAR NOTA A BARBERO</Text>
        <Text style={{ fontSize: 13, color: COLORS.text3, marginBottom: 16 }}>
          El mensaje llega como notificación push y queda en el historial de la app.
        </Text>
        {BARBEROS.map(b => (
          <TouchableOpacity key={b.bid} style={s.msgBarberoBtn}
            onPress={() => { setMsgBid(b.bid); setModalMsg(true); }}>
            <View style={[s.accionAvatar, { backgroundColor: b.bg, width: 44, height: 44, borderRadius: 22 }]}>
              <Text style={[s.accionLetra, { color: b.color, fontSize: 18 }]}>{b.letra}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={s.msgBarberoNom}>{b.nombre}</Text>
              <Text style={s.msgBarberoPush}>Toca para enviar una nota</Text>
            </View>
            <Text style={{ fontSize: 22, color: COLORS.gold }}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  const renderTendAdmin = () => {
    if (!tendData) {
      cargarTendencias();
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
        {BARBEROS.map(b => {
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

  const renderBarberos = () => (
    <ScrollView>
      <View style={s.content}>
        <Text style={s.secLbl}>PERFILES Y AVATARES</Text>
        {BARBEROS.map(b => (
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
            <TouchableOpacity style={[s.btnAprobarTodos, { marginTop: 14 }]}
              onPress={() => { setMsgBid(verBarbero.bid); setModalMsg(true); }}>
              <Text style={s.btnAprobarTodosTxt}>📋 Enviar nota a {verBarbero.nombre}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );

  // ── MODAL MENSAJE ────────────────────────────────────────────
  const b = BARBEROS.find(x => x.bid === msgBid);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Nav tabs admin */}
      <View style={s.adminTabs}>
        {TABS_ADMIN.map(t => (
          <TouchableOpacity key={t.id} style={[s.adminTab, tab === t.id && s.adminTabOn]}
            onPress={() => setTab(t.id)}>
            <Text style={s.adminTabIcon}>{t.icon}</Text>
            {t.id === 'aprobar' && badgeAprob > 0 && (
              <View style={s.badge}>
                <Text style={s.badgeTxt}>{badgeAprob}</Text>
              </View>
            )}
            <Text style={[s.adminTabLbl, tab === t.id && { color: COLORS.gold }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Contenido */}
      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={COLORS.gold} /></View>
      ) : (
        tab === 'resumen'    ? renderResumen()    :
        tab === 'registrar'  ? renderRegistrar()  :
        tab === 'aprobar'    ? renderAprobar()    :
        tab === 'tendencias' ? renderTendAdmin()  :
        tab === 'mensajes'   ? renderMensajes()   :
        renderBarberos()
      )}

      {/* Modal enviar mensaje */}
      <Modal visible={modalMsg} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>
              Nota para {b?.nombre}
            </Text>
            <TextInput
              style={s.msgInput}
              value={msgTexto}
              onChangeText={setMsgTexto}
              placeholder="Escribe la nota aquí..."
              placeholderTextColor={COLORS.text3}
              multiline
              numberOfLines={4}
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: COLORS.s2, flex: 1 }]}
                onPress={() => { setModalMsg(false); setMsgTexto(''); }}>
                <Text style={{ color: COLORS.text2, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: COLORS.gold, flex: 2 }]}
                onPress={enviarMensaje} disabled={enviando}>
                {enviando
                  ? <ActivityIndicator color={COLORS.bg} />
                  : <Text style={{ color: COLORS.bg, fontWeight: '700', fontSize: 15 }}>
                      📤 Enviar
                    </Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  adminBadgeTxt: { fontSize: 13, color: COLORS.gold, fontWeight: '700', letterSpacing: 2 },

  secLbl:   { fontSize: 11, color: COLORS.text3, letterSpacing: 2.5,
    textTransform: 'uppercase', marginBottom: 12 },

  grid2:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: COLORS.s2,
    borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 16 },
  statGreen:{ backgroundColor: 'rgba(77,184,122,.07)', borderColor: 'rgba(77,184,122,.2)' },
  statGold: { backgroundColor: 'rgba(201,168,76,.07)', borderColor: 'rgba(201,168,76,.2)' },
  statVal:  { fontSize: 26, color: COLORS.text, fontWeight: '600' },
  statLbl:  { fontSize: 11, color: COLORS.text3, marginTop: 4,
    textTransform: 'uppercase', letterSpacing: 1 },

  accionGrid: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  accionCard: { flex: 1, backgroundColor: COLORS.s2, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border, padding: 14, alignItems: 'center' },
  accionAvatar: { width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  accionLetra: { fontSize: 20, fontWeight: '700' },
  accionNom:  { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  accionSub:  { fontSize: 11, color: COLORS.text3, marginTop: 2 },

  urgente:  { backgroundColor: 'rgba(224,85,85,.1)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(224,85,85,.3)',
    padding: 16, marginTop: 8, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center' },
  urgenteTxt: { fontSize: 14, color: '#e05555', flex: 1 },
  urgenteLink:{ fontSize: 14, color: COLORS.gold, fontWeight: '700' },

  rowBetween: { flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 14 },
  btnAprobarTodos: { backgroundColor: 'rgba(77,184,122,.15)',
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(77,184,122,.3)',
    paddingHorizontal: 14, paddingVertical: 9 },
  btnAprobarTodosTxt: { fontSize: 13, color: COLORS.ok, fontWeight: '700' },

  pendCard: { flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.s1, borderRadius: 14, borderWidth: 1,
    borderColor: COLORS.border, padding: 14, marginBottom: 10, gap: 10 },
  pendNom:  { fontSize: 15, color: COLORS.text, fontWeight: '600' },
  pendSub:  { fontSize: 12, color: COLORS.text3, marginTop: 2 },
  pendPrecio: { fontSize: 13, color: COLORS.text2, marginTop: 4 },
  pendMonto:{ alignItems: 'center', minWidth: 60 },
  pendBB:   { fontSize: 16, color: COLORS.ok, fontWeight: '600' },
  pendBBLbl:{ fontSize: 10, color: COLORS.text3, textTransform: 'uppercase' },
  pendBtns: { gap: 6 },
  btnOk:    { backgroundColor: 'rgba(77,184,122,.15)', borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(77,184,122,.3)',
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  btnOkTxt: { fontSize: 18, color: COLORS.ok, fontWeight: '700' },
  btnNo:    { backgroundColor: 'rgba(224,85,85,.1)', borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(224,85,85,.25)',
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  btnNoTxt: { fontSize: 18, color: COLORS.red, fontWeight: '700' },

  msgBarberoBtn: { flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.s1, borderRadius: 14, borderWidth: 1,
    borderColor: COLORS.border, padding: 16, marginBottom: 10 },
  msgBarberoNom: { fontSize: 18, color: COLORS.text, fontWeight: '600' },
  msgBarberoPush:{ fontSize: 12, color: COLORS.text3, marginTop: 2 },

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
    textTransform: 'uppercase', marginBottom: 14 },

  adminTabs: { flexDirection: 'row', backgroundColor: COLORS.s1,
    borderBottomWidth: 1, borderBottomColor: COLORS.border },
  adminTab:  { flex: 1, alignItems: 'center', paddingVertical: 10,
    position: 'relative' },
  adminTabOn:{ borderBottomWidth: 2, borderBottomColor: COLORS.gold },
  adminTabIcon: { fontSize: 20 },
  adminTabLbl:  { fontSize: 10, color: COLORS.text3, marginTop: 3,
    textTransform: 'uppercase', letterSpacing: 0.5 },
  badge:    { position: 'absolute', top: 6, right: '20%',
    backgroundColor: COLORS.red, borderRadius: 10,
    minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4 },
  badgeTxt: { fontSize: 10, color: '#fff', fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,.7)',
    justifyContent: 'flex-end' },
  modalBox:  { backgroundColor: COLORS.s1, borderTopLeftRadius: 20,
    borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle:{ fontSize: 18, color: COLORS.text, fontWeight: '600',
    marginBottom: 16, letterSpacing: 0.5 },
  msgInput:  { backgroundColor: COLORS.s2, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.border2, color: COLORS.text,
    fontSize: 16, padding: 14, minHeight: 100, textAlignVertical: 'top' },
  modalBtn:  { padding: 14, borderRadius: 12, alignItems: 'center' },
  input:     { backgroundColor: COLORS.s2, borderRadius: 10, borderWidth: 1,
    borderColor: COLORS.border2, color: COLORS.text, fontSize: 16, padding: 14 },
  scroll:    { flex: 1, backgroundColor: COLORS.bg },
});
