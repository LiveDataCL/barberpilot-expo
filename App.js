import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, Image, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { API_URL, COLORS } from './src/constants';
import LoginScreen       from './src/screens/LoginScreen';
import HoyScreen         from './src/screens/HoyScreen';
import RegistrarScreen   from './src/screens/RegistrarScreen';
import MesScreen         from './src/screens/MesScreen';
import ProgresoScreen    from './src/screens/ProgresoScreen';
import LiquidacionScreen from './src/screens/LiquidacionScreen';
import ConfigScreen      from './src/screens/ConfigScreen';
import MensajesScreen    from './src/screens/MensajesScreen';
import AdminScreen       from './src/screens/AdminScreen';
import SocioScreen       from './src/screens/SocioScreen';
import TendenciasScreen  from './src/screens/TendenciasScreen';
import AvatarScreen      from './src/screens/AvatarScreen';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  false,
  }),
});

const TABS_BARBERO = [
  { id: 'hoy',        label: 'Hoy',        icon: '✂️' },
  { id: 'registrar',  label: 'Registrar',  icon: '➕' },
  { id: 'mes',        label: 'Mi Mes',     icon: '📊' },
  { id: 'tendencias', label: 'Tendencias', icon: '🔥' },
  { id: 'cobrar',     label: 'Cobrar',     icon: '💰' },
  { id: 'mensajes',   label: 'Notas',      icon: '💬' },
  { id: 'config',     label: 'Config',     icon: '⚙️' },
];

async function registrarPushToken(bid) {
  try {
    console.log('[PUSH] Iniciando registro para bid:', bid);

    console.log('[PUSH] Device.isDevice:', Device.isDevice);
    if (!Device.isDevice) {
      console.warn('[PUSH] No es dispositivo físico — abortando');
      return;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'BarberPilot',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#c9a84c',
        sound: 'default',
      });
      console.log('[PUSH] Canal Android creado');
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    console.log('[PUSH] Permiso existente:', existing);

    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      console.log('[PUSH] Nuevo permiso:', finalStatus);
    }

    if (finalStatus !== 'granted') {
      console.warn('[PUSH] Permiso denegado — abortando');
      return;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.manifest2?.extra?.expoClient?.extra?.eas?.projectId ??
      Constants.manifest?.extra?.eas?.projectId;

    console.log('[PUSH] projectId:', projectId);

    if (!projectId) {
      console.error('[PUSH] projectId no encontrado — abortando');
      return;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData?.data;
    console.log('[PUSH] Token obtenido:', token);

    if (!token) {
      console.error('[PUSH] Token vacío — abortando');
      return;
    }

    console.log('[PUSH] Enviando token al API para bid:', bid);
    const response = await fetch(
      'https://barberpilot-api-production.up.railway.app/push/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bid, token }),
      }
    );
    const data = await response.json();
    console.log('[PUSH] Respuesta del API:', JSON.stringify(data));

    if (data.ok) {
      console.log('[PUSH] ✅ Token registrado exitosamente');
    } else {
      console.error('[PUSH] ❌ Error del API:', data.error);
    }

  } catch (error) {
    console.error('[PUSH] Error crítico:', error.message);
    console.error('[PUSH] Stack:', error.stack);
  }
}

export default function App() {
  const [usuario, setUsuario]         = useState(null);
  const [tab, setTab]                 = useState('hoy');
  const [showAvatar, setShowAvatar]   = useState(false);
  const [avatarEmoji, setAvatarEmoji] = useState(null);
  const [avatarImage, setAvatarImage] = useState(null);

  // Registrar push token + cargar avatar cuando un barbero/admin hace login
  useEffect(() => {
    if (!usuario?.bid) return;
    if (usuario.rol === 'barbero' || usuario.rol === 'admin') registrarPushToken(usuario.bid);
    // Cargar avatar guardado
    SecureStore.getItemAsync(`bp_avatar_img_${usuario.bid}`)
      .then(uri => { if (uri) setAvatarImage(uri); })
      .catch(() => {});
    SecureStore.getItemAsync(`bp_avatar_${usuario.bid}`)
      .then(em => { if (em && !avatarImage) setAvatarEmoji(em); })
      .catch(() => {});
  }, [usuario]);

  const logout = () => { setUsuario(null); setTab('hoy'); };

  if (!usuario) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="light" />
        <LoginScreen onLogin={setUsuario} />
      </GestureHandlerRootView>
    );
  }

  // ADMIN
  if (usuario.rol === 'admin') {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="light" />
        <SafeAreaProvider>
          <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
              <View style={[s.avatarSm, { backgroundColor: usuario.bg }]}>
                <Text style={[s.avatarLetra, { color: usuario.color, fontSize: 16 }]}>⚡</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.hdrName}>Administrador</Text>
                <Text style={s.hdrSub}>SALON MEN SF · ACCESO TOTAL</Text>
              </View>
              <TouchableOpacity style={s.logoutBtn} onPress={logout}>
                <Text style={s.logoutTxt}>⇄</Text>
              </TouchableOpacity>
            </View>
            <AdminScreen onLogout={logout} />
          </SafeAreaView>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  // SOCIO
  if (usuario.rol === 'socio') {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="light" />
        <SafeAreaProvider>
          <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
              <View style={[s.avatarSm, { backgroundColor: usuario.bg }]}>
                <Text style={[s.avatarLetra, { color: usuario.color, fontSize: 16 }]}>👁</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.hdrName}>{usuario.nombre}</Text>
                <Text style={s.hdrSub}>SALON MEN SF · SOLO VISUALIZACIÓN</Text>
              </View>
              <TouchableOpacity style={s.logoutBtn} onPress={logout}>
                <Text style={s.logoutTxt}>⇄</Text>
              </TouchableOpacity>
            </View>
            <SocioScreen />
          </SafeAreaView>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  // BARBERO
  const renderScreen = () => {
    switch (tab) {
      case 'hoy':        return <HoyScreen        barbero={usuario} />;
      case 'registrar':  return <RegistrarScreen   barbero={usuario} />;
      case 'mes':        return <MesScreen         barbero={usuario} />;
      case 'tendencias': return <TendenciasScreen  barbero={usuario} />;
      case 'cobrar':     return <LiquidacionScreen barbero={usuario} />;
      case 'mensajes':   return <MensajesScreen    barbero={usuario} />;
      case 'config':     return <ConfigScreen      barbero={usuario} onLogout={logout} />;
      default:           return <HoyScreen         barbero={usuario} />;
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <SafeAreaProvider>
        <SafeAreaView style={s.safe} edges={['top']}>
          <View style={s.header}>
            <TouchableOpacity onPress={() => setShowAvatar(true)}>
              <View style={[s.avatarSm, { backgroundColor: usuario.bg }]}>
                {avatarImage
                  ? <Image source={{ uri: avatarImage }} style={s.avatarImg} />
                  : <Text style={[s.avatarLetra, { color: usuario.color }]}>
                      {avatarEmoji || usuario.letra}
                    </Text>
                }
              </View>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={s.hdrName}>{usuario.nombre}</Text>
              <Text style={s.hdrSub}>SALON MEN SF</Text>
            </View>
            <TouchableOpacity style={s.logoutBtn} onPress={logout}>
              <Text style={s.logoutTxt}>⇄</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }}>{renderScreen()}</View>

          {/* Modal Avatar */}
          {showAvatar && (
            <View style={StyleSheet.absoluteFillObject}>
              <AvatarScreen barbero={{...usuario, letra: avatarEmoji || usuario.letra}}
                onClose={(result) => {
                  if (result?.type === 'image') {
                    setAvatarImage(result.uri);
                    setAvatarEmoji(null);
                  } else if (result?.type === 'emoji') {
                    setAvatarEmoji(result.emoji);
                    setAvatarImage(null);
                  }
                  setShowAvatar(false);
                }} />
            </View>
          )}

          <SafeAreaView edges={['bottom']} style={s.nav}>
            {TABS_BARBERO.map(t => (
              <TouchableOpacity key={t.id} style={s.navBtn}
                onPress={() => setTab(t.id)} activeOpacity={0.7}>
                <Text style={s.navIcon}>{t.icon}</Text>
                <Text style={[s.navLabel, tab === t.id && { color: usuario.color }]}>
                  {t.label}
                </Text>
                {tab === t.id && (
                  <View style={[s.navDot, { backgroundColor: usuario.color }]} />
                )}
              </TouchableOpacity>
            ))}
          </SafeAreaView>
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: COLORS.bg },
  header:   { flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0f0d08', borderBottomWidth: 1,
    borderBottomColor: COLORS.border2, paddingHorizontal: 18, paddingVertical: 14 },
  avatarSm:  { width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg:  { width: 40, height: 40, borderRadius: 20 },
  avatarLetra:{ fontSize: 18, fontWeight: '700' },
  hdrName:  { fontSize: 20, color: COLORS.text, fontWeight: '500', letterSpacing: 0.5 },
  hdrSub:   { fontSize: 10, color: COLORS.gold, letterSpacing: 2.5,
    textTransform: 'uppercase', marginTop: 1 },
  logoutBtn:{ padding: 8 },
  logoutTxt:{ fontSize: 22, color: COLORS.text3 },
  nav:      { backgroundColor: COLORS.s1, borderTopWidth: 1,
    borderTopColor: COLORS.border, flexDirection: 'row' },
  navBtn:   { flex: 1, alignItems: 'center', paddingTop: 8, paddingBottom: 4,
    position: 'relative' },
  navIcon:  { fontSize: 20 },
  navLabel: { fontSize: 9, color: COLORS.text3, marginTop: 3,
    letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: '500' },
  navDot:   { position: 'absolute', bottom: 0, width: 16, height: 3,
    borderTopLeftRadius: 2, borderTopRightRadius: 2 },
});
