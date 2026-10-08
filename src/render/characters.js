function eye(ctx, x, y, r, phase, dir = 1) {
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1e272e';
  ctx.beginPath();
  ctx.arc(x + dir * r * 0.35 + Math.sin(phase) * r * 0.15, y - r * 0.1, r * 0.45, 0, Math.PI * 2);
  ctx.fill();
}

function drawFly(ctx, x, y, ph, s) {
  const k = s / 5;
  const bob = Math.sin(ph * 2) * 2;
  ctx.fillStyle = '#4cd137';
  ctx.beginPath();
  ctx.ellipse(x, y - 5 * k + bob, 5 * k, 3.6 * k, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(200, 230, 255, 0.7)';
  const flap = Math.sin(ph * 6) * 4 * k;
  ctx.beginPath();
  ctx.ellipse(x - 4 * k, y - 7 * k + bob + flap * 0.4, 4 * k, 2 * k, -0.6, 0, Math.PI * 2);
  ctx.ellipse(x + 4 * k, y - 7 * k + bob + flap * 0.4, 4 * k, 2 * k, 0.6, 0, Math.PI * 2);
  ctx.fill();
  eye(ctx, x - 1.5 * k, y - 8 * k + bob, 1.6 * k, ph, -1);
  eye(ctx, x + 1.5 * k, y - 8 * k + bob, 1.6 * k, ph, 1);
}

function drawMouse(ctx, x, y, ph, s) {
  const k = s / 8;
  const bob = Math.abs(Math.sin(ph)) * 1.5 * k;
  ctx.strokeStyle = '#c8a2c8';
  ctx.lineWidth = 1.5 * k;
  ctx.beginPath();
  ctx.moveTo(x - 6 * k, y - 3 * k);
  ctx.quadraticCurveTo(x - 11 * k, y - 3 * k + Math.sin(ph) * 4 * k, x - 13 * k, y - 6 * k);
  ctx.stroke();
  ctx.fillStyle = '#9aa0b5';
  ctx.beginPath();
  ctx.ellipse(x, y - 4 * k - bob, 6 * k, 4 * k, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#b8bed4';
  ctx.beginPath();
  ctx.arc(x + 5 * k, y - 7 * k - bob, 3.2 * k, 0, Math.PI * 2);
  ctx.arc(x + 3 * k, y - 11 * k - bob, 2.2 * k, 0, Math.PI * 2);
  ctx.arc(x + 7 * k, y - 11 * k - bob, 2.2 * k, 0, Math.PI * 2);
  ctx.fill();
  eye(ctx, x + 6.5 * k, y - 7.5 * k - bob, 1.4 * k, ph, 1);
}

function drawToycar(ctx, x, y, ph, s) {
  const k = s / 12;
  const spin = ph * 1.5;
  ctx.fillStyle = '#e15f41';
  ctx.beginPath();
  ctx.roundRect(x - 9 * k, y - 9 * k, 18 * k, 6 * k, 2 * k);
  ctx.fill();
  ctx.fillStyle = '#f8a5c2';
  ctx.beginPath();
  ctx.roundRect(x - 5 * k, y - 12 * k, 8 * k, 4 * k, 1.5 * k);
  ctx.fill();
  for (const wx of [-5, 5]) {
    ctx.fillStyle = '#2f3542';
    ctx.beginPath();
    ctx.arc(x + wx * k, y - 2.5 * k, 2.6 * k, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#a4b0be';
    ctx.lineWidth = 0.8 * k;
    ctx.beginPath();
    ctx.moveTo(x + wx * k + Math.cos(spin) * 2 * k, y - 2.5 * k + Math.sin(spin) * 2 * k);
    ctx.lineTo(x + wx * k - Math.cos(spin) * 2 * k, y - 2.5 * k - Math.sin(spin) * 2 * k);
    ctx.stroke();
  }
  eye(ctx, x + 8 * k, y - 7 * k, 1.5 * k, ph, 1);
}

function drawCat(ctx, x, y, ph, s) {
  const k = s / 16;
  const bob = Math.abs(Math.sin(ph)) * 1.2 * k;
  ctx.strokeStyle = '#e58e26';
  ctx.lineWidth = 2 * k;
  ctx.beginPath();
  ctx.moveTo(x - 7 * k, y - 5 * k - bob);
  ctx.quadraticCurveTo(x - 12 * k, y - 5 * k + Math.sin(ph) * 5 * k, x - 13 * k, y - 12 * k + Math.sin(ph * 2) * 3 * k);
  ctx.stroke();
  ctx.fillStyle = '#f6b93b';
  ctx.beginPath();
  ctx.ellipse(x, y - 6 * k - bob, 8 * k, 5 * k, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 7 * k, y - 11 * k - bob, 4.5 * k, 0, Math.PI * 2);
  ctx.moveTo(x + 4 * k, y - 14 * k - bob);
  ctx.lineTo(x + 3 * k, y - 18 * k - bob);
  ctx.lineTo(x + 6.5 * k, y - 15 * k - bob);
  ctx.moveTo(x + 10 * k, y - 14 * k - bob);
  ctx.lineTo(x + 11 * k, y - 18 * k - bob);
  ctx.lineTo(x + 7.5 * k, y - 15 * k - bob);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#576574';
  ctx.lineWidth = 0.7 * k;
  for (const wy of [-11.5, -10]) {
    ctx.beginPath();
    ctx.moveTo(x + 10 * k, y + wy * k - bob);
    ctx.lineTo(x + 14 * k, y + (wy + 0.6) * k - bob);
    ctx.stroke();
  }
  eye(ctx, x + 8.5 * k, y - 11.5 * k - bob, 1.6 * k, ph, 1);
}

function drawDog(ctx, x, y, ph, s) {
  const k = s / 20;
  const bob = Math.abs(Math.sin(ph)) * 1.2 * k;
  ctx.strokeStyle = '#c0392b';
  ctx.lineWidth = 2.4 * k;
  ctx.beginPath();
  ctx.moveTo(x - 9 * k, y - 8 * k - bob);
  ctx.lineTo(x - 13 * k, y - 8 * k - bob + Math.sin(ph * 2) * 3 * k);
  ctx.stroke();
  ctx.fillStyle = '#b77';
  ctx.fillStyle = '#cd8b4f';
  ctx.beginPath();
  ctx.ellipse(x, y - 8 * k - bob, 10 * k, 6 * k, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#dda15e';
  ctx.beginPath();
  ctx.arc(x + 9 * k, y - 12 * k - bob, 5 * k, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8b5e34';
  ctx.beginPath();
  ctx.ellipse(x + 6 * k, y - 15 * k - bob, 2.4 * k, 4 * k, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e15f41';
  ctx.beginPath();
  ctx.ellipse(x + 12 * k, y - 9 * k - bob, 1.6 * k, 2.4 * k, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#576574';
  ctx.lineWidth = 3 * k;
  const legs = [-5, 5];
  for (let i = 0; i < legs.length; i++) {
    const swing = Math.sin(ph + i * Math.PI) * 3 * k;
    ctx.beginPath();
    ctx.moveTo(x + legs[i] * k, y - 4 * k);
    ctx.lineTo(x + legs[i] * k + swing, y);
    ctx.stroke();
  }
  eye(ctx, x + 11 * k, y - 13 * k - bob, 1.8 * k, ph, 1);
}

function drawHuman(ctx, x, y, ph, s) {
  const k = s / 26;
  const swing = Math.sin(ph) * 5 * k;
  const bob = Math.abs(Math.cos(ph)) * 1.5 * k;
  ctx.strokeStyle = '#2f3542';
  ctx.lineWidth = 3.4 * k;
  ctx.beginPath();
  ctx.moveTo(x, y - 12 * k - bob);
  ctx.lineTo(x + swing, y);
  ctx.moveTo(x, y - 12 * k - bob);
  ctx.lineTo(x - swing, y);
  ctx.stroke();
  ctx.strokeStyle = '#e55039';
  ctx.lineWidth = 3 * k;
  ctx.beginPath();
  ctx.moveTo(x - 4 * k, y - 19 * k - bob);
  ctx.lineTo(x + 4 * k, y - 19 * k - bob);
  ctx.stroke();
  ctx.strokeStyle = '#f0932b';
  ctx.lineWidth = 3.2 * k;
  ctx.beginPath();
  ctx.moveTo(x, y - 19 * k - bob);
  ctx.lineTo(x - swing * 0.8, y - 12 * k - bob);
  ctx.stroke();
  ctx.fillStyle = '#576574';
  ctx.beginPath();
  ctx.roundRect(x - 4.4 * k, y - 27 * k - bob, 8.8 * k, 9 * k, 3 * k);
  ctx.fill();
  ctx.fillStyle = '#ffd8a6';
  ctx.beginPath();
  ctx.arc(x, y - 31 * k - bob, 4.6 * k, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2f3542';
  ctx.beginPath();
  ctx.arc(x, y - 34.5 * k - bob, 4.6 * k, Math.PI, Math.PI * 2);
  ctx.fill();
  eye(ctx, x - 1.6 * k, y - 31.5 * k - bob, 1.4 * k, ph, 0);
  eye(ctx, x + 1.6 * k, y - 31.5 * k - bob, 1.4 * k, ph, 0);
}

function drawHorse(ctx, x, y, ph, s) {
  const k = s / 34;
  const bob = Math.abs(Math.sin(ph)) * 1.4 * k;
  ctx.strokeStyle = '#6d4c33';
  ctx.lineWidth = 3.4 * k;
  const legs = [-9, -4, 5, 10];
  for (let i = 0; i < legs.length; i++) {
    const swing = i < 2 ? Math.sin(ph) * 4 * k : Math.sin(ph + Math.PI) * 4 * k;
    ctx.beginPath();
    ctx.moveTo(x + legs[i] * k, y - 14 * k - bob);
    ctx.lineTo(x + legs[i] * k + swing, y);
    ctx.stroke();
  }
  ctx.fillStyle = '#8d6e4b';
  ctx.beginPath();
  ctx.ellipse(x, y - 18 * k - bob, 13 * k, 6.5 * k, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3d2c22';
  ctx.lineWidth = 2.2 * k;
  ctx.beginPath();
  ctx.moveTo(x - 12 * k, y - 20 * k - bob);
  ctx.quadraticCurveTo(x - 17 * k, y - 16 * k, x - 15 * k, y - 10 * k);
  ctx.stroke();
  ctx.fillStyle = '#8d6e4b';
  ctx.beginPath();
  ctx.ellipse(x + 14 * k, y - 24 * k - bob, 5 * k, 4 * k, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + 18 * k, y - 28 * k - bob, 2.2 * k, 3.6 * k, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3d2c22';
  ctx.lineWidth = 1.6 * k;
  ctx.beginPath();
  ctx.moveTo(x + 19 * k, y - 30 * k - bob);
  ctx.lineTo(x + 21 * k, y - 26 * k - bob);
  ctx.stroke();
  eye(ctx, x + 19 * k, y - 28.5 * k - bob, 1.6 * k, ph, 1);
}

function drawCar(ctx, x, y, ph, s) {
  const k = s / 34;
  ctx.fillStyle = '#277bc9';
  ctx.beginPath();
  ctx.roundRect(x - 16 * k, y - 12 * k, 32 * k, 8 * k, 3 * k);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(x - 9 * k, y - 18 * k, 16 * k, 7 * k, 3 * k);
  ctx.fill();
  ctx.fillStyle = '#a4d4ff';
  ctx.beginPath();
  ctx.roundRect(x - 7 * k, y - 17 * k, 6 * k, 5 * k, 1.5 * k);
  ctx.roundRect(x + 1 * k, y - 17 * k, 6 * k, 5 * k, 1.5 * k);
  ctx.fill();
  ctx.fillStyle = '#f39c12';
  ctx.beginPath();
  ctx.arc(x + 15 * k, y - 9 * k, 1.6 * k, 0, Math.PI * 2);
  ctx.arc(x - 15 * k, y - 9 * k, 1.6 * k, 0, Math.PI * 2);
  ctx.fill();
  for (const wx of [-9, 9]) {
    ctx.fillStyle = '#2f3542';
    ctx.beginPath();
    ctx.arc(x + wx * k, y - 3 * k, 4 * k, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#a4b0be';
    ctx.lineWidth = 1.2 * k;
    const a = ph * 1.2 + (wx > 0 ? 1 : 0);
    ctx.beginPath();
    ctx.moveTo(x + wx * k + Math.cos(a) * 3 * k, y - 3 * k + Math.sin(a) * 3 * k);
    ctx.lineTo(x + wx * k - Math.cos(a) * 3 * k, y - 3 * k - Math.sin(a) * 3 * k);
    ctx.stroke();
  }
}

function drawElephant(ctx, x, y, ph, s) {
  const k = s / 44;
  const bob = Math.abs(Math.sin(ph)) * 1.5 * k;
  ctx.fillStyle = '#8c9bab';
  ctx.beginPath();
  ctx.ellipse(x, y - 16 * k - bob, 20 * k, 12 * k, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7b8b9b';
  ctx.lineWidth = 5 * k;
  const legs = [-11, -3, 6, 13];
  for (let i = 0; i < legs.length; i++) {
    const swing = Math.sin(ph + (i % 2) * Math.PI) * 2.5 * k;
    ctx.beginPath();
    ctx.moveTo(x + legs[i] * k, y - 10 * k - bob);
    ctx.lineTo(x + legs[i] * k + swing, y);
    ctx.stroke();
  }
  ctx.fillStyle = '#95a5b5';
  ctx.beginPath();
  ctx.arc(x + 19 * k, y - 24 * k - bob, 8.5 * k, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + 13 * k, y - 26 * k - bob, 6 * k, 8 * k, 0.5 + Math.sin(ph) * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#8c9bab';
  ctx.lineWidth = 3.6 * k;
  ctx.beginPath();
  ctx.moveTo(x + 26 * k, y - 21 * k - bob);
  ctx.quadraticCurveTo(
    x + 32 * k + Math.sin(ph) * 4 * k, y - 12 * k - bob,
    x + 27 * k + Math.sin(ph) * 6 * k, y - 4 * k - bob,
  );
  ctx.stroke();
  ctx.strokeStyle = '#57606f';
  ctx.lineWidth = 1 * k;
  ctx.beginPath();
  ctx.moveTo(x - 20 * k, y - 20 * k - bob);
  ctx.quadraticCurveTo(x - 24 * k, y - 16 * k - bob, x - 20 * k, y - 13 * k - bob);
  ctx.stroke();
  eye(ctx, x + 21 * k, y - 26 * k - bob, 2 * k, ph, 1);
}

function drawTank(ctx, x, y, ph, s) {
  const k = s / 40;
  const recoil = Math.max(0, Math.sin(ph * 0.5)) * 3 * k;
  ctx.fillStyle = '#2f3640';
  ctx.beginPath();
  ctx.roundRect(x - 20 * k, y - 12 * k, 40 * k, 9 * k, 4.5 * k);
  ctx.fill();
  ctx.strokeStyle = '#1e272e';
  ctx.lineWidth = 1.4 * k;
  const treadPhase = ph * 1.5;
  for (let i = 0; i < 8; i++) {
    const tx = x - 17 * k + i * 4.8 * k + (Math.sin(treadPhase + i) * 0.3 + 0.3) * 4.8 * k;
    ctx.beginPath();
    ctx.moveTo(tx, y - 11.5 * k);
    ctx.lineTo(tx, y - 3.5 * k);
    ctx.stroke();
  }
  ctx.fillStyle = '#44bd32';
  ctx.beginPath();
  ctx.roundRect(x - 15 * k, y - 19 * k, 26 * k, 8 * k, 3 * k);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(x - 4 * k, y - 25 * k, 12 * k, 7 * k, 3 * k);
  ctx.fill();
  ctx.fillStyle = '#3dan2b';
  ctx.beginPath();
  ctx.roundRect(x + 8 * k, y - 23.5 * k, 22 * k - recoil, 3.6 * k, 1.8 * k);
  ctx.fill();
  ctx.strokeStyle = '#e84118';
  ctx.lineWidth = 1.4 * k;
  ctx.beginPath();
  ctx.moveTo(x - 4 * k, y - 25 * k);
  ctx.lineTo(x - 4 * k, y - 33 * k);
  ctx.stroke();
  ctx.fillStyle = '#e84118';
  ctx.beginPath();
  ctx.moveTo(x - 4 * k, y - 33 * k);
  ctx.lineTo(x + 2 * k, y - 31.5 * k);
  ctx.lineTo(x - 4 * k, y - 30 * k);
  ctx.closePath();
  ctx.fill();
  eye(ctx, x - 12 * k, y - 15.5 * k, 1.8 * k, ph, -1);
}

export const CHAR_DRAWERS = {
  fly: drawFly,
  mouse: drawMouse,
  toycar: drawToycar,
  cat: drawCat,
  dog: drawDog,
  human: drawHuman,
  horse: drawHorse,
  car: drawCar,
  elephant: drawElephant,
  tank: drawTank,
};

export function drawWalker(ctx, def, x, y, phase) {
  const drawer = CHAR_DRAWERS[def.id];
  if (!drawer) throw new Error(`no character drawer for ${def.id}`);
  ctx.save();
  drawer(ctx, x, y, phase, def.size);
  ctx.restore();
}

// Frustration bubble above a stuck walker's head: (x, y) is the bubble's
// bottom tip, text is the rant glyph string.
export function drawSpeechBubble(ctx, x, y, text) {
  const chars = [...String(text)];
  const w = Math.max(46, chars.length * 18 + 16);
  const h = 30;
  const left = x - w / 2;
  const top = y - h - 8;
  const r = 9;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(left + r, top);
  ctx.lineTo(left + w - r, top);
  ctx.arcTo(left + w, top, left + w, top + r, r);
  ctx.lineTo(left + w, top + h - r);
  ctx.arcTo(left + w, top + h, left + w - r, top + h, r);
  ctx.lineTo(x + 5, top + h);
  ctx.lineTo(x, top + h + 8);
  ctx.lineTo(x - 5, top + h);
  ctx.lineTo(left + r, top + h);
  ctx.arcTo(left, top + h, left, top + h - r, r);
  ctx.lineTo(left, top + r);
  ctx.arcTo(left, top, left + r, top, r);
  ctx.closePath();
  ctx.fillStyle = '#fdfdfd';
  ctx.fill();
  ctx.strokeStyle = '#2a3245';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#1d2637';
  ctx.font = '700 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, top + h / 2 + 1);
  ctx.restore();
}
