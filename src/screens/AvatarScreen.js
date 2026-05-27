import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Image,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '../constants';

const AVATARES = {
  '🎭 Personajes': ['🤖','👨‍🚀','🧙','🦸','🥷','👑','🎩','💀','👨‍🎤','🧑‍🎨','🕵️','🧑‍🚒'],
  '🦁 Animales':   ['🦁','🐯','🦊','🐺','🐻','🦅','🦋','🐸','🐲','🦈','🦉','🐮','🦓'],
  '⚽ Deportes':   ['⚽','🏀','🎾','🥊','🏋️','🤸','🏄','🎯','🏆','⛹️','🤼','🚴'],
  '🌍 Países':     ['🇨🇱','🇨🇴','🇲🇽','🇧🇷','🇦🇷','🇺🇸','🇪🇸','🇯🇵','🇫🇷','🇮🇹','🇩🇪','🇬🇧'],
  '🎨 Cool':       ['🔥','⚡','💎','🌟','🎸','🎵','🏴‍☠️','🌈','❄️','🌊','💥','🎯'],
};

const KEY_EMOJI = (bid) => `bp_avatar_${bid}`;
const KEY_IMG   = (bid) => `bp_avatar_img_${bid}`;

export default function AvatarScreen({ barbero, onClose }) {
  const [categoria,      setCategoria]      = useState('🎭 Personajes');
  const [emoji,          setEmoji]          = useState(barbero.letra);
  const [selectedImage,  setSelectedImage]  = useState(null);
  const [guardando,      setGuardando]      = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(KEY_EMOJI(barbero.bid))
      .then(em => { if (em) setEmoji(em); })
      .catch(() => {});
  }, []);

  const seleccionarFoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso necesario', 'Necesitamos acceso a tu galería para cambiar la foto.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      if (selectedImage) {
        await SecureStore.setItemAsync(KEY_IMG(barbero.bid), selectedImage);
        await SecureStore.deleteItemAsync(KEY_EMOJI(barbero.bid)).catch(() => {});
        onClose({ type: 'image', uri: selectedImage });
      } else {
        await SecureStore.setItemAsync(KEY_EMOJI(barbero.bid), emoji);
        await SecureStore.deleteItemAsync(KEY_IMG(barbero.bid)).catch(() => {});
        onClose({ type: 'emoji', emoji });
      }
    } catch {
      Alert.alert('Error', 'No se pudo guardar el avatar.');
      setGuardando(false);
    }
  };

  const haySeleccion = selectedImage !== null || emoji !== barbero.letra;

  return (
    <View style={s.container}>

      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Tu avatar</Text>
        <TouchableOpacity onPress={() => onClose(null)} hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}>
          <Text style={s.close}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Preview */}
      <View style={s.preview}>
        <View style={[s.avatarBig, { backgroundColor: barbero.bg }]}>
          {selectedImage
            ? <Image source={{ uri: selectedImage }} style={s.avatarImg} />
            : <Text style={s.avatarBigTxt}>{emoji}</Text>
          }
        </View>
        <Text style={s.previewNom}>{barbero.nombre}</Text>

        {/* Botón seleccionar foto */}
        <TouchableOpacity style={s.btnFoto} onPress={seleccionarFoto}>
          <Text style={s.btnFotoTxt}>📷 Usar foto de galería</Text>
        </TouchableOpacity>
      </View>

      {/* Categorías emoji */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={s.cats} contentContainerStyle={{ paddingHorizontal: 18 }}>
        {Object.keys(AVATARES).map(cat => (
          <TouchableOpacity key={cat}
            style={[s.catBtn, categoria === cat && s.catBtnOn]}
            onPress={() => { setCategoria(cat); setSelectedImage(null); }}>
            <Text style={[s.catTxt, categoria === cat && { color: COLORS.gold }]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Grid emojis */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.grid}>
        {AVATARES[categoria].map((em, i) => (
          <TouchableOpacity key={i}
            style={[s.emojiBtn, !selectedImage && emoji === em && s.emojiBtnOn]}
            onPress={() => { setEmoji(em); setSelectedImage(null); }}>
            <Text style={s.emojiTxt}>{em}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Botones Cancelar + Guardar */}
      <View style={s.footer}>
        <TouchableOpacity style={s.btnCancelar} onPress={() => onClose(null)}>
          <Text style={s.btnCancelarTxt}>Cancelar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.btnGuardar, !haySeleccion && s.btnGuardarOff]}
          onPress={guardar}
          disabled={guardando}>
          {guardando
            ? <ActivityIndicator color={COLORS.bg} />
            : <Text style={s.btnGuardarTxt}>✓ Guardar</Text>
          }
        </TouchableOpacity>
      </View>

    </View>
  );
}

const s = StyleSheet.create({
  container:     { flex: 1, backgroundColor: COLORS.bg },

  header:        { flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 18, paddingTop: 24 },
  title:         { fontSize: 20, color: COLORS.text, fontWeight: '600' },
  close:         { fontSize: 22, color: COLORS.text3 },

  preview:       { alignItems: 'center', paddingVertical: 16 },
  avatarBig:     { width: 96, height: 96, borderRadius: 48,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10, overflow: 'hidden' },
  avatarBigTxt:  { fontSize: 50 },
  avatarImg:     { width: 96, height: 96, borderRadius: 48 },
  previewNom:    { fontSize: 18, color: COLORS.text, fontWeight: '500', marginBottom: 12 },

  btnFoto:       { paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.s2 },
  btnFotoTxt:    { fontSize: 13, color: COLORS.text2 },

  cats:          { flexGrow: 0, marginBottom: 12 },
  catBtn:        { paddingHorizontal: 14, paddingVertical: 8, marginRight: 8,
    backgroundColor: COLORS.s2, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border },
  catBtnOn:      { borderColor: COLORS.gold, backgroundColor: 'rgba(201,168,76,.1)' },
  catTxt:        { fontSize: 13, color: COLORS.text2 },

  grid:          { flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 14, paddingBottom: 20, gap: 6 },
  emojiBtn:      { width: 60, height: 60, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.s2, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  emojiBtnOn:    { borderColor: COLORS.gold, backgroundColor: 'rgba(201,168,76,.15)' },
  emojiTxt:      { fontSize: 32 },

  footer:        { flexDirection: 'row', gap: 10, margin: 18 },
  btnCancelar:   { flex: 1, padding: 16, borderRadius: 14, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.s2 },
  btnCancelarTxt:{ fontSize: 16, color: COLORS.text2, fontWeight: '600' },

  btnGuardar:    { flex: 2, padding: 16, borderRadius: 14, alignItems: 'center',
    backgroundColor: COLORS.gold },
  btnGuardarOff: { opacity: 0.5 },
  btnGuardarTxt: { fontSize: 17, color: COLORS.bg, fontWeight: '700' },
});
