import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, Image, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Feather } from '@expo/vector-icons';
import { useFonts,
  CormorantGaramond_600SemiBold,
} from '@expo-google-fonts/cormorant-garamond';
import { useFonts as useFontsMontserrat,
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_700Bold,
} from '@expo-google-fonts/montserrat';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { API_URL, IS_STAGING, COLORS, BARBEROS_FALLBACK } from './src/constants';
import LoginScreen       from './src/screens/LoginScreen';
import SetupPinScreen    from './src/screens/SetupPinScreen';
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
import ColaScreen        from './src/screens/ColaScreen';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  false,
  }),
});

const TABS_BARBERO = [
  { id: 'hoy',        label: 'Hoy',       icon: 'scissors'    },
  { id: 'cola',       label: 'Cola',      icon: 'users'       },
  { id: 'registrar',  label: 'Nuevo',     icon: 'plus-circle' },
  { id: 'mes',        label: 'Mi Mes',    icon: 'bar-chart-2' },
  { id: 'tendencias', label: 'Tendenc.',  icon: 'trending-up' },
  { id: 'cobrar',     label: 'Cobrar',    icon: 'dollar-sign' },
  { id: 'mensajes',   label: 'Notas',     icon: 'message-square' },
  { id: 'config',     label: 'Config',    icon: 'settings'    },
];

async function registrarPushToken(bid) {
  const log = ['bid: ' + bid, 'OS: ' + Platform.OS, 'isDevice: ' + Device.isDevice];
  try {
    if (Platform.OS === 'web') {
      console.log('[PUSH]', log.join(' | ') + ' → ABORT: web');
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
      log.push('canal: ok');
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    log.push('perm existente: ' + existing);

    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      log.push('nuevo perm: ' + finalStatus);
    }

    if (finalStatus !== 'granted') {
      console.log('[PUSH]', log.join(' | ') + ' → ABORT: permiso denegado');
      return;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.manifest2?.extra?.expoClient?.extra?.eas?.projectId ??
      Constants.manifest?.extra?.eas?.projectId;

    log.push('projectId: ' + (projectId ? projectId.slice(0, 8) + '...' : 'NONE'));

    if (!projectId) {
      console.log('[PUSH]', log.join(' | ') + ' → ABORT: sin projectId');
      return;
    }

    log.push('obteniendo token...');
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData?.data;
    log.push('token: ' + (token ? token.slice(0, 25) + '...' : 'VACÍO'));

    if (!token) {
      console.log('[PUSH]', log.join(' | ') + ' → ABORT: token vacío');
      return;
    }

    log.push('enviando al API...');
    const response = await fetch(
      API_URL + '/push/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bid, token }),
      }
    );
    const data = await response.json();
    log.push('api: ' + JSON.stringify(data));

    console.log(data.ok ? '[PUSH ✅]' : '[PUSH ❌]', log.join(' | '));

  } catch (error) {
    console.error('[PUSH ERROR]', log.join(' | '), 'ERROR:', error.message);
  }
}

export default function App() {
  const [usuario,      setUsuario]      = useState(null);
  const [setupPin,     setSetupPin]     = useState(null); // { perfil, loginPin } when pin_set=false
  const [authReady,    setAuthReady]    = useState(false);
  const [tab,          setTab]          = useState('hoy');
  const [showAvatar,   setShowAvatar]   = useState(false);
  const [avatarEmoji,  setAvatarEmoji]  = useState(null);
  const [avatarImage,  setAvatarImage]  = useState(null);

  const [fontsLoaded] = useFonts({
    CormorantGaramond_600SemiBold,
  });
  const [montserratFontsLoaded] = useFontsMontserrat({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_700Bold,
  });

  // 3E — JWT session restore on mount
  useEffect(() => {
    (async () => {
      try {
        const token = await SecureStore.getItemAsync('bp_auth_token');
        if (token) {
          const res  = await fetch(`${API_URL}/api/v2/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          const json = await res.json();
          if (res.ok && json.ok) {
            const perfil = BARBEROS_FALLBACK.find(b => b.bid === json.bid) || {
              bid: json.bid, nombre: json.bnom, rol: json.role,
              color: COLORS.gold, letra: json.bnom?.[0] || '?',
              bg: 'rgba(201,168,76,.18)',
            };
            if (!json.pin_set) {
              setSetupPin({ perfil, loginPin: null });
            } else {
              setUsuario(perfil);
            }
          } else {
            await SecureStore.deleteItemAsync('bp_auth_token');
          }
        }
      } catch { /* network error — stay on LoginScreen */ }
      setAuthReady(true);
    })();
  }, []);

  // Navegar a Agenda cuando el barbero toca la notificación de nueva cita
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data?.screen === 'Agenda') setTab('cola');
    });
    return () => sub.remove();
  }, []);

  // Registrar push token + cargar avatar cuando un barbero/admin hace login
  useEffect(() => {
    if (!usuario?.bid) return;
    if (usuario.rol === 'barbero' || usuario.rol === 'admin') registrarPushToken(usuario.bid);
    // Cargar avatar del servidor; fallback a SecureStore si sin red
    fetch(API_URL + '/barbero/' + usuario.bid + '/avatar')
      .then(r => r.json())
      .then(json => {
        if (json.ok && json.imagen) {
          setAvatarImage('data:' + (json.mime_type || 'image/jpeg') + ';base64,' + json.imagen);
          setAvatarEmoji(null);
        } else {
          SecureStore.getItemAsync(`bp_avatar_${usuario.bid}`)
            .then(em => { if (em) setAvatarEmoji(em); })
            .catch(() => {});
        }
      })
      .catch(() => {
        SecureStore.getItemAsync(`bp_avatar_${usuario.bid}`)
          .then(em => { if (em) setAvatarEmoji(em); })
          .catch(() => {});
      });
  }, [usuario]);

  // Called by LoginScreen after successful /api/v2/auth/login
  const handleLogin = ({ perfil, requireSetupPin, loginPin }) => {
    if (requireSetupPin) {
      setSetupPin({ perfil, loginPin });
    } else {
      setUsuario(perfil);
    }
  };

  const logout = async () => {
    try {
      await SecureStore.deleteItemAsync('bp_auth_token');
    } catch {}
    setUsuario(null);
    setSetupPin(null);
    setTab('hoy');
    setAvatarImage(null);
    setAvatarEmoji(null);
  };

  if (!fontsLoaded || !montserratFontsLoaded || !authReady) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={COLORS.gold} size="small" />
      </View>
    );
  }

  // 3G — SetupPin screen (pin_set=false after login or session restore)
  if (setupPin) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="light" />
        <SetupPinScreen
          perfil={setupPin.perfil}
          loginPin={setupPin.loginPin}
          onDone={() => { setUsuario(setupPin.perfil); setSetupPin(null); }}
        />
      </GestureHandlerRootView>
    );
  }

  if (!usuario) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="light" />
        <LoginScreen onLogin={handleLogin} />
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
      case 'cola':       return <ColaScreen        barbero={usuario} />;
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
          {IS_STAGING && (
            <View style={s.stagingBanner}>
              <Text style={s.stagingBannerTxt}>STAGING — datos sinteticos</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>{renderScreen()}</View>

          {/* Modal Avatar */}
          {showAvatar && (
            <View style={StyleSheet.absoluteFillObject}>
              <AvatarScreen
                barbero={{...usuario, letra: avatarEmoji || usuario.letra}}
                avatarImage={avatarImage}
                onClose={(result) => {
                  if (result?.type === 'emoji') setAvatarEmoji(result.emoji);
                  setShowAvatar(false);
                }} />
            </View>
          )}

          <SafeAreaView edges={['bottom']} style={s.nav}>
            {TABS_BARBERO.map(t => {
              const active = tab === t.id;
              const color = active ? usuario.color : COLORS.text3;
              return (
                <TouchableOpacity key={t.id} style={s.navBtn}
                  onPress={() => setTab(t.id)} activeOpacity={0.7}>
                  {active && <View style={[s.navBar, { backgroundColor: usuario.color }]} />}
                  <Feather name={t.icon} size={20} color={color} />
                  <Text style={[s.navLabel, active && { color: usuario.color }]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </SafeAreaView>
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: COLORS.bg },
  header:   { flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0c0a06', borderBottomWidth: 1,
    borderBottomColor: 'rgba(201,168,76,.15)', paddingHorizontal: 18, paddingVertical: 12 },
  avatarSm:  { width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(201,168,76,.3)' },
  avatarImg:  { width: 38, height: 38, borderRadius: 19 },
  avatarLetra:{ fontSize: 16, fontFamily: 'Montserrat_700Bold' },
  hdrName:  { fontSize: 18, color: COLORS.text, fontFamily: 'CormorantGaramond_600SemiBold',
    letterSpacing: 0.5 },
  hdrSub:   { fontSize: 10, color: COLORS.gold, letterSpacing: 3,
    textTransform: 'uppercase', marginTop: 1, fontFamily: 'Montserrat_400Regular' },
  logoutBtn:{ padding: 8 },
  logoutTxt:{ fontSize: 18, color: COLORS.text3 },
  nav:      { backgroundColor: '#0a0806', borderTopWidth: 1,
    borderTopColor: 'rgba(201,168,76,.12)', flexDirection: 'row' },
  navBtn:   { flex: 1, alignItems: 'center', paddingTop: 10, paddingBottom: 6,
    position: 'relative' },
  navBar:   { position: 'absolute', top: 0, left: '25%', right: '25%',
    height: 2, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  navLabel: { fontSize: 10, color: COLORS.text3, marginTop: 4,
    letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: 'Montserrat_500Medium' },
  stagingBanner:    { backgroundColor: '#7c3aed', paddingVertical: 3, alignItems: 'center' },
  stagingBannerTxt: { color: '#fff', fontSize: 10, fontFamily: 'Montserrat_700Bold',
    letterSpacing: 1.5, textTransform: 'uppercase' },
});
