import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Image,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { COLORS } from '../constants';

const AVATARES = {
  '🎭 Personajes': ['🤖','👨‍🚀','🧙','🦸','🥷','👑','🎩','💀','👨‍🎤','🧑‍🎨','🕵️','🧑‍🚒'],
  '🦁 Animales':   ['🦁','🐯','🦊','🐺','🐻','🦅','🦋','🐸','🐲','🦈','🦉','🐮','🦓'],
  '⚽ Deportes':   ['⚽','🏀','🎾','🥊','🏋️','🤸','🏄','🎯','🏆','⛹️','🤼','🚴'],
  '🌍 Países':     ['🇨🇱','🇨🇴','🇲🇽','🇧🇷','🇦🇷','🇺🇸','🇪🇸','🇯🇵','🇫🇷','🇮🇹','🇩🇪','🇬🇧'],
  '🎨 Cool':       ['🔥','⚡','💎','🌟','🎸','🎵','🏴‍☠️','🌈','❄️','🌊','💥','🎯'],
};

const KEY_EMOJI = (bid) => `bp_avatar_${bid}`;

export default function AvatarScreen({ barbero, avatarImage, onClose }) {
  const [categoria,      setCategoria]      = useState('🎭 Personajes');
  const [emoji,          setEmoji]          = useState(barbero.letra);
  const [seleccionHecha, setSeleccionHecha] = useState(false);
  const [guardando,      setGuardando]      = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(KEY_EMOJI(barbero.bid))
      .then(em => { if (em) setEmoji(em); })
      .catch(() => {});
  }, []);

  const guardar = async () => {
    setGuardando(true);
    try {
      await SecureStore.setItemAsync(KEY_EMOJI(barbero.bid), emoji);
      onClose({ type: 'emoji', emoji });
    } catch {
      Alert.alert('Error', 'No se pudo guardar el emoji.');
      setGuardando(false);
    }
  };

  return (
    <View style={s.container}>

      <View style={s.header}>
        <Text style={s.title}>Tu avatar</Text>
        <TouchableOpacity onPress={() => onClose(null)}
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}>
          <Text style={s.close}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Preview */}
      <View style={s.preview}>
        <View style={[s.avatarBig, { backgroundColor: barbero.bg }]}>
          {avatarImage
            ? <Image source={{ uri: avatarImage }} style={s.avatarImg} />
            : <Text style={s.avatarBigTxt}>{emoji}</Text>
          }
        </View>
        <Text style={s.previewNom}>{barbero.nombre}</Text>
        <Text style={s.adminNote}>
          {avatarImage
            ? '📸 Foto actualizada por el administrador'
            : 'Tu foto la actualiza el administrador'}
        </Text>
      </View>

      {/* Emoji selector — solo si no hay foto del servidor */}
      {!avatarImage && (
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
                onPress={() => { setEmoji(em); setSeleccionHecha(true); }}>
                <Text style={s.emojiTxt}>{em}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      {/* Botón guardar: solo si eligió un emoji nuevo (sin foto de servidor) */}
      {!avatarImage && seleccionHecha && (
        <View style={s.footer}>
          <TouchableOpacity style={s.btnCancelar} onPress={() => onClose(null)}>
            <Text style={s.btnCancelarTxt}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.btnGuardar} onPress={guardar} disabled={guardando}>
            {guardando
              ? <ActivityIndicator color={COLORS.bg} />
              : <Text style={s.btnGuardarTxt}>✓ Guardar</Text>}
          </TouchableOpacity>
        </View>
      )}

    </View>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.bg },

  header:       { flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 18, paddingTop: 24 },
  title:        { fontSize: 20, color: COLORS.text, fontWeight: '600' },
  close:        { fontSize: 22, color: COLORS.text3 },

  preview:      { alignItems: 'center', paddingVertical: 20 },
  avatarBig:    { width: 96, height: 96, borderRadius: 48,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10, overflow: 'hidden' },
  avatarBigTxt: { fontSize: 50 },
  avatarImg:    { width: 96, height: 96, borderRadius: 48 },
  previewNom:   { fontSize: 18, color: COLORS.text, fontWeight: '500', marginBottom: 6 },
  adminNote:    { fontSize: 13, color: COLORS.text3, textAlign: 'center', paddingHorizontal: 32 },

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

  footer:       { flexDirection: 'row', gap: 10, margin: 18 },
  btnCancelar:  { flex: 1, padding: 16, borderRadius: 14, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.s2 },
  btnCancelarTxt: { fontSize: 16, color: COLORS.text2, fontWeight: '600' },

  btnGuardar:   { flex: 2, padding: 16, borderRadius: 14, alignItems: 'center',
    backgroundColor: COLORS.gold },
  btnGuardarTxt:{ fontSize: 17, color: COLORS.bg, fontWeight: '700' },
});
