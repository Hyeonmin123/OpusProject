// use_figma script template, filled in by `uikit.py seed` (build/uikit/figma/*.js, one batch of
// assets per call; the tool takes 50k characters of code, so pixel data is row-deduplicated).
//
// Builds, idempotently, in the "Endless Cellar — Pixel UI Kit" Figma file:
//   - the "Pixel palette" variable collection (locked/* = pxlib.py, midpoint/* = uikit.EXTRA),
//   - the batch's page and its "Export sheet" frame (transparent, exports PNG @2x, the Icons
//     page @4x),
//   - one component per asset at its sheet position, drawn 1 unit = 1 art pixel as one vector
//     per palette colour (row runs of unit squares), each fill bound to its palette variable.
// 9-slice assets are split into nine region frames with MIN / STRETCH / MAX constraints, so an
// instance resized in Figma stretches exactly like the CSS border-image does.
// Scrims (`gen`) are generated here by the same ordered-dither code as uikit.py's scrim().
const D = __DATA__;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

// palette variables and the page, created on first use
function hex(h) {
  const n = parseInt(h.slice(1), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}
let coll = (await figma.variables.getLocalVariableCollectionsAsync()).find(
  (c) => c.name === 'Pixel palette',
);
if (!coll) coll = figma.variables.createVariableCollection('Pixel palette');
const modeId = coll.modes[0].modeId;
const vars = {};
for (const v of await figma.variables.getLocalVariablesAsync('COLOR')) {
  if (v.variableCollectionId === coll.id) vars[v.name.split('/')[1]] = v;
}
for (const p of D.palette) {
  if (vars[p.key]) continue;
  const v = figma.variables.createVariable(
    (p.extra ? 'midpoint/' : 'locked/') + p.key,
    coll,
    'COLOR',
  );
  v.setValueForMode(modeId, hex(p.hex));
  v.scopes = ['FRAME_FILL', 'SHAPE_FILL', 'STROKE_COLOR'];
  if (p.css) v.setVariableCodeSyntax('WEB', `var(${p.css})`);
  vars[p.key] = v;
}
let page = figma.root.children.find((p) => p.name === D.sheet.page);
if (!page) {
  page = figma.createPage();
  page.name = D.sheet.page;
}
await figma.setCurrentPageAsync(page);
let sheet = page.findOne((n) => n.type === 'FRAME' && n.name === 'Export sheet');
if (!sheet) {
  sheet = figma.createFrame();
  sheet.name = 'Export sheet';
  page.appendChild(sheet);
  sheet.x = 0;
  sheet.y = 160;
  sheet.fills = [];
  sheet.clipsContent = false;
}
const SCALE = D.sheet.scale || 2;
sheet.exportSettings = [{ format: 'PNG', suffix: '', constraint: { type: 'SCALE', value: SCALE } }];
sheet.resize(D.sheet.w, D.sheet.h);

// ---- pixels ------------------------------------------------------------------------------------
// rows: RLE strings over the page-wide token table ('.' = transparent, letter + optional count)
function decodeRows(a) {
  const px = new Int16Array(a.w * a.h).fill(-1);
  a.rows.forEach((id, y) => {
    let x = 0;
    for (const m of D.rows[id].matchAll(/([A-Za-z.])(\d*)/g)) {
      const n = m[2] ? +m[2] : 1;
      px.fill(m[1] === '.' ? -1 : LETTERS.indexOf(m[1]), y * a.w + x, y * a.w + x + n);
      x += n;
    }
    if (x !== a.w) throw new Error(`${a.name}: row ${y} is ${x} px, want ${a.w}`);
  });
  return px;
}

// d0 scrims: alpha from a smooth field, ordered-dithered between the allowed steps
function scrim(a) {
  const levels = [0, ...D.scrimAlphas];
  const tokens = [];
  const px = new Int16Array(a.w * a.h).fill(-1);
  const p = a.gen;
  const field = (x, y) => {
    if (p.kind === 'vignette') {
      const nx = (x + 0.5) / a.w - 0.5;
      const ny = (y + 0.5) / a.h - p.cy;
      const ey = ny * (a.h / a.w) * 1.35;
      const d = Math.sqrt(nx * nx + ey * ey) / 0.5;
      const t = Math.min(1.0, Math.max(0.0, (d - p.inner) / (p.outer - p.inner)));
      let v = p.strength * t;
      if (p.floor) v = Math.max(v, p.floor);
      if (p.ramp) {
        const t2 = y / (a.h - 1);
        v = Math.max(v, t2 < 0.25 ? 0 : (150 * (t2 - 0.25)) / 0.75);
      }
      return v;
    }
    if (p.kind === 'ledge') {
      const t = y / 127;
      if (t < 0.38) return p.top + ((p.mid - p.top) * t) / 0.38;
      if (t < 0.7) return p.mid + ((p.bot - p.mid) * (t - 0.38)) / 0.32;
      return p.bot;
    }
    // pool
    const nx = (x + 0.5) / a.w - 0.5;
    const ny = (y + 0.5) / a.h - 0.5;
    const d = Math.sqrt(nx * nx + ny * ny) / 0.5;
    if (d >= 1) return 0;
    return d < 0.55 ? 192 : 192 - (144 * (d - 0.55)) / 0.45;
  };
  for (let y = 0; y < a.h; y++) {
    for (let x = 0; x < a.w; x++) {
      const v = field(x, y);
      if (v <= 0) continue;
      let i = 0;
      while (i + 1 < levels.length && levels[i + 1] <= v) i++;
      const lo = levels[i];
      const hi = i + 1 < levels.length ? levels[i + 1] : levels[i];
      const frac = hi === lo ? 0 : (v - lo) / (hi - lo);
      const pick = BAYER[(y % 4) * 4 + (x % 4)] / 16 < frac ? hi : lo;
      if (!pick) continue;
      const tok = pick === 255 ? 'd0' : `d0@${pick}`;
      if (!tokens.includes(tok)) tokens.push(tok);
      px[y * a.w + x] = tokens.indexOf(tok);
    }
  }
  return { px, tokens };
}

function paintFor(tok) {
  const [key, alpha] = tok.split('@');
  const c = vars[key].valuesByMode[modeId];
  const paint = figma.variables.setBoundVariableForPaint(
    { type: 'SOLID', color: { r: c.r, g: c.g, b: c.b } },
    'color',
    vars[key],
  );
  // binding resets the paint's opacity, so set it afterwards
  return alpha ? { ...paint, opacity: +alpha / 255 } : paint;
}

// one vector per token over [x0, x1) x [y0, y1), placed in `parent`
function drawRegion(a, px, tokens, parent, x0, y0, x1, y1, stretch) {
  let made = 0;
  for (let t = 0; t < tokens.length; t++) {
    let d = '';
    let bx = Infinity;
    let by = Infinity;
    for (let y = y0; y < y1; y++) {
      let x = x0;
      while (x < x1) {
        if (px[y * a.w + x] !== t) {
          x++;
          continue;
        }
        let e = x;
        while (e < x1 && px[y * a.w + e] === t) e++;
        bx = Math.min(bx, x);
        by = Math.min(by, y);
        d += `M ${x} ${y} L ${e} ${y} L ${e} ${y + 1} L ${x} ${y + 1} Z `;
        x = e;
      }
    }
    if (!d) continue;
    const v = figma.createVector();
    parent.appendChild(v);
    const rel = d.replace(/(\d+) (\d+)/g, (_, X, Y) => `${+X - bx} ${+Y - by}`).trim();
    v.vectorPaths = [{ windingRule: 'NONZERO', data: rel }];
    v.x = bx - x0;
    v.y = by - y0;
    v.name = tokens[t].replace('@', ' @');
    v.strokes = [];
    v.fills = [paintFor(tokens[t])];
    if (stretch) v.constraints = { horizontal: 'SCALE', vertical: 'SCALE' };
    made++;
  }
  return made;
}

// ---- components -------------------------------------------------------------------------------
const out = { page: page.id, sheet: sheet.id, components: {}, vectors: 0 };
for (const a of D.assets) {
  const old = sheet.findChild((n) => n.name === a.name);
  if (old) old.remove();
  const { px, tokens } = a.gen ? scrim(a) : { px: decodeRows(a), tokens: D.tokens };
  const c = figma.createComponent();
  sheet.appendChild(c);
  c.name = a.name;
  c.resize(a.w, a.h);
  c.x = a.x;
  c.y = a.y;
  c.fills = [];
  c.clipsContent = false;
  const sl = a.slice ? ` 9-slice (art px) ${a.slice.join(' ')}.` : '';
  c.description =
    `${a.w}x${a.h} art px, exported @${SCALE}x to src/assets/${a.out || `ui/${a.name}.png`}.${sl} ${a.note || ''}`.trim();
  if (!a.slice) {
    out.vectors += drawRegion(a, px, tokens, c, 0, 0, a.w, a.h, false);
  } else {
    const [t, r, b, l] = a.slice;
    const xs = [0, l, a.w - r, a.w];
    const ys = [0, t, a.h - b, a.h];
    const H = ['MIN', 'STRETCH', 'MAX'];
    const N = [
      ['top-left', 'top', 'top-right'],
      ['left', 'centre', 'right'],
      ['bottom-left', 'bottom', 'bottom-right'],
    ];
    for (let j = 0; j < 3; j++) {
      for (let i = 0; i < 3; i++) {
        const w = xs[i + 1] - xs[i];
        const h = ys[j + 1] - ys[j];
        if (w <= 0 || h <= 0) continue;
        const f = figma.createFrame();
        c.appendChild(f);
        f.name = N[j][i];
        f.resize(w, h);
        f.x = xs[i];
        f.y = ys[j];
        f.fills = [];
        f.clipsContent = false;
        f.constraints = { horizontal: H[i], vertical: H[j] };
        out.vectors += drawRegion(a, px, tokens, f, xs[i], ys[j], xs[i + 1], ys[j + 1], true);
      }
    }
  }
  out.components[a.name] = c.id;
}
return out;
