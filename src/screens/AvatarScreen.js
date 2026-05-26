import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Alert, ActivityIndicator,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { COLORS } from '../constants';

const AVATARES = {
  '🎭 Personajes': ['🤖','👨‍🚀','🧙','🦸','🥷','👑','🎩','💀','👨‍🎤','🧑‍🎨','🕵️','🧑‍🚒'],
  '🦁 Animales':   ['🦁','🐯','🦊','🐺','🐻','🦅','🦋','🐸','🐲','🦈','🦉','🐮','🦓'],
  '⚽ Deportes':   ['⚽','🏀','🎾','🥊','🏋️','🤸','🏄','🎯','🏆','⛹️','🤼','🚴'],
  '🌍 Países':     ['🇨🇱','🇨🇴','🇲🇽','🇧🇷','🇦🇷','🇺🇸','🇪🇸','🇯🇵','🇫🇷','🇮🇹','🇩🇪','🇬🇧'],
  '🎨 Cool':       ['🔥','⚡','💎','🌟','🎸','🎵','🏴‍☠️','🌈','❄️','🌊','💥','🎯'],
};

const KEY_IMG   = (bid) => `bp_avatar_img_${bid}`;
const KEY_EMOJI = (bid) => `bp_avatar_${bid}`;
const IMG_DIR   = FileSystem.documentDirectory + 'avatars/';

export default function AvatarScreen({ barbero, onClose }) {
  const [modo,       setModo]       = useState('foto');   // 'foto' | 'emoji'
  const [categoria,  setCategoria]  = useState('🎭 Personajes');
  const [emoji,      setEmoji]      = useState(barbero.letra);
  const [fotoUri,    setFotoUri]    = useState(null);
  const [guardando,  setGuardando]  = useState(false);

  useEffect(() => {
    (async () => {
      // Cargar foto existente
      const img = await SecureStore.getItemAsync(KEY_IMG(barbero.bid)).catch(() => null);
      if (img) { setFotoUri(img); setModo('foto'); return; }
      // Cargar emoji existente
      const em = await SecureStore.getItemAsync(KEY_EMOJI(barbero.bid)).catch(() => null);
      if (em) { setEmoji(em); setModo('emoji'); }
    })();
  }, []);

  const elegirFoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Sin permiso', 'Necesitamos acceso a tu galería'); return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;
    // Copiar al directorio persistente
    await FileSystem.makeDirectoryAsync(IMG_DIR, { intermediates: true }).catch(() => {});
    const dest = IMG_DIR + `avatar_${barbero.bid}.jpg`;
    await FileSystem.copyAsync({ from: result.assets[0].uri, to: dest });
    setFotoUri(dest);
    setModo('foto');
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      if (modo === 'foto' && fotoUri) {
        await SecureStore.setItemAsync(KEY_IMG(barbero.bid), fotoUri);
        await SecureStore.deleteItemAsync(KEY_EMOJI(barbero.bid)).catch(() => {});
        onClose({ type: 'image', uri: fotoUri });
      } else {
        await SecureStore.setItemAsync(KEY_EMOJI(barbero.bid), emoji);
        await SecureStore.deleteItemAsync(KEY_IMG(barbero.bid)).catch(() => {});
        onClose({ type: 'emoji', emoji });
      }
    } catch {
      Alert.alert('Error al guardar el avatar');
    }
    setGuardando(false);
  };

  const previewContent = () => {
    if (modo === 'foto' && fotoUri) {
      return <Image source={{ uri: fotoUri }} style={s.avatarBigImg} />;
    }
    return <Text style={s.avatarBigTxt}>{emoji}</Text>;
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Tu avatar</Text>
        <TouchableOpacity onPress={() => onClose(null)}>
          <Text style={s.close}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Preview */}
      <View style={s.preview}>
        <View style={[s.avatarBig, { backgroundColor: barbero.bg }]}>
          {previewContent()}
        </View>
        <Text style={s.previewNom}>{barbero.nombre}</Text>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        <TouchableOpacity style={[s.tab, modo === 'foto' && s.tabOn]} onPress={() => setModo('foto')}>
          <Text style={[s.tabTxt, modo === 'foto' && { color: COLORS.gold }]}>📷 Foto propia</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, modo === 'emoji' && s.tabOn]} onPress={() => setModo('emoji')}>
          <Text style={[s.tabTxt, modo === 'emoji' && { color: COLORS.gold }]}>😎 Emoji</Text>
        </TouchableOpacity>
      </View>

      {modo === 'foto' ? (
        <View style={s.fotoPanel}>
          <TouchableOpacity style={s.btnFoto} onPress={elegirFoto}>
            <Text style={s.btnFotoIco}>🖼</Text>
            <Text style={s.btnFotoTxt}>
              {fotoUri ? 'Cambiar foto' : 'Elegir de galería'}
            </Text>
            <Text style={s.btnFotoSub}>Cuadrada, recortable</Text>
          </TouchableOpacity>
          {fotoUri && (
            <TouchableOpacity style={s.btnBorrar} onPress={() => setFotoUri(null)}>
              <Text style={s.btnBorrarTxt}>✕ Quitar foto</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={s.cats} contentContainerStyle={{ paddingHorizontal: 18 }}>
            {Object.keys(AVATARES).map(cat => (
              <TouchableOpacity key={cat}
                style={[s.catBtn, categoria === cat && s.catBtnOn]}
                onPress={() => setCategoria(cat)}>
                <Text style={[s.catTxt, categoria === cat && { color: COLORS.gold }]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={s.grid}>
            {AVATARES[categoria].map((em, i) => (
              <TouchableOpacity key={i}
                style={[s.emojiBtn, emoji === em && s.emojiBtnOn]}
                onPress={() => setEmoji(em)}>
                <Text style={s.emojiTxt}>{em}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      <TouchableOpacity style={s.btnGuardar} onPress={guardar} disabled={guardando}>
        {guardando
          ? <ActivityIndicator color={COLORS.bg} />
          : <Text style={s.btnGuardarTxt}>✓ Guardar avatar</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.bg },
  header:       { flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 18, paddingTop: 24 },
  title:        { fontSize: 20, color: COLORS.text, fontWeight: '600' },
  close:        { fontSize: 22, color: COLORS.text3 },

  preview:      { alignItems: 'center', paddingVertical: 18 },
  avatarBig:    { width: 96, height: 96, borderRadius: 48,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10, overflow: 'hidden' },
  avatarBigImg: { width: 96, height: 96, borderRadius: 48 },
  avatarBigTxt: { fontSize: 50 },
  previewNom:   { fontSize: 18, color: COLORS.text, fontWeight: '500' },

  tabs:         { flexDirection: 'row', marginHorizontal: 18, marginBottom: 14,
    backgroundColor: COLORS.s2, borderRadius: 12, padding: 4 },
  tab:          { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabOn:        { backgroundColor: 'rgba(201,168,76,.12)' },
  tabTxt:       { fontSize: 14, color: COLORS.text2, fontWeight: '500' },

  fotoPanel:    { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  btnFoto:      { borderRadius: 16, borderWidth: 1.5, borderColor: COLORS.border2,
    borderStyle: 'dashed', padding: 36, alignItems: 'center', gap: 10, width: '100%' },
  btnFotoIco:   { fontSize: 48 },
  btnFotoTxt:   { fontSize: 17, color: COLORS.gold, fontWeight: '600' },
  btnFotoSub:   { fontSize: 13, color: COLORS.text3 },
  btnBorrar:    { marginTop: 16, padding: 12 },
  btnBorrarTxt: { color: COLORS.red, fontSize: 14 },

  cats:         { flexGrow: 0, marginBottom: 12 },
  catBtn:       { paddingHorizontal: 14, paddingVertical: 8, marginRight: 8,
    backgroundColor: COLORS.s2, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border },
  catBtnOn:     { borderColor: COLORS.gold, backgroundColor: 'rgba(201,168,76,.1)' },
  catTxt:       { fontSize: 13, color: COLORS.text2 },

  grid:         { flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 14, paddingBottom: 20, gap: 6 },
  emojiBtn:     { width: 60, height: 60, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.s2, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  emojiBtnOn:   { borderColor: COLORS.gold, backgroundColor: 'rgba(201,168,76,.15)' },
  emojiTxt:     { fontSize: 32 },

  btnGuardar:   { backgroundColor: COLORS.gold, margin: 18, padding: 16,
    borderRadius: 14, alignItems: 'center' },
  btnGuardarTxt:{ fontSize: 17, color: COLORS.bg, fontWeight: '700' },
});
