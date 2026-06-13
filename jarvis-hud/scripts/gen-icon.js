// Generates build/icon.png (1024×1024) — an arc-reactor style app icon — with
// zero dependencies, by hand-encoding a PNG. make-icns.sh turns it into .icns.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 1024;

// ── CRC32 ────────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

// ── Drawing ──────────────────────────────────────────────────────────────────
const px = Buffer.alloc(SIZE * SIZE * 4); // RGBA, premultiplied-ish via blend
function smooth(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
function blend(x, y, r, g, b, a) {
  if (a <= 0) return;
  const i = (y * SIZE + x) * 4;
  const ba = px[i + 3] / 255;
  const na = a / 255;
  const out = na + ba * (1 - na);
  if (out <= 0) return;
  px[i]     = Math.round((r * na + px[i]     * ba * (1 - na)) / out);
  px[i + 1] = Math.round((g * na + px[i + 1] * ba * (1 - na)) / out);
  px[i + 2] = Math.round((b * na + px[i + 2] * ba * (1 - na)) / out);
  px[i + 3] = Math.round(out * 255);
}

const C = SIZE / 2;
const R = SIZE / 2;
const corner = SIZE * 0.22;
const CYAN = [60, 220, 255];

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    // Rounded-rect mask
    const dx = Math.max(corner - x, x - (SIZE - corner), 0);
    const dy = Math.max(corner - y, y - (SIZE - corner), 0);
    const cd = Math.sqrt(dx * dx + dy * dy);
    const mask = 1 - smooth(corner - 1.5, corner + 1.5, cd);
    if (mask <= 0) continue;

    // Dark navy background gradient
    const ny = y / SIZE;
    blend(x, y, Math.round(4 + 8 * ny), Math.round(8 + 12 * ny), Math.round(18 + 26 * ny), Math.round(255 * mask));

    const r = Math.sqrt((x - C) * (x - C) + (y - C) * (y - C)) / R; // 0..~1

    // Outer + mid rings
    let ringA = smooth(0.60, 0.625, r) - smooth(0.69, 0.715, r);
    ringA = Math.max(ringA, 0.85 * (smooth(0.40, 0.425, r) - smooth(0.475, 0.50, r)));
    if (ringA > 0) blend(x, y, CYAN[0], CYAN[1], CYAN[2], Math.round(255 * ringA * mask));

    // Center glow
    const glow = 1 - smooth(0.0, 0.34, r);
    if (glow > 0) blend(x, y, 150, 240, 255, Math.round(235 * glow * glow * mask));
  }
}

// ── Encode PNG ───────────────────────────────────────────────────────────────
const stride = SIZE * 4 + 1;
const raw = Buffer.alloc(SIZE * stride);
for (let y = 0; y < SIZE; y++) {
  raw[y * stride] = 0; // filter: none
  px.copy(raw, y * stride + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}
const idat = zlib.deflateSync(raw, { level: 9 });

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8;  // bit depth
ihdr[9] = 6;  // colour type RGBA
ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0)),
]);

const outDir = path.join(__dirname, '..', 'build');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'icon.png'), png);
console.log(`Wrote build/icon.png (${SIZE}×${SIZE}, ${png.length} bytes)`);
