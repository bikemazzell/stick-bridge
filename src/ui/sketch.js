const W = 180;
const H = 90;
const X0 = 20;
const X1 = W - 20;
const Y = 55;

export function drawTypeSketch(canvas, type) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#eaf4ff';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#8a6d5c';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(0, Y);
  ctx.lineTo(X0, Y);
  ctx.moveTo(X1, Y);
  ctx.lineTo(W, Y);
  ctx.stroke();

  ctx.strokeStyle = '#d9a066';
  ctx.lineWidth = 3;
  if (type === 'flat') {
    ctx.beginPath();
    ctx.moveTo(X0, Y);
    ctx.lineTo(X1, Y);
    ctx.stroke();
  } else if (type === 'truss') {
    const panels = 6;
    ctx.beginPath();
    ctx.moveTo(X0, Y);
    ctx.lineTo(X1, Y);
    ctx.stroke();
    for (let i = 0; i < panels; i++) {
      const xa = X0 + ((X1 - X0) * i) / panels;
      const xb = X0 + ((X1 - X0) * (i + 1)) / panels;
      const xc = (xa + xb) / 2;
      ctx.beginPath();
      if (i % 2 === 0) {
        ctx.moveTo(xa, Y);
        ctx.lineTo(xc, Y - 20);
        ctx.lineTo(xb, Y);
      } else {
        ctx.moveTo(xa, Y - 20);
        ctx.lineTo(xb, Y);
        ctx.lineTo(xb, Y - 20);
      }
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(X0 + (X1 - X0) / (panels * 2), Y - 20);
    ctx.lineTo(X1 - (X1 - X0) / (panels * 2), Y - 20);
    ctx.stroke();
  } else {
    const tx0 = X0 + 22;
    const tx1 = X1 - 22;
    ctx.beginPath();
    ctx.moveTo(tx0, Y + 8);
    ctx.lineTo(tx0, Y - 26);
    ctx.moveTo(tx1, Y + 8);
    ctx.lineTo(tx1, Y - 26);
    ctx.stroke();
    ctx.strokeStyle = '#4a4a55';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(X0, Y);
    ctx.quadraticCurveTo(tx0 + 4, Y - 18, tx0, Y - 26);
    ctx.moveTo(tx1, Y - 26);
    ctx.quadraticCurveTo(tx1 - 4, Y - 18, X1, Y);
    ctx.moveTo(tx0, Y - 26);
    ctx.quadraticCurveTo((tx0 + tx1) / 2, Y + 4, tx1, Y - 26);
    ctx.stroke();
    ctx.strokeStyle = '#7f8fa6';
    ctx.lineWidth = 1.5;
    for (let x = tx0 + 18; x < tx1 - 10; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, Y - 26 + ((x - tx0) / (tx1 - tx0)) * 0 + 18 * Math.sin(Math.PI * (x - tx0) / (tx1 - tx0)) ** 1.2 + 2);
      ctx.lineTo(x, Y);
      ctx.stroke();
    }
  }
}
