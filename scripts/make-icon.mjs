// Pure-Node PNG icon generator (no native/image dependencies).
// Renders the plugin logo (a clean calendar with one highlighted "special
// day") at 256px using 4x supersampling for smooth edges. Writes
// public/icon.png and the Base64 used for the HCU metadata LABEL.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const N = 256; // output size
const S = 4; // supersampling factor
const SS = N * S;

// ---- palette (dark-glass theme) ----
const AMBER_TOP = [251, 191, 36]; // #fbbf24
const AMBER_BOT = [245, 158, 11]; // #f59e0b
const SLATE = [31, 41, 55]; // #1f2937 header + rings
const WHITE = [255, 255, 255];
const CELL = [212, 219, 231]; // #d4dbe7 light grey day cell
const HILITE = [245, 158, 11]; // amber special-day cell

// ---- geometry (design space = 256) ----
const tile = { x0: 16, y0: 16, x1: 240, y1: 240, r: 52 };
const page = { x0: 50, y0: 70, x1: 206, y1: 206, r: 22 };
const HEADER_Y = 114; // header band bottom
const rings = [
  { x0: 96, y0: 44, x1: 110, y1: 84, r: 7 },
  { x0: 146, y0: 44, x1: 160, y1: 84, r: 7 },
];
const cellCols = [88, 128, 168];
const cellRows = [142, 180];
const CELL_HW = 19;
const CELL_HH = 15;
const CELL_R = 6;
const HILITE_COL = 168; // highlighted special day (col 3, row 2)
const HILITE_ROW = 180;

function inRoundRect(px, py, x0, y0, x1, y1, r) {
  if (px < x0 || px > x1 || py < y0 || py > y1) return false;
  // Corner regions: outside the rounded corner circle => not inside.
  const cx = px < x0 + r ? x0 + r : px > x1 - r ? x1 - r : px;
  const cy = py < y0 + r ? y0 + r : py > y1 - r ? y1 - r : py;
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

function lerp(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

// Determine the colour (or null = transparent) of a design-space point.
function shade(px, py) {
  if (!inRoundRect(px, py, tile.x0, tile.y0, tile.x1, tile.y1, tile.r)) return null;

  let col = lerp(AMBER_TOP, AMBER_BOT, (py - tile.y0) / (tile.y1 - tile.y0));

  // Binder rings (drawn over the background, behind the page body).
  for (const ring of rings) {
    if (inRoundRect(px, py, ring.x0, ring.y0, ring.x1, ring.y1, ring.r)) col = SLATE;
  }

  // Calendar page.
  if (inRoundRect(px, py, page.x0, page.y0, page.x1, page.y1, page.r)) {
    if (py < HEADER_Y) {
      col = SLATE; // header band (inherits the page's rounded top corners)
    } else {
      col = WHITE;
      // Day grid.
      for (const cy of cellRows) {
        for (const cx of cellCols) {
          if (inRoundRect(px, py, cx - CELL_HW, cy - CELL_HH, cx + CELL_HW, cy + CELL_HH, CELL_R)) {
            col = cx === HILITE_COL && cy === HILITE_ROW ? HILITE : CELL;
          }
        }
      }
    }
  }

  return col;
}

// ---- render with supersampling, then box-downsample to N x N ----
const out = new Uint8Array(N * N * 4);
for (let oy = 0; oy < N; oy++) {
  for (let ox = 0; ox < N; ox++) {
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    for (let sy = 0; sy < S; sy++) {
      for (let sx = 0; sx < S; sx++) {
        const px = ox + (sx + 0.5) / S;
        const py = oy + (sy + 0.5) / S;
        const c = shade(px, py);
        if (c) {
          r += c[0];
          g += c[1];
          b += c[2];
          a += 1;
        }
      }
    }
    const total = S * S;
    const i = (oy * N + ox) * 4;
    if (a === 0) {
      out[i] = out[i + 1] = out[i + 2] = out[i + 3] = 0;
    } else {
      // Alpha-weighted colour so edges blend correctly against transparency.
      out[i] = Math.round(r / a);
      out[i + 1] = Math.round(g / a);
      out[i + 2] = Math.round(b / a);
      out[i + 3] = Math.round((a / total) * 255);
    }
  }
}

// ---- encode PNG (8-bit RGBA) ----
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([typeBytes, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(N, 0);
ihdr.writeUInt32BE(N, 4);
ihdr[8] = 8;
ihdr[9] = 6;

const raw = Buffer.alloc(N * (N * 4 + 1));
for (let y = 0; y < N; y++) {
  raw[y * (N * 4 + 1)] = 0;
  for (let x = 0; x < N * 4; x++) raw[y * (N * 4 + 1) + 1 + x] = out[y * N * 4 + x];
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const here = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(here, '..', 'public', 'icon.png'), png);
const b64 = png.toString('base64');
writeFileSync(join(here, '..', '.tmp-assets', 'icon.b64'), b64);
console.log(`icon.png written: ${png.length} bytes, base64 ${b64.length} chars`);
