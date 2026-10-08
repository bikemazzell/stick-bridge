export function parseParams(search) {
  const q = new URLSearchParams(search);
  const cfg = {};
  let hasCfg = false;
  const seed = q.get('seed');
  if (seed) {
    cfg.seed = seed;
    hasCfg = true;
  }
  const type = q.get('type');
  if (type) {
    cfg.type = type;
    hasCfg = true;
  }
  for (const key of ['budget', 'stickLen', 'span']) {
    const raw = q.get(key);
    if (raw !== null && raw !== '' && Number.isFinite(Number(raw))) {
      cfg[key] = Number(raw);
      hasCfg = true;
    }
  }
  const speedRaw = Number(q.get('speed'));
  const speed = Number.isFinite(speedRaw) && speedRaw >= 1 && speedRaw <= 20 ? Math.floor(speedRaw) : 1;
  return { cfg: hasCfg ? cfg : null, speed };
}
