"use strict";

const $ = (id) => document.getElementById(id);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const SVG_NS = "http://www.w3.org/2000/svg";

const PALETTES = {
  cosmic: { name: "星际蓝橙", colors: { primary: "#2457e6", accent: "#ff8a3d", light: "#f4f1e8", dark: "#263448", glass: "#7cc9db" }, code: "CO" },
  forest: { name: "森林绿意", colors: { primary: "#25765a", accent: "#a4c86a", light: "#f2e6c9", dark: "#35463f", glass: "#82b7b0" }, code: "FO" },
  candy: { name: "糖果乐园", colors: { primary: "#e86a92", accent: "#ffd166", light: "#f7ecff", dark: "#614a7e", glass: "#7d67d9" }, code: "CA" },
  mono: { name: "极简黑白", colors: { primary: "#37474f", accent: "#90a4ae", light: "#eceff1", dark: "#20262b", glass: "#b0bec5" }, code: "MO" }
};
const TYPE_LABELS = { space: "太空基地", architecture: "建筑场景", vehicle: "未来车辆", robot: "机器人", animal: "机械动物" };
const DIFFICULTY_LABELS = { easy: "轻松入门", medium: "进阶挑战", hard: "细节大师" };
const SIZE_LABELS = { small: "小巧", medium: "标准", large: "震撼" };
const MODEL_LABELS = { space: "ORBITAL HABITAT", architecture: "MODULAR PAVILION", vehicle: "NOVA ROVER", robot: "TURING BOT", animal: "MECHA CREATURE" };
const COLOR_NAMES = { primary: "主色", accent: "强调色", light: "浅色", dark: "深色", glass: "透明色" };
const PART_NAMES = { brick: "基础砖", plate: "薄板", tile: "光面板", slope: "斜面砖", round: "圆顶砖" };
const PART_PREFIX = { brick: "BR", plate: "PL", tile: "TL", slope: "SL", round: "RD" };

const state = {
  design: null,
  rotation: 0,
  zoom: 1,
  activeLayer: 0,
  activeStep: 0,
  spare: true,
  generation: 0,
  orderQty: 1
};

function hashString(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function seeded(seed) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => ((value = value * 16807 % 2147483647) - 1) / 2147483646;
}

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function sum(list, selector = (v) => v) { return list.reduce((total, item) => total + selector(item), 0); }
function unique(list) { return [...new Set(list)]; }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]); }

function shade(hex, amount) {
  const value = hex.replace("#", "");
  const num = parseInt(value, 16);
  const r = clamp((num >> 16) + amount, 0, 255);
  const g = clamp(((num >> 8) & 255) + amount, 0, 255);
  const b = clamp((num & 255) + amount, 0, 255);
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

function createBuilder(size) {
  const n = { small: 14, medium: 16, large: 18 }[size];
  const bricks = [];
  const occupied = new Set();
  let serial = 0;
  function add(x, y, z, w = 1, d = 1, color = "primary", type = "brick") {
    x = Math.round(x); y = Math.round(y); z = Math.round(z);
    if (x < 0 || y < 0 || z < 0 || x + w > n || y + d > n) return false;
    for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < d; dy++) {
      if (occupied.has(`${x + dx},${y + dy},${z}`)) return false;
    }
    for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < d; dy++) occupied.add(`${x + dx},${y + dy},${z}`);
    bricks.push({ id: `b${++serial}`, x, y, z, w, d, h: 1, color, type });
    return true;
  }
  function fill(x0, y0, x1, y1, z, color = "primary", type = "brick", colorFn = null) {
    for (let y = y0; y <= y1;) {
      const d = y + 1 <= y1 ? 2 : 1;
      for (let x = x0; x <= x1;) {
        const remaining = x1 - x + 1;
        const w = remaining >= 4 ? 4 : remaining >= 3 ? 3 : remaining >= 2 ? 2 : 1;
        add(x, y, z, w, d, colorFn ? colorFn(x, y) : color, type);
        x += w;
      }
      y += d;
    }
  }
  return { n, bricks, add, fill };
}

function generateSpace(builder, difficulty, random) {
  const { n, add, fill } = builder;
  const mid = Math.floor(n / 2);
  const coreHeight = { easy: 2, medium: 3, hard: 4 }[difficulty];
  fill(2, 2, n - 3, n - 3, 0, "light", "plate");
  for (let z = 1; z <= coreHeight; z++) {
    fill(5, 6, n - 6, 10, z, "light", "brick", (x, y) => (y === 6 && z > 1 ? "glass" : (z === 1 ? "primary" : "light")));
    if (z <= 2) {
      fill(2, 6, 4, 10, z, z === 2 ? "glass" : "primary");
      fill(n - 5, 6, n - 3, 10, z, z === 2 ? "glass" : "primary");
    }
  }
  fill(4, 5, n - 5, 11, coreHeight + 1, "primary", "slope");
  fill(mid - 2, 12, mid + 1, 14, 1, "dark");
  for (let z = 2; z <= coreHeight + 2; z++) fill(mid - 2, 12, mid + 1, 14, z, z % 2 ? "light" : "primary");
  fill(mid - 1, 12, mid, 13, coreHeight + 3, "accent", "tile");
  add(mid, 12, coreHeight + 4, 1, 1, "dark", "round");
  add(mid, 12, coreHeight + 5, 1, 1, "accent", "round");
  fill(0, 2, 3, 5, 0, "primary", "plate");
  fill(n - 4, 2, n - 1, 5, 0, "primary", "plate");
  fill(0, 2, 3, 5, 1, "dark", "tile", (x, y) => ((x + y) % 2 ? "glass" : "primary"));
  fill(n - 4, 2, n - 1, 5, 1, "dark", "tile", (x, y) => ((x + y) % 2 ? "glass" : "primary"));
  [[2, 2], [n - 3, 2], [2, n - 3], [n - 3, n - 3]].forEach(([x, y]) => add(x, y, 1, 1, 1, "accent", "round"));
  if (difficulty !== "easy") {
    fill(mid - 3, 7, mid + 2, 8, coreHeight + 2, "accent", "tile");
    add(3, 12, 1, 2, 2, "accent", "round");
    add(n - 5, 12, 1, 2, 2, "accent", "round");
  }
  if (difficulty === "hard") {
    for (let x = 4; x <= n - 5; x += 3) add(x, 3, 1, 1, 1, random() > .5 ? "accent" : "glass", "round");
    fill(mid - 1, 5, mid, 5, coreHeight + 2, "glass", "tile");
  }
}

function generateArchitecture(builder, difficulty) {
  const { n, add, fill } = builder;
  const h = { easy: 3, medium: 4, hard: 5 }[difficulty];
  fill(2, 2, n - 3, n - 3, 0, "light", "plate");
  fill(3, 3, n - 4, n - 4, 1, "light", "tile");
  [[4, 4], [n - 5, 4], [4, n - 5], [n - 5, n - 5]].forEach(([x, y]) => {
    for (let z = 2; z <= h; z++) add(x, y, z, 1, 1, z === h ? "accent" : "primary");
  });
  for (let z = 2; z < h; z++) {
    fill(5, 4, n - 6, 4, z, z === h - 1 ? "glass" : "light");
    if (difficulty === "hard") fill(4, 5, 4, n - 6, z, "glass");
  }
  for (let x = 5; x <= n - 6; x += 2) {
    add(x, n - 4, 2, 1, 1, "primary");
    add(x, n - 4, 3, 1, 1, "accent", "tile");
  }
  fill(3, 3, n - 4, n - 4, h + 1, "primary", "slope");
  fill(5, 5, n - 6, n - 6, h + 2, "accent", "tile");
  if (difficulty !== "easy") fill(7, 7, n - 8, n - 8, h + 3, "light", "tile");
  fill(6, n - 3, n - 7, n - 2, 1, "accent", "slope");
  fill(6, n - 5, n - 7, n - 5, 2, "light");
  add(5, 7, 2, 3, 1, "accent");
  add(n - 8, 7, 2, 3, 1, "accent");
  if (difficulty === "hard") {
    for (let x = 4; x <= n - 5; x += 3) add(x, 4, h + 2, 1, 1, "glass", "round");
    add(Math.floor(n / 2), Math.floor(n / 2), h + 4, 1, 1, "accent", "round");
  }
}

function generateVehicle(builder, difficulty) {
  const { n, add, fill } = builder;
  fill(3, 5, n - 4, 10, 1, "dark", "plate");
  [[3, 5], [3, 9], [n - 5, 5], [n - 5, 9]].forEach(([x, y]) => add(x, y, 0, 2, 2, "dark", "round"));
  fill(2, 5, n - 3, 10, 2, "primary");
  fill(3, 6, 6, 9, 3, "accent", "slope");
  fill(7, 6, n - 6, 9, 3, "glass");
  fill(8, 6, n - 7, 9, 4, "light", "tile");
  fill(n - 5, 5, n - 3, 10, 3, "primary", "slope");
  add(n - 3, 6, 2, 1, 1, "light", "tile");
  add(n - 3, 9, 2, 1, 1, "light", "tile");
  add(2, 6, 3, 1, 3, "dark");
  if (difficulty !== "easy") {
    add(2, 4, 4, 1, 1, "dark");
    add(2, 11, 4, 1, 1, "dark");
    fill(1, 4, 3, 11, 5, "accent", "tile");
    add(Math.floor(n / 2), 7, 5, 1, 1, "accent", "round");
  }
  if (difficulty === "hard") {
    for (let x = 4; x < n - 4; x += 2) {
      add(x, 4, 2, 1, 1, "glass", "round");
      add(x, 11, 2, 1, 1, "glass", "round");
    }
    add(n - 4, 7, 4, 2, 2, "accent", "round");
  }
}

function generateRobot(builder, difficulty) {
  const { n, add, fill } = builder;
  const mid = Math.floor(n / 2);
  fill(3, 4, n - 4, 11, 0, "light", "plate");
  fill(4, 7, 6, 10, 1, "dark");
  fill(n - 7, 7, n - 5, 10, 1, "dark");
  for (let z = 2; z <= 4; z++) {
    fill(4, 7, 5, 8, z, z === 3 ? "accent" : "primary");
    fill(n - 6, 7, n - 5, 8, z, z === 3 ? "accent" : "primary");
  }
  for (let z = 5; z <= 7; z++) fill(5, 6, n - 6, 9, z, z === 6 ? "light" : "primary");
  fill(mid - 1, 9, mid, 9, 6, "accent", "tile");
  add(mid - 1, 9, 7, 2, 1, "glass", "tile");
  for (let z = 5; z <= 7; z++) {
    fill(3, 6, 4, 8, z, z === 7 ? "dark" : "primary");
    fill(n - 5, 6, n - 4, 8, z, z === 7 ? "dark" : "primary");
  }
  fill(6, 6, n - 7, 9, 8, "light");
  fill(6, 6, n - 7, 9, 9, "light", "tile");
  add(7, 9, 9, 1, 1, "glass", "tile");
  add(n - 8, 9, 9, 1, 1, "glass", "tile");
  fill(7, 7, n - 8, 8, 10, "primary", "slope");
  add(mid, 7, 11, 1, 1, "accent", "round");
  if (difficulty !== "easy") {
    add(3, 7, 4, 2, 2, "accent", "round");
    add(n - 5, 7, 4, 2, 2, "accent", "round");
    fill(mid - 2, 6, mid + 1, 6, 8, "glass", "tile");
  }
  if (difficulty === "hard") {
    for (let x = 5; x <= n - 6; x += 2) add(x, 5, 8, 1, 1, "accent", "round");
    add(mid, 7, 12, 1, 1, "glass", "round");
  }
}

function generateAnimal(builder, difficulty) {
  const { n, add, fill } = builder;
  for (let z = 3; z <= 5; z++) fill(4, 6, n - 6, 10, z, z === 4 ? "light" : "primary");
  [[5, 6], [5, 9], [n - 8, 6], [n - 8, 9]].forEach(([x, y]) => {
    for (let z = 1; z <= 2; z++) add(x, y, z, 2, 2, z === 1 ? "dark" : "primary");
    add(x, y + 1, 0, 2, 1, "dark");
  });
  fill(1, 7, 4, 9, 2, "primary", "slope");
  fill(2, 7, 4, 9, 3, "accent", "slope");
  for (let z = 5; z <= 7; z++) fill(n - 6, 7, n - 4, 9, z, z === 6 ? "accent" : "primary");
  fill(n - 5, 6, n - 2, 10, 8, "light");
  fill(n - 4, 6, n - 2, 10, 9, "primary", "slope");
  add(n - 3, 6, 9, 1, 1, "glass", "tile");
  add(n - 3, 10, 9, 1, 1, "glass", "tile");
  for (let x = 5; x <= n - 7; x += 2) add(x, 8, 6, 1, 1, "accent", "round");
  if (difficulty !== "easy") {
    add(n - 2, 7, 10, 1, 1, "accent", "round");
    add(n - 2, 9, 10, 1, 1, "accent", "round");
    fill(4, 5, n - 6, 5, 4, "glass", "tile");
  }
  if (difficulty === "hard") {
    for (let x = 4; x <= n - 5; x += 3) add(x, 10, 6, 1, 1, "light", "round");
    add(n - 2, 8, 10, 1, 1, "dark", "round");
  }
}

function modelName(type, prompt) {
  if (prompt.includes("火星")) return "火星前哨站";
  if (prompt.includes("湖") || prompt.includes("观景台")) return "湖边观景台";
  if (prompt.includes("恐龙")) return "机械小恐龙";
  const names = { space: "星际探索基地", architecture: "模块化创意建筑", vehicle: "新星探索车", robot: "图灵伙伴机器人", animal: "机械森林伙伴" };
  return names[type];
}

function parseRequest() {
  const prompt = $("prompt").value.trim() || "设计一个适合展示和搭建的创意积木模型";
  let type = $("modelType").value;
  if (/火星|太空|星际|空间站|前哨/.test(prompt)) type = "space";
  if (/建筑|房屋|湖边|观景台|城堡|别墅/.test(prompt) && !/空间站/.test(prompt)) type = "architecture";
  if (/车|跑车| rover/i.test(prompt)) type = "vehicle";
  if (/机器人|机械人/.test(prompt)) type = "robot";
  if (/恐龙|动物|小猫|小狗|宠物/.test(prompt)) type = "animal";
  let palette = $$(".palette.selected")[0]?.dataset.value || "cosmic";
  if (/蓝橙|蓝白|太空蓝/.test(prompt)) palette = "cosmic";
  if (/森林|绿色|绿意|蓝绿/.test(prompt)) palette = "forest";
  if (/糖果|粉色|紫色|乐园/.test(prompt)) palette = "candy";
  if (/黑白|极简|灰色/.test(prompt)) palette = "mono";
  let difficulty = $("difficulty").value;
  if (/简单|入门|轻松|低龄/.test(prompt)) difficulty = "easy";
  if (/复杂|大师|高难度|精细/.test(prompt)) difficulty = "hard";
  let size = $(".segmented .selected")?.dataset.value || "medium";
  if (/小巧|小型|迷你/.test(prompt)) size = "small";
  if (/大型|震撼|大尺寸/.test(prompt)) size = "large";
  const budgetMatch = prompt.match(/(\d{3,5})\s*(?:元|块|人民币)/);
  const budget = budgetMatch ? Number(budgetMatch[1]) : clamp(Number($("budget").value) || 600, 99, 9999);
  $("modelType").value = type;
  $("difficulty").value = difficulty;
  $("budget").value = budget;
  selectControl("sizeControl", size);
  selectControl("paletteControl", palette);
  $("paletteName").textContent = PALETTES[palette].name;
  return { prompt, type, palette, difficulty, size, budget };
}

function generateDesign(request) {
  const builder = createBuilder(request.size);
  const seed = hashString(`${request.prompt}|${request.type}|${request.palette}|${request.difficulty}|${request.size}|${state.generation}`);
  const random = seeded(seed);
  const generators = { space: generateSpace, architecture: generateArchitecture, vehicle: generateVehicle, robot: generateRobot, animal: generateAnimal };
  generators[request.type](builder, request.difficulty, random);
  const design = {
    id: `BM-${String(seed % 90000 + 10000)}`,
    name: modelName(request.type, request.prompt),
    request,
    n: builder.n,
    bricks: builder.bricks,
    createdAt: new Date().toISOString()
  };
  design.bom = buildBom(design);
  design.steps = buildSteps(design);
  design.pricing = calculatePricing(design);
  return design;
}

function partPrice(brick) {
  const area = brick.w * brick.d;
  const base = { brick: .42, plate: .30, tile: .42, slope: .62, round: .68 }[brick.type];
  const factor = { brick: .16, plate: .11, tile: .14, slope: .18, round: .20 }[brick.type];
  return Math.round((base + area * factor) * 100) / 100;
}

function colorCode(color) { return { primary: "A", accent: "B", light: "L", dark: "D", glass: "T" }[color] || "X"; }
function buildBom(design) {
  const groups = new Map();
  design.bricks.forEach((brick) => {
    const key = `${brick.type}-${brick.w}x${brick.d}-${brick.color}`;
    if (!groups.has(key)) groups.set(key, {
      key,
      sku: `${PART_PREFIX[brick.type]}-${brick.w}X${brick.d}-${PALETTES[design.request.palette].code}${colorCode(brick.color)}`,
      type: brick.type,
      w: brick.w,
      d: brick.d,
      color: brick.color,
      qty: 0,
      unitPrice: partPrice(brick)
    });
    groups.get(key).qty += 1;
  });
  return [...groups.values()].map((item) => ({ ...item, spareQty: Math.max(1, Math.ceil(item.qty * .05)) })).sort((a, b) => b.qty - a.qty || a.sku.localeCompare(b.sku));
}

function buildSteps(design) {
  const layers = unique(design.bricks.map((b) => b.z)).sort((a, b) => a - b);
  let cumulative = 0;
  return layers.map((z, index) => {
    const bricks = design.bricks.filter((b) => b.z === z);
    cumulative += bricks.length;
    const title = index === 0 ? "搭建稳固底座" : index === layers.length - 1 ? "安装顶部与细节" : `完成第 ${z + 1} 层结构`;
    const mainType = [...bricks].sort((a, b) => (b.w * b.d) - (a.w * a.d))[0];
    return {
      index,
      z,
      title,
      bricks,
      count: bricks.length,
      cumulative,
      description: index === 0
        ? "按照图纸先摆放底层零件，确认边缘齐平，再逐块按压固定。底座越平整，后续结构越稳定。"
        : `参考第 ${z + 1} 层图纸，从中心向外安装${PART_NAMES[mainType.type]}。先定位大件，再补齐小件，最后检查连接是否牢固。`
    };
  });
}

function orderBom(design = state.design) {
  return design.bom.map((item) => ({ ...item, orderQty: item.qty + (state.spare ? item.spareQty : 0) }));
}
function calculatePricing(design) {
  const parts = Math.round(sum(orderBom(design), (item) => item.orderQty * item.unitPrice) * 100) / 100;
  return { parts, design: 39, packing: 12, shipping: 0, total: Math.round((parts + 51) * 100) / 100 };
}

function rotateBrick(brick, n, rotation) {
  const r = ((rotation % 4) + 4) % 4;
  if (r === 1) return { ...brick, x: n - brick.y - brick.d, y: brick.x, w: brick.d, d: brick.w };
  if (r === 2) return { ...brick, x: n - brick.x - brick.w, y: n - brick.y - brick.d };
  if (r === 3) return { ...brick, x: brick.y, y: n - brick.x - brick.w, w: brick.d, d: brick.w };
  return { ...brick };
}

function renderIso(svg, bricks, options = {}) {
  if (!state.design) return;
  const design = state.design;
  const width = options.width || 800;
  const height = options.height || 520;
  const zoom = options.zoom || 1;
  const rotation = options.rotation ?? state.rotation;
  const maxZ = Math.max(...design.bricks.map((b) => b.z + b.h), 1);
  const unit = Math.min(width / (design.n * 2.25), height / (design.n + maxZ * 2 + 4)) * zoom;
  const originX = width / 2;
  const originY = height * .66 + maxZ * unit * .18;
  const palette = PALETTES[design.request.palette].colors;
  const highlights = new Set(options.highlights || []);
  const dimmed = options.dimmed || false;
  function point(x, y, z) { return [originX + (x - y - design.n / 2 + design.n / 2) * unit, originY + (x + y - design.n) * unit * .5 - z * unit * .76]; }
  function points(list) { return list.map((p) => p.map((v) => v.toFixed(2)).join(",")).join(" "); }
  const transformed = bricks.map((brick) => rotateBrick(brick, design.n, rotation));
  transformed.sort((a, b) => (a.x + a.y + (a.w + a.d) / 2 + a.z * 2) - (b.x + b.y + (b.w + b.d) / 2 + b.z * 2));
  let content = `<ellipse cx="${originX}" cy="${originY + unit * .8}" rx="${design.n * unit * .64}" ry="${design.n * unit * .19}" fill="#8794a7" opacity=".12"/>`;
  transformed.forEach((brick) => {
    const { x, y, z, w, d, h } = brick;
    const color = palette[brick.color] || palette.primary;
    const top = points([point(x, y, z + h), point(x + w, y, z + h), point(x + w, y + d, z + h), point(x, y + d, z + h)]);
    const right = points([point(x + w, y, z), point(x + w, y + d, z), point(x + w, y + d, z + h), point(x + w, y, z + h)]);
    const left = points([point(x, y + d, z), point(x + w, y + d, z), point(x + w, y + d, z + h), point(x, y + d, z + h)]);
    const active = highlights.has(brick.id);
    const opacity = dimmed && !active ? .22 : 1;
    const stroke = active ? "#ff7a32" : shade(color, -42);
    content += `<g opacity="${opacity}" stroke-linejoin="round">`;
    content += `<polygon points="${right}" fill="${shade(color, -45)}" stroke="${stroke}" stroke-width="${active ? 1.4 : .55}"/>`;
    content += `<polygon points="${left}" fill="${shade(color, -25)}" stroke="${stroke}" stroke-width="${active ? 1.4 : .55}"/>`;
    content += `<polygon points="${top}" fill="${active ? "#ffad69" : shade(color, 10)}" stroke="${stroke}" stroke-width="${active ? 1.5 : .55}"/>`;
    if (options.studs !== false) {
      for (let sx = 0; sx < w; sx++) for (let sy = 0; sy < d; sy++) {
        const [cx, cy] = point(x + sx + .5, y + sy + .5, z + h + .03);
        content += `<ellipse cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" rx="${(unit * .19).toFixed(2)}" ry="${(unit * .095).toFixed(2)}" fill="${active ? "#ffc293" : shade(color, 24)}" stroke="${shade(color, -24)}" stroke-width=".35"/>`;
      }
    }
    content += `<title>${PART_NAMES[brick.type]} ${w}×${d} · ${COLOR_NAMES[brick.color]}</title></g>`;
  });
  svg.innerHTML = content;
}

function renderAll() {
  const d = state.design;
  if (!d) return;
  d.pricing = calculatePricing(d);
  $("projectName").textContent = d.name;
  $("projectId").textContent = d.id;
  $("modelLabel").textContent = `${MODEL_LABELS[d.request.type]} ${String(state.generation + 1).padStart(2, "0")}`;
  $("pieceMetric").textContent = d.bricks.length;
  $("stepMetric").textContent = d.steps.length;
  $("timeMetric").textContent = Math.max(12, Math.round(d.bricks.length * ({ easy: .22, medium: .28, hard: .34 }[d.request.difficulty])));
  $("dimensionMetric").textContent = `${(d.n * .8).toFixed(1)}×${(d.n * .8).toFixed(1)}cm`;
  $("partsTabCount").textContent = d.bom.length;
  $("miniModelName").textContent = d.name;
  $("summaryType").textContent = TYPE_LABELS[d.request.type];
  $("summaryPalette").textContent = PALETTES[d.request.palette].name;
  $("summaryDifficulty").textContent = DIFFICULTY_LABELS[d.request.difficulty];
  $("summaryPieces").textContent = d.bricks.length;
  renderPrice();
  renderIso($("modelCanvas"), d.bricks, { width: 800, height: 520 });
  renderIso($("miniCanvas"), d.bricks, { width: 340, height: 190, zoom: .95, studs: false, rotation: 0 });
  renderBlueprint();
  renderSteps();
  renderParts();
}

function renderPrice() {
  const d = state.design;
  const p = d.pricing;
  const [yuan, cents] = p.total.toFixed(2).split(".");
  $("totalPrice").textContent = yuan;
  document.querySelector(".main-price small").textContent = `.${cents}`;
  $("partPrice").textContent = `¥${p.parts.toFixed(2)}`;
  const diff = d.request.budget - p.total;
  const status = $("budgetStatus");
  status.classList.toggle("over", diff < 0);
  status.querySelector("span").textContent = diff >= 0 ? `在预算内，还可预留 ¥${diff.toFixed(0)}` : `超出预算 ¥${Math.abs(diff).toFixed(0)}，可尝试小巧规格`;
}

function renderBlueprint() {
  const d = state.design;
  const layers = unique(d.bricks.map((b) => b.z)).sort((a, b) => a - b);
  state.activeLayer = clamp(state.activeLayer, 0, layers.length - 1);
  const z = layers[state.activeLayer];
  const current = d.bricks.filter((b) => b.z === z);
  const previous = d.bricks.filter((b) => b.z < z);
  const palette = PALETTES[d.request.palette].colors;
  const cell = Math.min(330 / d.n, 330 / d.n);
  const ox = 65, oy = 70;
  let s = `<text x="65" y="35" fill="#344054" font-size="14" font-weight="700">${escapeHtml(d.name)} · LAYER ${String(z + 1).padStart(2, "0")}</text>`;
  s += `<text x="65" y="53" fill="#8993a2" font-size="9">TOP VIEW · UNIT GRID ${d.n} × ${d.n}</text>`;
  for (let i = 0; i <= d.n; i++) {
    s += `<line x1="${ox + i * cell}" y1="${oy}" x2="${ox + i * cell}" y2="${oy + d.n * cell}" stroke="#dfe5ee" stroke-width=".6"/>`;
    s += `<line x1="${ox}" y1="${oy + i * cell}" x2="${ox + d.n * cell}" y2="${oy + i * cell}" stroke="#dfe5ee" stroke-width=".6"/>`;
  }
  previous.forEach((b) => {
    s += `<rect x="${ox + b.x * cell}" y="${oy + b.y * cell}" width="${b.w * cell}" height="${b.d * cell}" fill="none" stroke="#a8b2c1" stroke-width=".8" stroke-dasharray="3 2" opacity=".45"/>`;
  });
  current.forEach((b) => {
    const color = palette[b.color];
    s += `<rect x="${ox + b.x * cell + 1}" y="${oy + b.y * cell + 1}" width="${b.w * cell - 2}" height="${b.d * cell - 2}" rx="1.5" fill="${color}" stroke="${shade(color, -35)}" stroke-width="1"/>`;
    if (cell * Math.min(b.w, b.d) > 19) s += `<text x="${ox + (b.x + b.w / 2) * cell}" y="${oy + (b.y + b.d / 2) * cell + 3}" text-anchor="middle" fill="${shade(color, -70)}" font-size="8" font-weight="700">${b.w}×${b.d}</text>`;
  });
  for (let i = 0; i < d.n; i += 2) {
    s += `<text x="${ox + (i + .5) * cell}" y="${oy - 8}" text-anchor="middle" fill="#98a2b3" font-size="8">${i + 1}</text>`;
    s += `<text x="${ox - 14}" y="${oy + (i + .5) * cell + 3}" text-anchor="middle" fill="#98a2b3" font-size="8">${String.fromCharCode(65 + i)}</text>`;
  }
  const counts = {};
  current.forEach((b) => counts[b.color] = (counts[b.color] || 0) + 1);
  s += `<rect x="455" y="70" width="245" height="330" rx="12" fill="#ffffff" stroke="#e2e7ef"/>`;
  s += `<text x="480" y="104" fill="#4f5bd5" font-size="10" font-weight="700" letter-spacing="1">LAYER ${String(z + 1).padStart(2, "0")}</text>`;
  s += `<text x="480" y="137" fill="#1d2939" font-size="25" font-weight="700">${current.length}</text><text x="530" y="137" fill="#667085" font-size="11">个零件</text>`;
  s += `<text x="480" y="161" fill="#667085" font-size="10">本层面积 ${sum(current, (b) => b.w * b.d)} 单位 · 高度 ${z + 1} 层</text>`;
  let yy = 200;
  Object.entries(counts).forEach(([color, count]) => {
    s += `<circle cx="486" cy="${yy - 4}" r="5" fill="${palette[color]}"/><text x="502" y="${yy}" fill="#475467" font-size="11">${COLOR_NAMES[color]}</text><text x="665" y="${yy}" text-anchor="end" fill="#1d2939" font-size="11" font-weight="700">${count} 件</text>`;
    yy += 30;
  });
  s += `<text x="480" y="370" fill="#98a2b3" font-size="9">先定位大件，再补齐小件</text><text x="480" y="386" fill="#98a2b3" font-size="9">虚线为已完成下层结构</text>`;
  $("blueprintCanvas").innerHTML = s;
  $("layerLabel").textContent = `第 ${state.activeLayer + 1} 层 / 共 ${layers.length} 层`;
  $("layerPieceCount").textContent = `本层 ${current.length} 件`;
  $("prevLayer").disabled = state.activeLayer === 0;
  $("nextLayer").disabled = state.activeLayer === layers.length - 1;
}

function renderSteps() {
  const d = state.design;
  state.activeStep = clamp(state.activeStep, 0, d.steps.length - 1);
  $("stepList").innerHTML = d.steps.map((step, i) => `<button class="step-item ${i === state.activeStep ? "active" : ""}" data-step="${i}"><span class="step-number">${String(i + 1).padStart(2, "0")}</span><span><b>${escapeHtml(step.title)}</b><small>新增 ${step.count} 件 · 累计 ${step.cumulative} 件</small></span></button>`).join("");
  $$(".step-item", $("stepList")).forEach((button) => button.addEventListener("click", () => { state.activeStep = Number(button.dataset.step); renderSteps(); }));
  const step = d.steps[state.activeStep];
  const accumulated = d.bricks.filter((b) => b.z <= step.z);
  renderIso($("stepCanvas"), accumulated, { width: 520, height: 360, highlights: step.bricks.map((b) => b.id), dimmed: true, rotation: 0, zoom: .9 });
  $("stepPreviewLabel").textContent = `STEP ${String(state.activeStep + 1).padStart(2, "0")}`;
  $("stepPreviewCount").textContent = `新增 ${step.count} 件 · 共 ${step.cumulative} 件`;
  $("stepDescription").textContent = step.description;
  $("prevStep").disabled = state.activeStep === 0;
  $("nextStep").disabled = state.activeStep === d.steps.length - 1;
  $("nextStep").textContent = state.activeStep === d.steps.length - 1 ? "已完成" : "下一步";
}

function partIcon(item) {
  const color = PALETTES[state.design.request.palette].colors[item.color];
  const width = 22 + Math.min(item.w, 4) * 2;
  return `<svg viewBox="0 0 40 30" aria-hidden="true"><path d="M5 12 19 5 35 12 20 20Z" fill="${shade(color, 12)}" stroke="${shade(color, -35)}" stroke-width=".6"/><path d="M5 12v8l15 7v-7Z" fill="${shade(color, -25)}"/><path d="M20 20v7l15-8v-7Z" fill="${shade(color, -42)}"/><ellipse cx="${width / 2}" cy="9" rx="3" ry="1.5" fill="${shade(color, 25)}"/></svg>`;
}

function renderParts() {
  const d = state.design;
  const query = $("partsSearch").value.trim().toLowerCase();
  const items = orderBom(d).filter((item) => `${item.sku} ${item.w}x${item.d} ${PART_NAMES[item.type]}`.toLowerCase().includes(query));
  $("partsTableBody").innerHTML = items.length ? items.map((item) => `<tr><td><div class="part-cell"><span class="part-visual">${partIcon(item)}</span><span><b>${item.sku}</b><small>${PART_NAMES[item.type]}</small></span></div></td><td>${item.w}×${item.d} · <span class="color-dot" style="background:${PALETTES[d.request.palette].colors[item.color]}"></span>${COLOR_NAMES[item.color]}</td><td>¥${item.unitPrice.toFixed(2)}</td><td><span class="qty-pill">${item.orderQty}</span>${state.spare ? `<span class="spare-qty">+${item.spareQty}</span>` : ""}</td><td>¥${(item.orderQty * item.unitPrice).toFixed(2)}</td></tr>`).join("") : `<tr><td colspan="5" class="empty-row">没有匹配的零件，请更换关键词</td></tr>`;
  $("skuCount").textContent = d.bom.length;
  $("orderPieceCount").textContent = sum(orderBom(d), (item) => item.orderQty);
  $("partsSubtotal").textContent = `¥${d.pricing.parts.toFixed(2)}`;
  renderPrice();
}

function selectControl(id, value) {
  $$(`#${id} [data-value]`).forEach((button) => button.classList.toggle("selected", button.dataset.value === value));
}

function switchTab(name) {
  $$(".design-tab").forEach((button) => {
    const active = button.dataset.tab === name;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active);
  });
  $$(".tab-panel").forEach((panel) => {
    const active = panel.id === `${name}Panel`;
    panel.hidden = !active;
    panel.classList.toggle("active", active);
  });
  if (name === "blueprint") renderBlueprint();
  if (name === "instructions") renderSteps();
  if (name === "parts") renderParts();
}

function toast(message, type = "success") {
  const node = document.createElement("div");
  node.className = `toast ${type}`;
  node.textContent = message;
  $("toastRegion").appendChild(node);
  setTimeout(() => node.remove(), 3300);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function exportCsv() {
  const d = state.design;
  const rows = [["零件编号", "类型", "规格", "颜色", "设计数量", "备损数量", "订购数量", "单价(元)", "小计(元)"]];
  orderBom(d).forEach((item) => rows.push([item.sku, PART_NAMES[item.type], `${item.w}x${item.d}`, COLOR_NAMES[item.color], item.qty, state.spare ? item.spareQty : 0, item.orderQty, item.unitPrice.toFixed(2), (item.orderQty * item.unitPrice).toFixed(2)]));
  rows.push([], ["方案名称", d.name], ["方案编号", d.id], ["零件费用", d.pricing.parts.toFixed(2)], ["设计服务", "39.00"], ["分拣包装", "12.00"], ["预估合计", d.pricing.total.toFixed(2)]);
  downloadBlob(new Blob(["﻿" + rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }), `${d.name}-零件清单.csv`);
  toast("零件清单 CSV 已导出");
}

function exportJson(data = state.design, name = `${state.design.name}-完整方案.json`) {
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" }), name);
}

function exportPng() {
  const svg = $("modelCanvas").cloneNode(true);
  svg.setAttribute("xmlns", SVG_NS);
  svg.setAttribute("width", "1600");
  svg.setAttribute("height", "1040");
  const source = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1600; canvas.height = 1040;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createRadialGradient(800, 420, 50, 800, 500, 800);
    gradient.addColorStop(0, "#ffffff"); gradient.addColorStop(1, "#edf0f5");
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1600, 1040);
    ctx.drawImage(image, 0, 0, 1600, 1040);
    ctx.fillStyle = "#526071"; ctx.font = "600 28px sans-serif"; ctx.fillText(`${state.design.name} · ${state.design.id}`, 60, 990);
    canvas.toBlob((png) => { if (png) downloadBlob(png, `${state.design.name}-成品效果图.png`); }, "image/png");
    URL.revokeObjectURL(url);
    toast("成品效果图 PNG 已导出");
  };
  image.onerror = () => { URL.revokeObjectURL(url); toast("图片导出失败，请使用完整方案 JSON 备份", "error"); };
  image.src = url;
}

function printManual() {
  const d = state.design;
  $("printArea").innerHTML = `<h1>${escapeHtml(d.name)} · 搭建说明书</h1><p>方案编号：${escapeHtml(d.id)}　零件：${d.bricks.length} 件　步骤：${d.steps.length} 步　难度：${DIFFICULTY_LABELS[d.request.difficulty]}</p><p>创意需求：${escapeHtml(d.request.prompt)}</p><h2>搭建步骤</h2>${d.steps.map((step, i) => `<div class="print-step"><h3>第 ${i + 1} 步：${escapeHtml(step.title)}</h3><p>本步新增 ${step.count} 件，累计 ${step.cumulative} 件。</p><p>${escapeHtml(step.description)}</p><p>本步零件：${step.bricks.map((b) => `${PART_NAMES[b.type]} ${b.w}×${b.d}（${COLOR_NAMES[b.color]}）`).join("、")}</p></div>`).join("")}<h2>零件清单</h2><table><thead><tr><th>编号</th><th>规格</th><th>颜色</th><th>设计数量</th><th>建议订购</th></tr></thead><tbody>${orderBom(d).map((item) => `<tr><td>${item.sku}</td><td>${PART_NAMES[item.type]} ${item.w}×${item.d}</td><td>${COLOR_NAMES[item.color]}</td><td>${item.qty}</td><td>${item.orderQty}</td></tr>`).join("")}</tbody></table><p>注意：本方案为 AI 参数化创意原型。大型、承重或公共展示结构需人工复核与实物打样。</p>`;
  document.body.classList.add("printing-manual");
  window.print();
  setTimeout(() => document.body.classList.remove("printing-manual"), 500);
}

function getSavedDesigns() {
  try { return JSON.parse(localStorage.getItem("brickmind.designs.v1") || "[]"); } catch { return []; }
}
function updateSavedCount() { $("savedCount").textContent = getSavedDesigns().length; }
function saveDesign() {
  try {
    const saved = getSavedDesigns().filter((item) => item.id !== state.design.id);
    saved.unshift(state.design);
    localStorage.setItem("brickmind.designs.v1", JSON.stringify(saved.slice(0, 12)));
    updateSavedCount();
    toast("方案已保存到「我的方案」");
  } catch { toast("浏览器存储不可用，请导出 JSON 保存", "error"); }
}
function showLibrary() {
  const saved = getSavedDesigns();
  $("savedDesigns").innerHTML = saved.length ? saved.map((d, i) => `<div class="saved-item"><span class="saved-item-icon">BM</span><div class="saved-item-info"><b>${escapeHtml(d.name)}</b><small>${d.bricks.length} 件 · ${d.steps.length} 步 · ${new Date(d.createdAt).toLocaleDateString("zh-CN")}</small></div><button data-load="${i}">打开</button></div>`).join("") : `<div class="empty-library">还没有保存的方案。<br>完成设计后，点击“保存”即可在这里找到它。</div>`;
  $$('[data-load]', $("savedDesigns")).forEach((button) => button.addEventListener("click", () => {
    state.design = saved[Number(button.dataset.load)];
    state.activeLayer = 0; state.activeStep = 0; state.rotation = 0; state.zoom = 1;
    syncFormFromDesign(state.design);
    renderAll();
    $("libraryDialog").close();
    toast(`已打开「${state.design.name}」`);
  }));
  $("libraryDialog").showModal();
}
function syncFormFromDesign(d) {
  $("prompt").value = d.request.prompt;
  $("modelType").value = d.request.type;
  $("difficulty").value = d.request.difficulty;
  $("budget").value = d.request.budget;
  selectControl("sizeControl", d.request.size);
  selectControl("paletteControl", d.request.palette);
  $("paletteName").textContent = PALETTES[d.request.palette].name;
  $("promptCount").textContent = d.request.prompt.length;
}

function updateOrderModal() {
  const d = state.design;
  const total = d.pricing.total * state.orderQty;
  $("orderModelName").textContent = d.name;
  $("orderModelMeta").textContent = `${sum(orderBom(d), (item) => item.orderQty)} 件零件（含备损） · ${state.orderQty} 套`;
  $("orderModalPrice").textContent = `¥${total.toFixed(2)}`;
  $("orderQty").value = state.orderQty;
}

function submitOrder(event) {
  event.preventDefault();
  if (!$("orderForm").reportValidity()) return;
  const d = state.design;
  const order = {
    intentId: `BRICK-${Date.now()}`,
    createdAt: new Date().toISOString(),
    status: "演示订购意向（未支付、未发货）",
    customer: { name: $("customerName").value.trim(), contact: $("customerContact").value.trim(), note: $("orderNote").value.trim() },
    design: { id: d.id, name: d.name, prompt: d.request.prompt },
    quantity: state.orderQty,
    bom: orderBom(d).map((item) => ({ sku: item.sku, spec: `${item.w}x${item.d}`, color: item.color, designQty: item.qty, orderQty: item.orderQty, unitPrice: item.unitPrice })),
    pricing: { unitPrice: d.pricing.total, total: Math.round(d.pricing.total * state.orderQty * 100) / 100, currency: "CNY" }
  };
  try {
    const orders = JSON.parse(localStorage.getItem("brickmind.orders.v1") || "[]");
    orders.unshift(order);
    localStorage.setItem("brickmind.orders.v1", JSON.stringify(orders.slice(0, 10)));
  } catch { /* JSON download still provides a copy. */ }
  exportJson(order, `${d.name}-订购意向单.json`);
  $("orderDialog").close();
  $("demoConsent").checked = false;
  toast("订购意向单已保存并下载，未产生真实支付");
}

async function handleGenerate(event) {
  event?.preventDefault();
  if ($("generateBtn").disabled) return;
  const request = parseRequest();
  $("generateBtn").disabled = true;
  $("generationOverlay").classList.add("active");
  $("projectStatus").textContent = "AI 正在生成";
  const statuses = ["理解需求与结构约束…", "组合零件并校验连接…", "生成图纸、步骤与清单…"];
  for (const status of statuses) {
    $("generationStatus").textContent = status;
    await new Promise((resolve) => setTimeout(resolve, 360));
  }
  state.generation += 1;
  state.design = generateDesign(request);
  state.rotation = 0; state.zoom = 1; state.activeLayer = 0; state.activeStep = 0;
  renderAll();
  $("generationOverlay").classList.remove("active");
  $("generateBtn").disabled = false;
  $("projectStatus").textContent = "方案已就绪";
  toast(`已生成「${state.design.name}」，图纸与清单一同就绪`);
}

function bindEvents() {
  $("designForm").addEventListener("submit", handleGenerate);
  $("generateBtn").addEventListener("click", handleGenerate);
  $("prompt").addEventListener("input", () => $("promptCount").textContent = $("prompt").value.length);
  $("prompt").addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") handleGenerate(event);
  });
  $$(".example-chip").forEach((button) => button.addEventListener("click", () => {
    $("prompt").value = button.dataset.prompt;
    $("promptCount").textContent = $("prompt").value.length;
    $("prompt").focus();
  }));
  ["sizeControl", "paletteControl"].forEach((id) => $$(`#${id} [data-value]`).forEach((button) => button.addEventListener("click", () => {
    selectControl(id, button.dataset.value);
    if (id === "paletteControl") $("paletteName").textContent = PALETTES[button.dataset.value].name;
  })));
  $$(".design-tab").forEach((button) => button.addEventListener("click", () => switchTab(button.dataset.tab)));
  $("rotateLeft").addEventListener("click", () => { state.rotation -= 1; renderIso($("modelCanvas"), state.design.bricks, { width: 800, height: 520 }); });
  $("rotateRight").addEventListener("click", () => { state.rotation += 1; renderIso($("modelCanvas"), state.design.bricks, { width: 800, height: 520 }); });
  $("zoomIn").addEventListener("click", () => { state.zoom = clamp(state.zoom + .12, .65, 1.5); renderIso($("modelCanvas"), state.design.bricks, { width: 800, height: 520 }); });
  $("zoomOut").addEventListener("click", () => { state.zoom = clamp(state.zoom - .12, .65, 1.5); renderIso($("modelCanvas"), state.design.bricks, { width: 800, height: 520 }); });
  $("resetView").addEventListener("click", () => { state.rotation = 0; state.zoom = 1; renderIso($("modelCanvas"), state.design.bricks, { width: 800, height: 520 }); });
  let dragStart = null;
  $("modelCanvas").addEventListener("pointerdown", (event) => { dragStart = event.clientX; $("modelCanvas").setPointerCapture(event.pointerId); });
  $("modelCanvas").addEventListener("pointerup", (event) => {
    if (dragStart !== null && Math.abs(event.clientX - dragStart) > 35) state.rotation += event.clientX > dragStart ? 1 : -1;
    dragStart = null;
    renderIso($("modelCanvas"), state.design.bricks, { width: 800, height: 520 });
  });
  $("modelCanvas").addEventListener("wheel", (event) => {
    event.preventDefault();
    state.zoom = clamp(state.zoom + (event.deltaY < 0 ? .08 : -.08), .65, 1.5);
    renderIso($("modelCanvas"), state.design.bricks, { width: 800, height: 520 });
  }, { passive: false });
  $("prevLayer").addEventListener("click", () => { state.activeLayer -= 1; renderBlueprint(); });
  $("nextLayer").addEventListener("click", () => { state.activeLayer += 1; renderBlueprint(); });
  $("prevStep").addEventListener("click", () => { state.activeStep -= 1; renderSteps(); });
  $("nextStep").addEventListener("click", () => { state.activeStep = Math.min(state.activeStep + 1, state.design.steps.length - 1); renderSteps(); });
  $("spareToggle").addEventListener("change", () => { state.spare = $("spareToggle").checked; state.design.pricing = calculatePricing(state.design); renderParts(); updateOrderModal(); });
  $("partsSearch").addEventListener("input", renderParts);
  $("viewPartsBtn").addEventListener("click", () => switchTab("parts"));
  $("downloadCsvBtn").addEventListener("click", exportCsv);
  $("exportCsv").addEventListener("click", () => { exportCsv(); $("exportMenu").open = false; });
  $("exportPng").addEventListener("click", () => { exportPng(); $("exportMenu").open = false; });
  $("exportSvg").addEventListener("click", () => {
    const source = `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString($("blueprintCanvas"))}`;
    downloadBlob(new Blob([source], { type: "image/svg+xml;charset=utf-8" }), `${state.design.name}-第${state.activeLayer + 1}层设计图.svg`);
    $("exportMenu").open = false; toast("当前层设计图 SVG 已导出");
  });
  $("exportJson").addEventListener("click", () => { exportJson(); $("exportMenu").open = false; toast("完整方案数据已导出"); });
  $("exportManual").addEventListener("click", () => { $("exportMenu").open = false; printManual(); });
  $("printManualBtn").addEventListener("click", printManual);
  $("saveBtn").addEventListener("click", saveDesign);
  $("libraryBtn").addEventListener("click", showLibrary);
  $("studioNav").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  $("closeLibrary").addEventListener("click", () => $("libraryDialog").close());
  $("helpBtn").addEventListener("click", () => $("helpDialog").showModal());
  $("closeHelp").addEventListener("click", () => $("helpDialog").close());
  $("orderBtn").addEventListener("click", () => { state.orderQty = 1; updateOrderModal(); $("orderDialog").showModal(); });
  $("qtyMinus").addEventListener("click", () => { state.orderQty = Math.max(1, state.orderQty - 1); updateOrderModal(); });
  $("qtyPlus").addEventListener("click", () => { state.orderQty = Math.min(20, state.orderQty + 1); updateOrderModal(); });
  $("orderForm").addEventListener("submit", submitOrder);
  $$("dialog").forEach((dialog) => dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  }));
}

function init() {
  bindEvents();
  updateSavedCount();
  $("promptCount").textContent = $("prompt").value.length;
  const request = parseRequest();
  state.design = generateDesign(request);
  renderAll();
}

document.addEventListener("DOMContentLoaded", init);
