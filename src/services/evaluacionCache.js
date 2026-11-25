// Last good answer of "Mi evaluación", kept on the device so the barber can see it when the API cannot be reached.
// One file per barber (name derived from the barber id), only after the answer passed the allowlist (esDtoValido). Uses the current
// expo-file-system API (File/Paths), already linked in the App (AdminScreen uses the same module): no new native module.
// Every function fails quietly: a cache problem never blocks the screen.
import { File, Paths } from 'expo-file-system';
import { esDtoValido } from './evaluacion';

const nombreDe = (bid) => 'evaluacion_' + String(bid).replace(/[^A-Za-z0-9_-]/g, '') + '.json';

export async function leerCache(bid) {
  try {
    const f = new File(Paths.document, nombreDe(bid));
    const o = JSON.parse(await f.text());
    if (o && typeof o.guardado === 'string' && o.dto && esDtoValido(o.dto)) return { guardado: o.guardado, dto: o.dto };
    return null;
  } catch {
    return null;   // no file yet, or unreadable: as if there were no cache
  }
}

export async function guardarCache(bid, dto) {
  try {
    if (!esDtoValido(dto)) return;
    const f = new File(Paths.document, nombreDe(bid));
    f.create({ overwrite: true, intermediates: true });
    f.write(JSON.stringify({ guardado: new Date().toISOString(), dto }));
  } catch {}
}

export async function borrarCache(bid) {
  try {
    new File(Paths.document, nombreDe(bid)).delete();
  } catch {}
}
