/**
 * gen-assets.js  —  Jimp v1 API
 * Generates:
 *   assets/icon.png           — 1024×1024 app launcher icon
 *   assets/adaptive-icon.png  — Android foreground, transparent background
 *   assets/splash.png         — full-screen dark splash with centered logo
 *
 * Run: node scripts/gen-assets.js
 */

const { Jimp, rgbaToInt, intToRGBA, BlendMode } = require('jimp');
const path = require('path');

const ROOT   = path.resolve(__dirname, '..');
const SRC    = path.join(ROOT, 'icon.png');
const ASSETS = path.join(ROOT, 'assets');

// Brand colors (RGBA ints)
const BG      = rgbaToInt(8, 7, 6, 255);      // #080706
const GOLD_R  = 0xc9; const GOLD_G = 0xa8; const GOLD_B = 0x4c;

const SPLASH_W   = 1284;
const SPLASH_H   = 2778;
const LOGO_SIZE  = 960;      // logo diameter on splash
const RING_R     = LOGO_SIZE / 2 + 40;
const RING_WIDTH = 4;

async function run() {
  console.log('Reading source icon…');
  const src = await Jimp.read(SRC);
  console.log(`  Source: ${src.width}×${src.height}`);

  // ── 1. assets/icon.png  (1024×1024, white bg kept) ────────────
  const icon = src.clone().resize({ w: 1024, h: 1024 });
  await icon.write(path.join(ASSETS, 'icon.png'));
  console.log('✅  assets/icon.png  (1024×1024)');

  // ── 2. assets/adaptive-icon.png  (transparent bg) ─────────────
  const adaptive = src.clone().resize({ w: 1024, h: 1024 });
  adaptive.scan(0, 0, adaptive.width, adaptive.height, function(x, y, idx) {
    const r = this.bitmap.data[idx];
    const g = this.bitmap.data[idx + 1];
    const b = this.bitmap.data[idx + 2];
    // Near-white pixels → fully transparent
    if (r > 225 && g > 225 && b > 225) {
      this.bitmap.data[idx + 3] = 0;
    }
  });
  await adaptive.write(path.join(ASSETS, 'adaptive-icon.png'));
  console.log('✅  assets/adaptive-icon.png  (transparent bg)');

  // ── 3. assets/splash.png  (dark + gold ring + large logo) ──────
  console.log(`Building splash ${SPLASH_W}×${SPLASH_H}…`);
  const splash = new Jimp({ width: SPLASH_W, height: SPLASH_H, color: BG });

  const cx = Math.floor(SPLASH_W / 2);
  const cy = Math.floor(SPLASH_H / 2);

  // Soft gold glow ring
  const glowOuter = RING_R + 60;
  const glowInner = RING_R - 60;
  splash.scan(0, 0, SPLASH_W, SPLASH_H, function(x, y, idx) {
    const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
    if (dist < glowOuter && dist > glowInner) {
      // bell-shaped opacity centred on RING_R
      const t = 1 - Math.abs(dist - RING_R) / 60;
      const alpha = Math.round(t * t * 38); // max ~38/255 opacity glow
      if (alpha > 0) {
        const er = this.bitmap.data[idx];
        const eg = this.bitmap.data[idx + 1];
        const eb = this.bitmap.data[idx + 2];
        const a  = alpha / 255;
        this.bitmap.data[idx]     = Math.round(er + (GOLD_R - er) * a);
        this.bitmap.data[idx + 1] = Math.round(eg + (GOLD_G - eg) * a);
        this.bitmap.data[idx + 2] = Math.round(eb + (GOLD_B - eb) * a);
      }
    }
  });

  // Sharp gold ring
  splash.scan(0, 0, SPLASH_W, SPLASH_H, function(x, y, idx) {
    const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
    if (dist >= RING_R - RING_WIDTH && dist <= RING_R + RING_WIDTH) {
      const t   = 1 - Math.abs(dist - RING_R) / (RING_WIDTH + 1);
      const a   = Math.round(t * 120) / 255; // max 120/255 opacity
      const er  = this.bitmap.data[idx];
      const eg  = this.bitmap.data[idx + 1];
      const eb  = this.bitmap.data[idx + 2];
      this.bitmap.data[idx]     = Math.round(er + (GOLD_R - er) * a);
      this.bitmap.data[idx + 1] = Math.round(eg + (GOLD_G - eg) * a);
      this.bitmap.data[idx + 2] = Math.round(eb + (GOLD_B - eb) * a);
    }
  });

  // Composite logo (transparent bg version) centred
  const logo = adaptive.clone().resize({ w: LOGO_SIZE, h: LOGO_SIZE });
  const logoX = Math.floor((SPLASH_W - LOGO_SIZE) / 2);
  const logoY = Math.floor((SPLASH_H - LOGO_SIZE) / 2);
  splash.composite(logo, logoX, logoY);

  await splash.write(path.join(ASSETS, 'splash.png'));
  console.log('✅  assets/splash.png');
  console.log('\nAll done.');
}

run().catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
