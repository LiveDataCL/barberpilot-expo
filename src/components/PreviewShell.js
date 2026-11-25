// Wraps the whole App. Preview only: a banner on every screen while the guard is confirmed; a blocking screen if it is not.
// In production the shell renders its children unchanged (no banner, no block).
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { ES_PREVIEW, estadoGuardia, suscribirEstado, suscribirBloqueo, TEXTO_BLOQUEO } from '../services/previewGuard';

export const TEXTO_BANNER = 'COPIA DE PRUEBA · SOLO LECTURA';
export const TEXTO_FALLO_GUARDIA = 'GUARD FAILED - DO NOT USE';

export default function PreviewShell({ children }) {
  const [estado, setEstado] = useState(estadoGuardia());
  useEffect(() => {
    const quitarEstado = suscribirEstado(setEstado);
    const quitarBloqueo = suscribirBloqueo(() => Alert.alert('Copia de prueba', TEXTO_BLOQUEO));
    return () => { quitarEstado(); quitarBloqueo(); };
  }, []);

  if (!ES_PREVIEW) return children;
  if (estado === 'pendiente') {
    // until the self-test answers, nothing of the App is shown: fail closed
    return <View style={s.fallo} accessibilityRole="alert"><Text style={s.pendienteTxt}>Comprobando la copia de prueba…</Text></View>;
  }
  if (estado === 'fallido') {
    return (
      <View style={s.fallo} accessibilityRole="alert">
        <Text style={s.falloTxt}>{TEXTO_FALLO_GUARDIA}</Text>
      </View>
    );
  }
  return (
    <View style={{ flex: 1 }}>
      {estado === 'activo' ? (
        <View style={s.banner} accessibilityRole="text">
          <Text style={s.bannerTxt}>{TEXTO_BANNER}</Text>
        </View>
      ) : null}
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  banner: { backgroundColor: '#7a2a2a', paddingVertical: 4, alignItems: 'center' },
  bannerTxt: { color: '#ffffff', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  fallo: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', padding: 24 },
  pendienteTxt: { color: '#c9a84c', fontSize: 15, textAlign: 'center' },
  falloTxt: { color: '#ff5555', fontSize: 22, fontWeight: '900', textAlign: 'center' },
});
