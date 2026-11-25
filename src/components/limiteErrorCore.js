// Error boundary for the "Mi evaluación" screen. A render failure inside the evaluation shows this message instead of crashing
// ConfigScreen (Perfil, sales, PIN change). Pure: no React Native import, so the node tests can drive it.
export const TEXTO_FALLO = 'No se pudo mostrar tu evaluación en este momento. Tus datos del perfil siguen disponibles.';

// React is injected: { Component, createElement }; View and Text are the React Native components; estilos = { caja, texto }.
export function crearLimiteError({ React, View, Text, estilos = {} }) {
  class LimiteEvaluacion extends React.Component {
    constructor(props) {
      super(props);
      this.state = { fallo: false };
    }
    // a render failure below this boundary switches it to the fallback; nothing is logged (the answer must never reach the console)
    static getDerivedStateFromError() {
      return { fallo: true };
    }
    render() {
      if (this.state.fallo) {
        return React.createElement(View, { style: estilos.caja, accessibilityRole: 'alert' },
          React.createElement(Text, { style: estilos.texto }, TEXTO_FALLO));
      }
      return this.props.children;
    }
  }
  return LimiteEvaluacion;
}
