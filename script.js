/* ============================================================
   POSTER STUDIO — Application complète, 100% client-side.
   Aucune dépendance externe, aucun backend.
   ============================================================ */

"use strict";

/* ============================================================
   1. CONSTANTES
   ============================================================ */

const STAT_DEFS = [
  { key: "action", label: "Action" },
  { key: "humour", label: "Humour" },
  { key: "emotion", label: "Émotion" },
  { key: "combat", label: "Combat" },
  { key: "mystere", label: "Mystère" },
  { key: "complexite", label: "Complexité" },
  { key: "worldbuilding", label: "Worldbuilding" },
  { key: "animation", label: "Animation" },
  { key: "bandeSon", label: "Bande-son" },
  { key: "popularite", label: "Popularité" },
  { key: "accessibilite", label: "Accessibilité" },
  { key: "addictivite", label: "Addictivité" },
  { key: "impactEmotionnel", label: "Impact émotionnel" },
  { key: "rejouabilite", label: "Rejouabilité" },
  { key: "nostalgie", label: "Valeur nostalgique" },
];

const BADGE_DEFS = [
  "TOP SHONEN", "CHEF D'ŒUVRE", "CULTE", "COMMUNAUTÉ",
  "INCONTOURNABLE", "DÉBUTANT FRIENDLY", "LONG FORMAT",
  "TERMINÉ", "EN COURS",
];

const STORAGE_KEYS = {
  collection: "posterStudio.collection.v1",
  favorites: "posterStudio.favorites.v1",
};

const DEFAULT_STATS = STAT_DEFS.reduce((acc, s) => { acc[s.key] = 50; return acc; }, {});

function emptyPoster() {
  return {
    id: null, title: "", subtitle: "", synopsis: "", type: "Anime",
    genres: [], episodes: null, seasons: null, minutesPerEpisode: 24,
    rating: null, ranking: null, popularity: null, author: "", studio: "",
    releaseDate: "", status: "En cours", favoriteCharacter: "", favoriteArc: "",
    favoriteOpening: "", awards: [], stats: { ...DEFAULT_STATS }, badges: [],
    coverImage: null, coverImageEl: null, theme: null,
  };
}

/* ============================================================
   2. ÉTAT GLOBAL
   ============================================================ */

const state = {
  view: "studio",
  current: emptyPoster(),
  format: { w: 3000, h: 4000 },
  zoom: 1,
  collection: [],
  favorites: new Set(),
  collectionLayout: "grid",
  activeFilter: "all",
  searchQuery: "",
};

/* ============================================================
   3. UTILITAIRES
   ============================================================ */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function uid() { return "p_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

function parseCsv(str) {
  return String(str || "").split(",").map((s) => s.trim()).filter(Boolean);
}

function showToast(message, duration = 2600) {
  const host = $("#toastHost");
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity 220ms ease";
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 240);
  }, duration);
}

function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("");
}

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  if (!m) return { r: 94, g: 92, b: 230 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function hexToRgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  const d = max - min;
  if (d === 0) { h = 0; s = 0; }
  else {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = 60 * (((g - b) / d) % 6); break;
      case g: h = 60 * ((b - r) / d + 2); break;
      default: h = 60 * ((r - g) / d + 4);
    }
  }
  if (h < 0) h += 360;
  return { h, s, l };
}

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r, g, b;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

function adjustHsl(hex, { dh = 0, ds = 0, dl = 0 } = {}) {
  const { r, g, b } = hexToRgb(hex);
  let { h, s, l } = rgbToHsl(r, g, b);
  h = (h + dh + 360) % 360;
  s = clamp(s + ds, 0, 1);
  l = clamp(l + dl, 0, 1);
  const rgb = hslToRgb(h, s, l);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

/* ============================================================
   4. EXTRACTION DE PALETTE DEPUIS UNE IMAGE
   Quantification par bucket de teinte (24 buckets de 15°),
   pondérée par saturation pour privilégier les couleurs
   "caractéristiques" plutôt que le fond neutre.
   ============================================================ */

function extractPalette(img) {
  const SAMPLE = 96;
  const ratio = img.naturalWidth / img.naturalHeight;
  let sw = SAMPLE, sh = SAMPLE;
  if (ratio > 1) sh = Math.round(SAMPLE / ratio);
  else sw = Math.round(SAMPLE * ratio);
  sw = Math.max(sw, 1); sh = Math.max(sh, 1);

  const canvas = document.createElement("canvas");
  canvas.width = sw; canvas.height = sh;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, sw, sh);

  let data;
  try {
    data = ctx.getImageData(0, 0, sw, sh).data;
  } catch (e) {
    return { primary: "#5E5CE6", secondary: "#2DD4BF", accent: "#F472B6" };
  }

  const buckets = new Map();
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 200) continue;
    const { h, s, l } = rgbToHsl(r, g, b);
    if (l < 0.04 || l > 0.97) continue;
    const weight = (0.25 + s) * (1 - Math.abs(l - 0.5) * 0.6);
    const bucketKey = Math.round(h / 15) % 24;
    const bucket = buckets.get(bucketKey) || { r: 0, g: 0, b: 0, w: 0 };
    bucket.w += weight;
    bucket.r += r * weight;
    bucket.g += g * weight;
    bucket.b += b * weight;
    buckets.set(bucketKey, bucket);
  }

  const sorted = Array.from(buckets.values()).filter((b) => b.w > 0).sort((a, b) => b.w - a.w);
  const bucketColor = (b) => rgbToHex(b.r / b.w, b.g / b.w, b.b / b.w);

  let primary, secondary, accent;
  if (sorted.length === 0) {
    primary = "#5E5CE6"; secondary = "#2DD4BF"; accent = "#F472B6";
  } else {
    primary = bucketColor(sorted[0]);
    secondary = sorted[1] ? bucketColor(sorted[1]) : adjustHsl(primary, { dh: 40 });
    accent = sorted[2] ? bucketColor(sorted[2]) : adjustHsl(primary, { dh: -50, ds: 0.15 });
  }
  return { primary, secondary, accent };
}

function buildTheme(palette) {
  const { primary, secondary, accent } = palette;
  const p = hexToRgb(primary);
  const pHsl = rgbToHsl(p.r, p.g, p.b);
  const bgDeep = hslToRgb(pHsl.h, clamp(pHsl.s * 0.55, 0, 0.55), 0.07);
  const bgMid = hslToRgb(pHsl.h, clamp(pHsl.s * 0.5, 0, 0.5), 0.13);
  return {
    primary, secondary, accent,
    bgDeep: rgbToHex(bgDeep.r, bgDeep.g, bgDeep.b),
    bgMid: rgbToHex(bgMid.r, bgMid.g, bgMid.b),
  };
}

const DEFAULT_THEME = buildTheme({ primary: "#5E5CE6", secondary: "#2DD4BF", accent: "#F472B6" });

/* ============================================================
   5. MOTEUR DE RENDU CANVAS
   Dessine l'affiche complète à n'importe quelle résolution.
   ============================================================ */

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, maxWidth, maxLines = Infinity) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length >= maxLines) { line = ""; break; }
    } else {
      line = test;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && lines.length > 0) {
    let last = lines[lines.length - 1];
    while (ctx.measureText(last + "…").width > maxWidth && last.length > 1) {
      last = last.slice(0, -1);
    }
  }
  return lines;
}

function fitFontSize(ctx, text, maxWidth, startSize, minSize, weight, family) {
  let size = startSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

function pickTopStats(statsObj, n = 5) {
  return Object.entries(statsObj || {})
    .map(([key, value]) => {
      const def = STAT_DEFS.find((s) => s.key === key);
      return { key, label: def ? def.label : key, value: Number(value) || 0 };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

function formatTotalTime(totalMinutes) {
  const hours = Math.round(totalMinutes / 60);
  if (hours < 48) return `${hours} h de visionnage`;
  const days = Math.round(hours / 24);
  return `≈ ${days} jours de visionnage`;
}

function drawGlassPill(ctx, x, y, w, h, bgColor, textColor, label, fontSize, translucent) {
  ctx.save();
  roundRectPath(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = bgColor;
  ctx.fill();
  if (translucent) {
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = Math.max(1, fontSize * 0.06);
    ctx.stroke();
  }
  ctx.fillStyle = textColor;
  ctx.font = `700 ${fontSize}px Manrope, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + w / 2, y + h / 2 + fontSize * 0.04);
  ctx.restore();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function drawGlassPanel(ctx, x, y, w, h, r, theme) {
  ctx.save();
  roundRectPath(ctx, x, y, w, h, r);
  const fill = ctx.createLinearGradient(0, y, 0, y + h);
  fill.addColorStop(0, "rgba(20,20,24,0.62)");
  fill.addColorStop(1, "rgba(10,10,12,0.82)");
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.save();
  roundRectPath(ctx, x, y, w, h, r);
  ctx.clip();
  const reflection = ctx.createLinearGradient(0, y, 0, y + h * 0.18);
  reflection.addColorStop(0, "rgba(255,255,255,0.16)");
  reflection.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = reflection;
  ctx.fillRect(x, y, w, h * 0.18);

  const bloom = ctx.createRadialGradient(x + w * 0.85, y + h * 0.95, 0, x + w * 0.85, y + h * 0.95, w * 0.6);
  bloom.addColorStop(0, hexToRgba(theme.accent, 0.18));
  bloom.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = bloom;
  ctx.fillRect(x, y, w, h);
  ctx.restore();

  roundRectPath(ctx, x, y, w, h, r);
  const borderGrad = ctx.createLinearGradient(x, y, x, y + h);
  borderGrad.addColorStop(0, "rgba(255,255,255,0.45)");
  borderGrad.addColorStop(0.3, "rgba(255,255,255,0.12)");
  borderGrad.addColorStop(1, "rgba(255,255,255,0.06)");
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.stroke();
  ctx.restore();
}

function drawChipsRow(ctx, genres, x, y, maxWidth, u, accentRgb) {
  let cx = x, cy = y;
  const chipH = u(40), gap = u(12);
  ctx.font = `600 ${u(19)}px Inter, sans-serif`;
  for (const g of genres) {
    const w = ctx.measureText(g).width + u(34);
    if (cx + w > x + maxWidth && cx > x) { cx = x; cy += chipH + gap; }
    roundRectPath(ctx, cx, cy, w, chipH, chipH / 2);
    ctx.fillStyle = `rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},0.16)`;
    ctx.fill();
    ctx.strokeStyle = `rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},0.4)`;
    ctx.lineWidth = u(1.2);
    ctx.stroke();
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(g, cx + w / 2, cy + chipH / 2 + u(1));
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    cx += w + gap;
  }
  return cy + chipH;
}

function drawStatGauges(ctx, stats, x, y, w, u, primaryRgb, accentRgb) {
  const rowH = u(34);
  const labelW = w * 0.34;
  const barX = x + labelW + u(16);
  const barW = w - labelW - u(16);
  let cy = y;
  for (const s of stats) {
    ctx.font = `600 ${u(20)}px Inter, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillText(s.label, x, cy + rowH / 2);

    const trackH = u(8);
    const trackY = cy + rowH / 2 - trackH / 2;
    roundRectPath(ctx, barX, trackY, barW, trackH, trackH / 2);
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.fill();

    const fillW = barW * clamp(s.value / 100, 0, 1);
    if (fillW > 1) {
      roundRectPath(ctx, barX, trackY, fillW, trackH, trackH / 2);
      const grad = ctx.createLinearGradient(barX, 0, barX + fillW, 0);
      grad.addColorStop(0, `rgba(${primaryRgb.r},${primaryRgb.g},${primaryRgb.b},0.95)`);
      grad.addColorStop(1, `rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},0.95)`);
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.save();
      ctx.shadowColor = `rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},0.9)`;
      ctx.shadowBlur = u(10);
      ctx.beginPath();
      ctx.arc(barX + fillW - trackH / 2, trackY + trackH / 2, trackH * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.restore();
    }
    ctx.textBaseline = "alphabetic";
    cy += rowH;
  }
  return cy;
}

function drawBadgesRow(ctx, badges, x, y, maxWidth, u, theme) {
  let cx = x;
  const chipH = u(46), gap = u(12);
  ctx.font = `800 ${u(17)}px Manrope, sans-serif`;
  for (const b of badges) {
    const w = ctx.measureText(b).width + u(36);
    if (cx + w > x + maxWidth) break;
    roundRectPath(ctx, cx, y, w, chipH, chipH / 2);
    const grad = ctx.createLinearGradient(cx, y, cx + w, y);
    grad.addColorStop(0, hexToRgba(theme.primary, 0.9));
    grad.addColorStop(1, hexToRgba(theme.accent, 0.9));
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(b, cx + w / 2, y + chipH / 2 + u(1));
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    cx += w + gap;
  }
  return y + chipH;
}

function countChipRows(ctx, items, maxWidth, u, gapU, padU) {
  let cx = 0, rows = 1;
  for (const item of items) {
    const w = ctx.measureText(item).width + u(padU);
    if (cx + w > maxWidth && cx > 0) { cx = 0; rows += 1; }
    cx += w + u(gapU);
  }
  return rows;
}

/**
 * Calcule la hauteur de contenu nécessaire à l'intérieur du panneau,
 * sans rien dessiner. Réutilise exactement les mêmes tailles de police
 * et largeurs que renderPanelContent, pour que la mesure soit fiable.
 */
function measurePanelContentHeight(ctx, data, contentW, u) {
  let h = u(58); // padding haut

  const titleText = data.title || "Titre de l'anime";
  const titleSize = fitFontSize(ctx, titleText, contentW, u(82), u(46), 800, "Manrope, sans-serif");
  ctx.font = `800 ${titleSize}px Manrope, sans-serif`;
  const titleLines = wrapText(ctx, titleText, contentW, 2);
  h += titleLines.length * titleSize * 1.08 + u(6);

  if (data.subtitle) {
    ctx.font = `600 ${u(30)}px Inter, sans-serif`;
    const subLines = wrapText(ctx, data.subtitle, contentW, 1);
    h += subLines.length * u(40);
  }
  h += u(22);

  const metaParts = [];
  if (data.studio) metaParts.push(data.studio);
  if (data.releaseDate) metaParts.push(String(data.releaseDate).slice(0, 4));
  if (data.episodes) metaParts.push(`${data.episodes} épisodes`);
  if (data.minutesPerEpisode && data.episodes) metaParts.push(formatTotalTime(data.episodes * data.minutesPerEpisode));
  if (metaParts.length) h += u(40);

  h += u(18);

  if (Array.isArray(data.genres) && data.genres.length) {
    ctx.font = `600 ${u(19)}px Inter, sans-serif`;
    const rows = countChipRows(ctx, data.genres.slice(0, 5), contentW, u, 12, 34);
    h += rows * u(40) + (rows - 1) * u(12) + u(26);
  }

  if (data.synopsis) {
    ctx.font = `400 ${u(25)}px Inter, sans-serif`;
    const synLines = wrapText(ctx, data.synopsis, contentW, 3);
    h += synLines.length * u(36) + u(24);
  }

  h += u(1.5) + u(32); // séparateur + marge

  const statsToShow = (data.statsDisplay || []).slice(0, 5);
  if (statsToShow.length) h += statsToShow.length * u(34) + u(24);

  if (Array.isArray(data.badges) && data.badges.length) h += u(46);

  h += u(48); // padding bas
  return h;
}


/**
 * Dessine l'affiche complète sur le canvas fourni.
 * @param {HTMLCanvasElement} canvas
 * @param {object} data - une copie de state.current (+ statsDisplay)
 * @param {object} format - { w, h } taille logique de base
 * @param {number} scale - multiplicateur de résolution export
 */
function renderPoster(canvas, data, format, scale = 1) {
  const W = Math.round(format.w * scale);
  const H = Math.round(format.h * scale);
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const u = (v) => v * (W / 1000);

  const theme = data.theme || DEFAULT_THEME;
  const primaryRgb = hexToRgb(theme.primary);
  const accentRgb = hexToRgb(theme.accent);
  const secondaryRgb = hexToRgb(theme.secondary);

  ctx.clearRect(0, 0, W, H);

  /* ---- Background ---- */
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, theme.bgMid);
  bgGrad.addColorStop(0.55, theme.bgDeep);
  bgGrad.addColorStop(1, "#050506");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  const glow1 = ctx.createRadialGradient(W * 0.5, H * 0.08, 0, W * 0.5, H * 0.08, W * 0.9);
  glow1.addColorStop(0, `rgba(${primaryRgb.r},${primaryRgb.g},${primaryRgb.b},0.35)`);
  glow1.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, W, H);

  /* ---- Cover image + panel sizing (dynamique selon le contenu) ---- */
  const panelPadX = u(48);
  const panelSideMargin = u(60);
  const contentWForMeasure = (W - panelSideMargin * 2) - panelPadX * 2;
  ctx.save();
  const measuredContentH = measurePanelContentHeight(ctx, data, contentWForMeasure, u);
  ctx.restore();

  const imgTop = u(190);
  const bottomMargin = u(78); // réserve l'espace du footer "CRÉÉ AVEC POSTER STUDIO"
  const panelTopGap = u(50); // chevauchement entre bas d'image et haut du panneau
  const availableForImgAndPanel = H - imgTop - bottomMargin;
  // l'image et le panneau se chevauchent de panelTopGap, donc:
  // imgHeight + panelH - panelTopGap = availableForImgAndPanel
  const desiredImgHeight = availableForImgAndPanel - measuredContentH + panelTopGap;
  // bornes en proportion de l'espace disponible : le panneau garde toujours
  // au moins ~24% de hauteur (contenu très court) et au plus ~78% (contenu long)
  const imgHeightMin = availableForImgAndPanel * 0.22;
  const imgHeightMax = availableForImgAndPanel * 0.76;
  const imgHeight = clamp(desiredImgHeight, imgHeightMin, imgHeightMax);
  const imgBottom = imgTop + imgHeight;

  if (data.coverImageEl) {
    ctx.save();
    roundRectPath(ctx, u(60), imgTop, W - u(120), imgHeight, u(34));
    ctx.clip();

    const img = data.coverImageEl;
    const targetW = W - u(120), targetH = imgHeight;
    const scaleCover = Math.max(targetW / img.naturalWidth, targetH / img.naturalHeight);
    const dw = img.naturalWidth * scaleCover, dh = img.naturalHeight * scaleCover;
    const dx = u(60) + (targetW - dw) / 2, dy = imgTop + (targetH - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);

    const fade = ctx.createLinearGradient(0, imgTop, 0, imgBottom);
    fade.addColorStop(0, "rgba(0,0,0,0)");
    fade.addColorStop(0.7, "rgba(0,0,0,0)");
    fade.addColorStop(1, "rgba(8,8,10,0.55)");
    ctx.fillStyle = fade;
    ctx.fillRect(u(60), imgTop, W - u(120), imgHeight);

    const sheen = ctx.createLinearGradient(0, imgTop, 0, imgTop + imgHeight * 0.3);
    sheen.addColorStop(0, "rgba(255,255,255,0.10)");
    sheen.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sheen;
    ctx.fillRect(u(60), imgTop, W - u(120), imgHeight * 0.3);
    ctx.restore();

    ctx.save();
    roundRectPath(ctx, u(60), imgTop, W - u(120), imgHeight, u(34));
    ctx.lineWidth = u(2);
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.stroke();
    ctx.restore();
  } else {
    ctx.save();
    roundRectPath(ctx, u(60), imgTop, W - u(120), imgHeight, u(34));
    const ph = ctx.createLinearGradient(0, imgTop, 0, imgBottom);
    ph.addColorStop(0, `rgba(${primaryRgb.r},${primaryRgb.g},${primaryRgb.b},0.35)`);
    ph.addColorStop(1, `rgba(${secondaryRgb.r},${secondaryRgb.g},${secondaryRgb.b},0.2)`);
    ctx.fillStyle = ph;
    ctx.fill();
    ctx.font = `600 ${u(28)}px Inter, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.textAlign = "center";
    ctx.fillText("Aucune image sélectionnée", W / 2, (imgTop + imgBottom) / 2);
    ctx.textAlign = "left";
    ctx.restore();
  }

  /* ---- Top label row ---- */
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  const topRowY = u(110);
  const pillH = u(54);

  ctx.font = `700 ${u(22)}px Manrope, sans-serif`;
  const typeLabel = (data.type || "ANIME").toUpperCase();
  const typeLabelW = ctx.measureText(typeLabel).width + u(48);
  drawGlassPill(ctx, u(60), topRowY, typeLabelW, pillH, `rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},0.9)`, "#fff", typeLabel, u(22), false);

  let statusW = 0;
  if (data.status) {
    ctx.font = `700 ${u(22)}px Manrope, sans-serif`;
    const statusLabel = data.status.toUpperCase();
    statusW = ctx.measureText(statusLabel).width + u(48);
    drawGlassPill(ctx, u(60) + typeLabelW + u(14), topRowY, statusW, pillH, "rgba(255,255,255,0.12)", "#fff", statusLabel, u(22), true);
  }

  if (data.ranking) {
    const rankLabel = `#${data.ranking}`;
    ctx.font = `800 ${u(22)}px Manrope, sans-serif`;
    const rankW = ctx.measureText(rankLabel).width + u(46);
    drawGlassPill(ctx, W - u(60) - rankW, topRowY, rankW, pillH, "rgba(255,255,255,0.95)", theme.bgDeep, rankLabel, u(22), false);
  }

  /* ---- Glass panel ---- */
  const panelY = imgBottom - panelTopGap;
  const panelH = Math.max(measuredContentH, H - panelY - bottomMargin);
  const panelX = u(60);
  const panelW = W - u(120);
  drawGlassPanel(ctx, panelX, panelY, panelW, panelH, u(40), theme);

  /* ---- Panel content ---- */
  let cursorY = panelY + u(58);
  const padX = panelX + u(48);
  const contentW = panelW - u(96);

  const titleText = data.title || "Titre de l'anime";
  const titleSize = fitFontSize(ctx, titleText, contentW, u(82), u(46), 800, "Manrope, sans-serif");
  ctx.font = `800 ${titleSize}px Manrope, sans-serif`;
  ctx.fillStyle = "#FFFFFF";
  const titleLines = wrapText(ctx, titleText, contentW, 2);
  for (const line of titleLines) {
    ctx.fillText(line, padX, cursorY + titleSize * 0.78);
    cursorY += titleSize * 1.08;
  }
  cursorY += u(6);

  if (data.subtitle) {
    ctx.font = `600 ${u(30)}px Inter, sans-serif`;
    ctx.fillStyle = `rgba(${accentRgb.r},${accentRgb.g},${accentRgb.b},1)`;
    const subLines = wrapText(ctx, data.subtitle, contentW, 1);
    for (const line of subLines) {
      ctx.fillText(line, padX, cursorY + u(24));
      cursorY += u(40);
    }
  }
  cursorY += u(22);

  const metaParts = [];
  if (data.studio) metaParts.push(data.studio);
  if (data.releaseDate) metaParts.push(String(data.releaseDate).slice(0, 4));
  if (data.episodes) metaParts.push(`${data.episodes} épisodes`);
  if (data.minutesPerEpisode && data.episodes) metaParts.push(formatTotalTime(data.episodes * data.minutesPerEpisode));
  if (metaParts.length) {
    ctx.font = `500 ${u(23)}px "Geist Mono", monospace`;
    ctx.fillStyle = "rgba(255,255,255,0.62)";
    const metaLines = wrapText(ctx, metaParts.join("   ·   "), contentW, 1);
    ctx.fillText(metaLines[0] || "", padX, cursorY + u(18));
    cursorY += u(40);
  }

  if (data.rating != null && data.rating !== "") {
    const ratingX = panelX + panelW - u(48);
    const ratingY = panelY + u(70);
    ctx.textAlign = "right";
    ctx.font = `800 ${u(56)}px Manrope, sans-serif`;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(Number(data.rating).toFixed(1), ratingX, ratingY);
    ctx.font = `600 ${u(20)}px Inter, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText("/ 10", ratingX, ratingY + u(28));
    ctx.textAlign = "left";
  }

  cursorY += u(18);

  if (Array.isArray(data.genres) && data.genres.length) {
    cursorY = drawChipsRow(ctx, data.genres.slice(0, 5), padX, cursorY, contentW, u, accentRgb);
    cursorY += u(26);
  }

  if (data.synopsis) {
    ctx.font = `400 ${u(25)}px Inter, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    const synLines = wrapText(ctx, data.synopsis, contentW, 3);
    for (const line of synLines) {
      ctx.fillText(line, padX, cursorY + u(20));
      cursorY += u(36);
    }
    cursorY += u(24);
  }

  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = u(1.5);
  ctx.beginPath();
  ctx.moveTo(padX, cursorY);
  ctx.lineTo(padX + contentW, cursorY);
  ctx.stroke();
  cursorY += u(32);

  const statsToShow = (data.statsDisplay || []).slice(0, 5);
  if (statsToShow.length) {
    cursorY = drawStatGauges(ctx, statsToShow, padX, cursorY, contentW, u, primaryRgb, accentRgb);
    cursorY += u(24);
  }

  if (Array.isArray(data.badges) && data.badges.length) {
    drawBadgesRow(ctx, data.badges.slice(0, 4), padX, cursorY, contentW, u, theme);
  }

  /* ---- Footer ---- */
  ctx.font = `500 ${u(16)}px "Geist Mono", monospace`;
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.textAlign = "center";
  ctx.fillText("CRÉÉ AVEC POSTER STUDIO", W / 2, H - u(20));
  ctx.textAlign = "left";
}

/* ============================================================
   6. ÉDITEUR — liaison des champs, accordéons, sliders, badges
   ============================================================ */

let renderTimer = null;
function scheduleRender(immediate = false) {
  if (renderTimer) { clearTimeout(renderTimer); renderTimer = null; }
  if (immediate) { doRender(); return; }
  renderTimer = setTimeout(doRender, 90);
}

function buildRenderData() {
  const c = state.current;
  return { ...c, statsDisplay: pickTopStats(c.stats, 5) };
}

function doRender() {
  const canvas = $("#posterCanvas");
  if (!canvas) return;
  renderPoster(canvas, buildRenderData(), state.format, 1);
  applyZoomToCanvas();
}

function initAccordions() {
  $$(".editor__header").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.accordion;
      const panel = $(`.editor__body[data-panel="${key}"]`);
      const expanded = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!expanded));
      if (panel) panel.hidden = expanded;
    });
  });
}

function bindTextField(id, key, transform) {
  const el = $(id);
  if (!el) return;
  const fn = transform || ((v) => v);
  el.addEventListener("input", () => {
    state.current[key] = fn(el.value);
    scheduleRender();
  });
}

function initFieldBindings() {
  bindTextField("#f-title", "title");
  bindTextField("#f-subtitle", "subtitle");
  bindTextField("#f-synopsis", "synopsis");
  bindTextField("#f-type", "type");
  bindTextField("#f-genres", "genres", parseCsv);
  bindTextField("#f-episodes", "episodes", (v) => (v === "" ? null : Number(v)));
  bindTextField("#f-seasons", "seasons", (v) => (v === "" ? null : Number(v)));
  bindTextField("#f-minutes", "minutesPerEpisode", (v) => (v === "" ? 24 : Number(v)));
  bindTextField("#f-rating", "rating", (v) => (v === "" ? null : Number(v)));
  bindTextField("#f-ranking", "ranking", (v) => (v === "" ? null : Number(v)));
  bindTextField("#f-popularity", "popularity", (v) => (v === "" ? null : Number(v)));
  bindTextField("#f-author", "author");
  bindTextField("#f-studio", "studio");
  bindTextField("#f-release", "releaseDate");
  bindTextField("#f-status", "status");
  bindTextField("#f-character", "favoriteCharacter");
  bindTextField("#f-arc", "favoriteArc");
  bindTextField("#f-opening", "favoriteOpening");
  bindTextField("#f-awards", "awards", parseCsv);

  $("#f-format").addEventListener("change", (e) => {
    const [w, h] = e.target.value.split("x").map(Number);
    state.format = { w, h };
    $("#stageDims").textContent = `${w} × ${h}`;
    state.zoom = computeFitZoom();
    scheduleRender(true);
  });

  $("#f-resolution").addEventListener("change", (e) => {
    $("#exportWarning").hidden = e.target.value !== "6000";
  });

  $("#exportBtn").addEventListener("click", handleExport);

  $("#exportTopBtn").addEventListener("click", () => {
    const header = $('.editor__header[data-accordion="export"]');
    header.setAttribute("aria-expanded", "true");
    $('.editor__body[data-panel="export"]').hidden = false;
    header.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  $("#saveCollectionBtn").addEventListener("click", addCurrentToCollection);

  $("#newPosterBtn").addEventListener("click", () => {
    if (confirm("Créer une nouvelle affiche ? Les modifications non sauvegardées seront perdues.")) {
      resetCurrent();
    }
  });
}

function renderStatSliders() {
  const body = $("#statsBody");
  body.innerHTML = STAT_DEFS.map((s) => `
    <div class="stat-row">
      <div class="stat-row__top">
        <span class="stat-row__name">${escapeHtml(s.label)}</span>
        <span class="stat-row__value" data-stat-value="${s.key}">${state.current.stats[s.key]}</span>
      </div>
      <input type="range" min="0" max="100" value="${state.current.stats[s.key]}" data-stat="${s.key}">
    </div>
  `).join("");

  $$("input[data-stat]", body).forEach((input) => {
    input.addEventListener("input", () => {
      const key = input.dataset.stat;
      state.current.stats[key] = Number(input.value);
      const valueEl = $(`[data-stat-value="${key}"]`, body);
      if (valueEl) valueEl.textContent = input.value;
      scheduleRender();
    });
  });
}

function renderBadgeOptions() {
  const body = $("#badgesBody");
  body.innerHTML = BADGE_DEFS.map((b) => `
    <label class="badge-option">
      <input type="checkbox" value="${escapeHtml(b)}" ${state.current.badges.includes(b) ? "checked" : ""}>
      <span>${escapeHtml(b)}</span>
    </label>
  `).join("");

  $$("input[type=checkbox]", body).forEach((cb) => {
    cb.addEventListener("change", () => {
      const val = cb.value;
      if (cb.checked) {
        if (!state.current.badges.includes(val)) state.current.badges.push(val);
      } else {
        state.current.badges = state.current.badges.filter((b) => b !== val);
      }
      scheduleRender();
    });
  });
}

function renderThemeSwatches(theme) {
  $("#themePreview").hidden = false;
  $("#themeSwatches").innerHTML = `
    <div class="swatch" style="background:${theme.primary}" data-name="Principale"></div>
    <div class="swatch" style="background:${theme.secondary}" data-name="Secondaire"></div>
    <div class="swatch" style="background:${theme.accent}" data-name="Accent"></div>
  `;
}

function initImageUpload() {
  const dropzone = $("#dropzone");
  const input = $("#f-image");

  input.addEventListener("change", () => {
    if (input.files && input.files[0]) handleImageFile(input.files[0]);
  });

  ["dragenter", "dragover"].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add("is-dragover"); });
  });
  ["dragleave", "drop"].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove("is-dragover"); });
  });
  dropzone.addEventListener("drop", (e) => {
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) handleImageFile(file);
  });
}

function handleImageFile(file) {
  if (!file.type.startsWith("image/")) { showToast("Format non supporté : choisissez une image."); return; }
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    const img = new Image();
    img.onload = () => {
      state.current.coverImage = dataUrl;
      state.current.coverImageEl = img;
      const theme = buildTheme(extractPalette(img));
      state.current.theme = theme;
      renderThemeSwatches(theme);
      scheduleRender(true);
      showToast("Image importée — palette générée automatiquement");
    };
    img.onerror = () => showToast("Impossible de charger cette image.");
    img.src = dataUrl;
  };
  reader.onerror = () => showToast("Erreur de lecture du fichier.");
  reader.readAsDataURL(file);
}

function computeFitZoom() {
  const viewport = $("#stageViewport");
  if (!viewport) return 1;
  const availW = viewport.clientWidth - 80;
  const availH = viewport.clientHeight - 80;
  const scale = Math.min(availW / state.format.w, availH / state.format.h, 1);
  return Math.max(scale, 0.05);
}

function applyZoomToCanvas() {
  const canvas = $("#posterCanvas");
  canvas.style.width = `${state.format.w * state.zoom}px`;
  canvas.style.height = `${state.format.h * state.zoom}px`;
  $("#zoomLabel").textContent = `${Math.round(state.zoom * 100)}%`;
}

function initZoomControls() {
  $("#zoomInBtn").addEventListener("click", () => {
    state.zoom = Math.min(state.zoom * 1.2, 2);
    applyZoomToCanvas();
  });
  $("#zoomOutBtn").addEventListener("click", () => {
    state.zoom = Math.max(state.zoom / 1.2, 0.08);
    applyZoomToCanvas();
  });
  window.addEventListener("resize", () => {
    if (state.view === "studio") {
      state.zoom = computeFitZoom();
      applyZoomToCanvas();
    }
  });
}

/* ============================================================
   7. EXPORT — PNG / WEBP / JPG / PDF, résolutions 1×–8×
   ============================================================ */

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function exportAsPdf(canvas, filenameBase) {
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.95));
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  const w = canvas.width, h = canvas.height;
  const ptW = (w / 300) * 72;
  const ptH = (h / 300) * 72;

  const enc = new TextEncoder();
  const chunks = [];
  let offset = 0;
  const offsets = [];

  function push(strOrBytes) {
    const b = typeof strOrBytes === "string" ? enc.encode(strOrBytes) : strOrBytes;
    chunks.push(b);
    offset += b.length;
  }

  push("%PDF-1.4\n");
  offsets[1] = offset; push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  offsets[2] = offset; push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  offsets[3] = offset; push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ptW.toFixed(2)} ${ptH.toFixed(2)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`);
  offsets[4] = offset; push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`);
  push(bytes);
  push("\nendstream\nendobj\n");

  const content = `q ${ptW.toFixed(2)} 0 0 ${ptH.toFixed(2)} 0 0 cm /Im0 Do Q`;
  offsets[5] = offset; push(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);

  const xrefStart = offset;
  push("xref\n0 6\n0000000000 65535 f \n");
  for (let i = 1; i <= 5; i++) push(offsets[i].toString().padStart(10, "0") + " 00000 n \n");
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

  const totalLen = chunks.reduce((a, c) => a + c.length, 0);
  const finalBytes = new Uint8Array(totalLen);
  let p = 0;
  for (const c of chunks) { finalBytes.set(c, p); p += c.length; }

  downloadBlob(new Blob([finalBytes], { type: "application/pdf" }), `${filenameBase}-print.pdf`);
}

// Mégapixels max raisonnables pour un canvas exporté côté navigateur.
// Au-delà, le rendu devient extrêmement lent ou peut planter l'onglet.
const MAX_EXPORT_MEGAPIXELS = 60;

function computeExportMultiplier(targetValue, baseFormat) {
  if (targetValue <= 1) return 1; // option "Aperçu — taille de base"
  const targetHeight = targetValue;
  let mult = targetHeight / baseFormat.h;
  mult = Math.max(mult, 1);
  // plafonne pour ne jamais dépasser MAX_EXPORT_MEGAPIXELS
  const mp = (baseFormat.w * mult * baseFormat.h * mult) / 1e6;
  if (mp > MAX_EXPORT_MEGAPIXELS) {
    mult = mult * Math.sqrt(MAX_EXPORT_MEGAPIXELS / mp);
  }
  return mult;
}

async function handleExport() {
  const targetValue = Number($("#f-resolution").value);
  const resolutionMult = computeExportMultiplier(targetValue, state.format);
  const filetype = $("#f-filetype").value;
  const overlay = $("#exportOverlay");
  const overlayText = $("#exportOverlayText");
  overlay.hidden = false;
  overlayText.textContent = targetValue >= 6000
    ? "Rendu 8K en cours — cela peut prendre quelques secondes…"
    : "Rendu de l'affiche en cours…";

  await new Promise((r) => setTimeout(r, 30));

  try {
    const exportCanvas = document.createElement("canvas");
    renderPoster(exportCanvas, buildRenderData(), state.format, resolutionMult);

    const filenameBase = (state.current.title || "affiche").trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "affiche";

    if (filetype === "pdf") {
      await exportAsPdf(exportCanvas, filenameBase);
    } else {
      const mime = filetype === "png" ? "image/png" : filetype === "webp" ? "image/webp" : "image/jpeg";
      const quality = filetype === "jpg" ? 0.97 : undefined;
      const blob = await new Promise((resolve) => exportCanvas.toBlob(resolve, mime, quality));
      const ext = filetype === "jpg" ? "jpg" : filetype;
      downloadBlob(blob, `${filenameBase}-${exportCanvas.width}x${exportCanvas.height}.${ext}`);
    }
    showToast("Export terminé — téléchargement lancé");
  } catch (err) {
    console.error(err);
    showToast("Une erreur est survenue pendant l'export.");
  } finally {
    overlay.hidden = true;
  }
}


/* ============================================================
   8. COLLECTION — persistance, recherche, filtres, favoris
   ============================================================ */

function loadCollection() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.collection);
    state.collection = raw ? JSON.parse(raw) : [];
  } catch { state.collection = []; }
  try {
    const rawFav = localStorage.getItem(STORAGE_KEYS.favorites);
    state.favorites = new Set(rawFav ? JSON.parse(rawFav) : []);
  } catch { state.favorites = new Set(); }
}

function persistCollection() {
  try {
    localStorage.setItem(STORAGE_KEYS.collection, JSON.stringify(state.collection));
    localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(Array.from(state.favorites)));
  } catch {
    showToast("Stockage local indisponible : la collection ne sera pas sauvegardée.");
  }
}

async function seedFromJsonIfEmpty() {
  if (state.collection.length > 0) return;
  try {
    const res = await fetch("anime.json", { cache: "no-store" });
    if (!res.ok) return;
    const json = await res.json();
    state.collection = (json.items || []).map((item) => ({
      id: item.id || uid(),
      title: item.title || "", subtitle: item.subtitle || "", synopsis: item.synopsis || "",
      type: item.type || "Anime", genres: item.genres || [],
      episodes: item.episodes ?? null, seasons: item.seasons ?? null,
      minutesPerEpisode: item.minutesPerEpisode ?? 24,
      rating: item.rating ?? null, ranking: item.ranking ?? null, popularity: item.popularity ?? null,
      author: item.author || "", studio: item.studio || "", releaseDate: item.releaseDate || "",
      status: item.status || "En cours",
      favoriteCharacter: item.favoriteCharacter || "", favoriteArc: item.favoriteArc || "",
      favoriteOpening: item.favoriteOpening || "", awards: item.awards || [],
      stats: { ...DEFAULT_STATS, ...(item.stats || {}) },
      badges: item.badges || [], coverImage: item.coverImage || null, theme: null,
    }));
    persistCollection();
    renderFilterChips();
    renderCollectionGrid();
  } catch {
    /* anime.json absent ou inaccessible (ex. ouverture via file://) — ignoré silencieusement */
  }
}

function addCurrentToCollection() {
  const c = state.current;
  if (!c.title || !c.title.trim()) { showToast("Ajoutez au moins un titre avant d'enregistrer."); return; }

  const id = c.id || uid();
  const entry = { ...c, id };
  delete entry.coverImageEl;

  const existingIdx = state.collection.findIndex((x) => x.id === id);
  if (existingIdx >= 0) state.collection[existingIdx] = entry;
  else state.collection.unshift(entry);

  state.current.id = id;
  persistCollection();
  renderFilterChips();
  renderCollectionGrid();
  showToast("Affiche ajoutée à votre collection");
}

function resetCurrent() {
  state.current = emptyPoster();
  $$(".field__input").forEach((el) => {
    if (el.tagName === "SELECT") return;
    el.value = "";
  });
  $("#f-minutes").value = 24;
  $("#f-status").value = "En cours";
  $("#f-type").value = "Anime";
  $("#themePreview").hidden = true;
  renderStatSliders();
  renderBadgeOptions();
  scheduleRender(true);
}

function loadIntoEditor(item) {
  const c = { ...item, stats: { ...DEFAULT_STATS, ...(item.stats || {}) } };
  state.current = c;

  $("#f-title").value = c.title || "";
  $("#f-subtitle").value = c.subtitle || "";
  $("#f-synopsis").value = c.synopsis || "";
  $("#f-type").value = c.type || "Anime";
  $("#f-genres").value = (c.genres || []).join(", ");
  $("#f-episodes").value = c.episodes ?? "";
  $("#f-seasons").value = c.seasons ?? "";
  $("#f-minutes").value = c.minutesPerEpisode ?? 24;
  $("#f-rating").value = c.rating ?? "";
  $("#f-ranking").value = c.ranking ?? "";
  $("#f-popularity").value = c.popularity ?? "";
  $("#f-author").value = c.author || "";
  $("#f-studio").value = c.studio || "";
  $("#f-release").value = c.releaseDate || "";
  $("#f-status").value = c.status || "En cours";
  $("#f-character").value = c.favoriteCharacter || "";
  $("#f-arc").value = c.favoriteArc || "";
  $("#f-opening").value = c.favoriteOpening || "";
  $("#f-awards").value = (c.awards || []).join(", ");

  if (c.coverImage) {
    const img = new Image();
    img.onload = () => {
      state.current.coverImageEl = img;
      if (!state.current.theme) state.current.theme = buildTheme(extractPalette(img));
      renderThemeSwatches(state.current.theme);
      scheduleRender(true);
    };
    img.src = c.coverImage;
  } else {
    $("#themePreview").hidden = true;
  }

  renderStatSliders();
  renderBadgeOptions();
  scheduleRender(true);
  switchView("studio");
}

function deleteFromCollection(id) {
  state.collection = state.collection.filter((x) => x.id !== id);
  state.favorites.delete(id);
  persistCollection();
  renderFilterChips();
  renderCollectionGrid();
  showToast("Affiche supprimée de la collection");
}

function toggleFavorite(id) {
  if (state.favorites.has(id)) state.favorites.delete(id);
  else state.favorites.add(id);
  persistCollection();
  renderCollectionGrid();
}

function getAllGenres() {
  const set = new Set();
  state.collection.forEach((item) => (item.genres || []).forEach((g) => set.add(g)));
  return Array.from(set).sort();
}

function renderFilterChips() {
  const bar = $("#filtersBar");
  $$(".chip[data-genre]", bar).forEach((c) => c.remove());
  getAllGenres().forEach((g) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.dataset.genre = g;
    btn.textContent = g;
    btn.addEventListener("click", () => {
      state.activeFilter = state.activeFilter === g ? "all" : g;
      syncFilterChipsUI();
      renderCollectionGrid();
    });
    bar.appendChild(btn);
  });
  syncFilterChipsUI();
}

function syncFilterChipsUI() {
  $$(".chip", $("#filtersBar")).forEach((chip) => {
    const isAll = chip.dataset.filter === "all";
    const isFav = chip.dataset.filter === "favorites";
    const matches = isAll
      ? state.activeFilter === "all"
      : isFav ? state.activeFilter === "favorites" : chip.dataset.genre === state.activeFilter;
    chip.classList.toggle("is-active", matches);
  });
}

function getFilteredItems() {
  let items = state.collection;
  if (state.activeFilter === "favorites") items = items.filter((it) => state.favorites.has(it.id));
  else if (state.activeFilter !== "all") items = items.filter((it) => (it.genres || []).includes(state.activeFilter));

  const q = state.searchQuery.trim().toLowerCase();
  if (q) {
    items = items.filter((it) => {
      const haystack = [it.title, it.subtitle, it.studio, it.author, ...(it.genres || [])].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }
  return items;
}

function renderCard(item, index) {
  const isFav = state.favorites.has(item.id);
  const cover = item.coverImage
    ? `<div class="card__cover" style="background-image:url('${item.coverImage}')"><div class="card__cover-gradient"></div></div>`
    : `<div class="card__cover" style="background:linear-gradient(135deg, rgba(94,92,230,0.5), rgba(45,212,191,0.35))"><div class="card__cover-fallback">${escapeHtml(item.title || "")}</div></div>`;

  const metaBits = [];
  if (item.episodes) metaBits.push(`${item.episodes} ép.`);
  if (item.rating != null && item.rating !== "") metaBits.push(`★ ${Number(item.rating).toFixed(1)}`);

  return `
    <article class="card" data-id="${item.id}" style="animation-delay:${Math.min(index * 25, 300)}ms">
      ${cover}
      <button class="card__fav ${isFav ? "is-active" : ""}" data-id="${item.id}" aria-label="Favori" type="button">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="${isFav ? "currentColor" : "none"}"><path d="M12 17.3l-5.4 3.2 1.4-6.1L3 10l6.2-.5L12 3.7l2.8 5.8L21 10l-5 4.4 1.4 6.1z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
      </button>
      <div class="card__meta">${metaBits.map((m) => `<span class="tag-pill">${escapeHtml(m)}</span>`).join("")}</div>
      <div class="card__body">
        <div class="card__title">${escapeHtml(item.title || "Sans titre")}</div>
        <div class="card__sub">${escapeHtml(item.studio || item.subtitle || "")}</div>
      </div>
    </article>
  `;
}

function renderCollectionGrid() {
  const grid = $("#collectionGrid");
  const empty = $("#collectionEmpty");
  const items = getFilteredItems();
  grid.dataset.layout = state.collectionLayout;

  if (items.length === 0) {
    grid.innerHTML = "";
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  grid.innerHTML = items.map((item, i) => renderCard(item, i)).join("");

  $$(".card", grid).forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest(".card__fav")) return;
      const item = state.collection.find((x) => x.id === card.dataset.id);
      if (item) loadIntoEditor(item);
    });
  });
  $$(".card__fav", grid).forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFavorite(btn.dataset.id);
    });
  });
}

function initCollectionToolbar() {
  $("#searchInput").addEventListener("input", (e) => {
    state.searchQuery = e.target.value;
    renderCollectionGrid();
  });

  $$(".view-switch__btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.collectionLayout = btn.dataset.layout;
      $$(".view-switch__btn").forEach((b) => b.classList.toggle("is-active", b === btn));
      renderCollectionGrid();
    });
  });

  $('.chip[data-filter="all"]').addEventListener("click", () => {
    state.activeFilter = "all";
    syncFilterChipsUI();
    renderCollectionGrid();
  });
  $('.chip[data-filter="favorites"]').addEventListener("click", () => {
    state.activeFilter = state.activeFilter === "favorites" ? "all" : "favorites";
    syncFilterChipsUI();
    renderCollectionGrid();
  });
}

/* ============================================================
   9. NAVIGATION ENTRE VUES
   ============================================================ */

function switchView(view) {
  state.view = view;
  $$(".topbar__tab").forEach((tab) => {
    const active = tab.dataset.view === view;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  $("#view-studio").classList.toggle("is-active", view === "studio");
  $("#view-collection").classList.toggle("is-active", view === "collection");

  if (view === "studio") {
    requestAnimationFrame(() => {
      state.zoom = computeFitZoom();
      scheduleRender(true);
    });
  }
}

function initNav() {
  $$(".topbar__tab").forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });
}

/* ============================================================
   10. BOOTSTRAP
   ============================================================ */

function initEditor() {
  initAccordions();
  initFieldBindings();
  renderStatSliders();
  renderBadgeOptions();
  initImageUpload();
  initZoomControls();
  state.zoom = computeFitZoom();
  scheduleRender(true);
}

document.addEventListener("DOMContentLoaded", () => {
  loadCollection();
  initNav();
  initEditor();
  initCollectionToolbar();
  renderFilterChips();
  renderCollectionGrid();
  seedFromJsonIfEmpty();
});
