// Run: node --test tests/limiteError.test.js. The boundary logic is driven with a small harness that follows React's contract:
// render the children; if a child throws during render, getDerivedStateFromError decides the fallback. No React runtime is needed.
// (A real reconciler run would need a test-renderer dependency, which is not added here.)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { crearLimiteError, TEXTO_FALLO } from '../src/components/limiteErrorCore.js';

// fake React: elements are plain objects; Component stores props
class Component { constructor(props) { this.props = props; } }
const React = { Component, createElement: (type, props, ...children) => ({ type, props: { ...(props || {}), children: children.length === 1 ? children[0] : children } }) };
const View = 'View', Text = 'Text';
const Limite = crearLimiteError({ React, View, Text, estilos: { caja: 'caja', texto: 'texto' } });

// one render pass of the boundary around a child element, as React does it
function renderizar(elemento) {
  const inst = new Limite({ children: elemento });
  const salida = inst.render();
  if (salida && typeof salida.type === 'function') {
    try {
      salida.type(salida.props);            // the child renders now; it may throw
    } catch (e) {
      inst.state = Limite.getDerivedStateFromError(e);
      return { fallo: true, salida: inst.render() };
    }
  }
  return { fallo: false, salida };
}

function Roto() { throw new Error('fallo de render forzado para la prueba'); }
function Sano() { return null; }

test('forced throw inside the evaluation: the fallback is shown, the child is not', () => {
  const r = renderizar(React.createElement(Roto, null));
  assert.equal(r.fallo, true);
  assert.equal(r.salida.type, View);
  assert.equal(r.salida.props.accessibilityRole, 'alert');
  assert.equal(r.salida.props.children.props.children, TEXTO_FALLO);
});

test('a healthy child renders as is, with no fallback', () => {
  const r = renderizar(React.createElement(Sano, null));
  assert.equal(r.fallo, false);
  assert.equal(r.salida.type, Sano);
});

test('the initial state does not show the fallback', () => {
  assert.equal(new Limite({ children: null }).state.fallo, false);
});

test('the fallback never echoes the error message (no data, no stack in the UI)', () => {
  assert.equal(TEXTO_FALLO.includes('fallo de render'), false);
});

test('the boundary never logs (no console output of the answer)', () => {
  const src = fs.readFileSync(new URL('../src/components/limiteErrorCore.js', import.meta.url), 'utf8');
  assert.equal(/console\./.test(src), false);
});

test('ConfigScreen wraps only the evaluation branch in the boundary, outside the segmented control', () => {
  const config = fs.readFileSync(new URL('../src/screens/ConfigScreen.js', import.meta.url), 'utf8');
  assert.match(config, /import LimiteEvaluacion from '\.\.\/components\/LimiteEvaluacion';/);
  assert.match(config, /<LimiteEvaluacion>\s*<MiEvaluacion barbero=\{barbero\} \/>\s*<\/LimiteEvaluacion>/);
  // the segmented control is rendered before the boundary, so it stays up when the evaluation fails
  const iSeg = config.indexOf('{segmentos}'), iLim = config.indexOf('<LimiteEvaluacion>');
  assert.ok(iSeg > 0 && iLim > iSeg, 'segmented control before the boundary');
});
