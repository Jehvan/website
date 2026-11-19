// Procedural icons (canvas -> data URL), cached. No image files.
const cache = new Map();

function make(draw, size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.scale(size / 64, size / 64);
  g.lineCap = 'round'; g.lineJoin = 'round';
  draw(g);
  return c.toDataURL();
}

const stroke = (g, col, w) => { g.strokeStyle = col; g.lineWidth = w; };
const arrow = (g, x1, y1, x2, y2, col = '#e8dcc0') => {
  stroke(g, col, 3); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  const a = Math.atan2(y2 - y1, x2 - x1);
  g.fillStyle = col; g.beginPath(); g.moveTo(x2, y2); g.lineTo(x2 - Math.cos(a - 0.5) * 9, y2 - Math.sin(a - 0.5) * 9); g.lineTo(x2 - Math.cos(a + 0.5) * 9, y2 - Math.sin(a + 0.5) * 9); g.fill();
};

const DRAW = {
  rush(g) { g.fillStyle = '#6f8fc8'; g.beginPath(); g.moveTo(22, 14); g.lineTo(50, 14); g.lineTo(50, 34); g.quadraticCurveTo(50, 50, 36, 56); g.quadraticCurveTo(22, 50, 22, 34); g.closePath(); g.fill(); stroke(g, '#dfe8ff', 3); g.stroke(); arrow(g, 4, 34, 24, 34, '#ffd86a'); arrow(g, 4, 22, 18, 22, '#ffd86a'); },
  whirl(g) { stroke(g, '#e8f0ff', 5); g.beginPath(); g.arc(32, 32, 18, 0.3, 4.4); g.stroke(); stroke(g, '#9ab8ff', 3); g.beginPath(); g.arc(32, 32, 10, 3.4, 7.5); g.stroke(); arrow(g, 40, 10, 50, 18, '#fff'); },
  rally(g) { g.fillStyle = '#e8b84a'; g.beginPath(); g.moveTo(12, 28); g.lineTo(34, 18); g.lineTo(34, 46); g.lineTo(12, 36); g.closePath(); g.fill(); g.fillStyle = '#c88a2a'; g.beginPath(); g.moveTo(34, 18); g.quadraticCurveTo(56, 32, 34, 46); g.closePath(); g.fill(); stroke(g, '#fff2b0', 2.5); for (const a of [-0.6, 0, 0.6]) { g.beginPath(); g.moveTo(46 + Math.cos(a) * 4, 32 + Math.sin(a) * 4); g.lineTo(58 + Math.cos(a) * 3, 32 + Math.sin(a) * 14); g.stroke(); } },
  volley(g) { for (let i = -2; i <= 2; i++) { const a = -0.9 + i * 0.28; arrow(g, 14, 52, 14 + Math.cos(a) * 44, 52 + Math.sin(a) * 44, '#e8dcc0'); } },
  tumble(g) { stroke(g, '#d8e8c0', 5); g.beginPath(); g.arc(30, 34, 17, 3.6, 8.2); g.stroke(); arrow(g, 40, 14, 52, 22, '#d8e8c0'); g.fillStyle = '#8aa860'; g.beginPath(); g.arc(30, 34, 6, 0, 7); g.fill(); },
  rain(g) { g.fillStyle = 'rgba(160,200,100,0.35)'; g.beginPath(); g.ellipse(32, 50, 24, 9, 0, 0, 7); g.fill(); for (const [x, y] of [[18, 8], [32, 4], [46, 10], [26, 22], [40, 24]]) arrow(g, x - 4, y, x, y + 22, '#e8dcc0'); },
  nova(g) { stroke(g, '#bfeaff', 4); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.beginPath(); g.moveTo(32, 32); g.lineTo(32 + Math.cos(a) * 24, 32 + Math.sin(a) * 24); g.stroke(); g.beginPath(); g.moveTo(32 + Math.cos(a) * 15, 32 + Math.sin(a) * 15); g.lineTo(32 + Math.cos(a + 0.5) * 21, 32 + Math.sin(a + 0.5) * 21); g.moveTo(32 + Math.cos(a) * 15, 32 + Math.sin(a) * 15); g.lineTo(32 + Math.cos(a - 0.5) * 21, 32 + Math.sin(a - 0.5) * 21); g.stroke(); } },
  blink(g) { g.fillStyle = '#b79bff'; for (const [x, y, s] of [[22, 40, 12], [44, 22, 9], [14, 18, 5]]) { g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s * 0.3, y - s * 0.3); g.lineTo(x + s, y); g.lineTo(x + s * 0.3, y + s * 0.3); g.lineTo(x, y + s); g.lineTo(x - s * 0.3, y + s * 0.3); g.lineTo(x - s, y); g.lineTo(x - s * 0.3, y - s * 0.3); g.closePath(); g.fill(); } },
  meteor(g) { const gr = g.createLinearGradient(8, 8, 40, 40); gr.addColorStop(0, 'rgba(255,120,30,0)'); gr.addColorStop(1, '#ff7a1a'); g.fillStyle = gr; g.beginPath(); g.moveTo(6, 6); g.lineTo(38, 24); g.lineTo(24, 38); g.closePath(); g.fill(); g.fillStyle = '#ffb04a'; g.beginPath(); g.arc(40, 40, 14, 0, 7); g.fill(); g.fillStyle = '#ff5a1a'; g.beginPath(); g.arc(43, 43, 8, 0, 7); g.fill(); },
  potion(g) { g.fillStyle = '#d83a54'; g.beginPath(); g.moveTo(26, 28); g.lineTo(22, 40); g.quadraticCurveTo(20, 54, 32, 54); g.quadraticCurveTo(44, 54, 42, 40); g.lineTo(38, 28); g.closePath(); g.fill(); g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(26, 40, 5, 8); stroke(g, '#cfd8e0', 3); g.beginPath(); g.moveTo(26, 28); g.lineTo(26, 14); g.moveTo(38, 28); g.lineTo(38, 14); g.stroke(); g.fillStyle = '#8a5a30'; g.fillRect(24, 8, 16, 8); },
  sword(g) { stroke(g, '#dfe6ee', 6); g.beginPath(); g.moveTo(14, 50); g.lineTo(46, 14); g.stroke(); stroke(g, '#8a6a3a', 5); g.beginPath(); g.moveTo(14, 38); g.lineTo(26, 50); g.stroke(); g.beginPath(); g.moveTo(10, 54); g.lineTo(16, 48); g.stroke(); },
  bow(g) { stroke(g, '#a07a46', 5); g.beginPath(); g.arc(12, 32, 30, -1.0, 1.0); g.stroke(); stroke(g, '#e8dcc0', 1.8); g.beginPath(); g.moveTo(12 + Math.cos(-1) * 30, 32 + Math.sin(-1) * 30); g.lineTo(12 + Math.cos(1) * 30, 32 + Math.sin(1) * 30); g.stroke(); arrow(g, 14, 32, 54, 32, '#e8dcc0'); },
  staff(g) { stroke(g, '#8a6038', 5); g.beginPath(); g.moveTo(16, 56); g.lineTo(44, 20); g.stroke(); g.fillStyle = '#ff8a3a'; g.beginPath(); g.arc(48, 14, 9, 0, 7); g.fill(); g.fillStyle = '#ffe0a0'; g.beginPath(); g.arc(46, 12, 4, 0, 7); g.fill(); },
  armor(g) { g.fillStyle = '#8f9aa8'; g.beginPath(); g.moveTo(10, 16); g.lineTo(22, 10); g.quadraticCurveTo(32, 18, 42, 10); g.lineTo(54, 16); g.lineTo(48, 30); g.lineTo(46, 54); g.lineTo(18, 54); g.lineTo(16, 30); g.closePath(); g.fill(); stroke(g, '#d8e0e8', 2.5); g.stroke(); stroke(g, '#5a6470', 2); g.beginPath(); g.moveTo(32, 18); g.lineTo(32, 54); g.stroke(); },
  charm(g) { stroke(g, '#c8a860', 3); g.beginPath(); g.arc(32, 22, 14, Math.PI, 0); g.stroke(); g.fillStyle = '#5ac8a8'; g.beginPath(); g.moveTo(32, 26); g.lineTo(44, 40); g.lineTo(32, 56); g.lineTo(20, 40); g.closePath(); g.fill(); stroke(g, '#e8fff4', 2); g.stroke(); },
  coin(g) { g.fillStyle = '#e0b43a'; g.beginPath(); g.arc(32, 32, 24, 0, 7); g.fill(); stroke(g, '#fff0a0', 3); g.stroke(); stroke(g, '#a07818', 3); g.beginPath(); g.arc(32, 32, 14, 0, 7); g.stroke(); },
  knight(g) { g.fillStyle = '#7a8aa8'; g.beginPath(); g.moveTo(14, 12); g.lineTo(50, 12); g.lineTo(50, 34); g.quadraticCurveTo(50, 52, 32, 60); g.quadraticCurveTo(14, 52, 14, 34); g.closePath(); g.fill(); stroke(g, '#e8f0ff', 3); g.stroke(); g.fillStyle = '#c8302a'; g.beginPath(); g.moveTo(32, 16); g.lineTo(32, 56); g.lineTo(20, 40); g.lineTo(20, 16); g.closePath(); g.fill(); g.fillStyle = '#f0d070'; g.beginPath(); g.moveTo(40, 22); g.lineTo(43, 31); g.lineTo(37, 31); g.closePath(); g.fill(); },
  ranger(g) { DRAW.bow(g); },
  mage(g) { DRAW.staff(g); },
};

export function icon(id, size = 64) {
  const key = id + size;
  if (!cache.has(key)) cache.set(key, make(DRAW[id] || DRAW.charm, size));
  return cache.get(key);
}

export function slotIcon(item) {
  if (item.slot === 'weapon') return item.cls === 'ranger' ? 'bow' : item.cls === 'mage' ? 'staff' : 'sword';
  return item.slot;
}
