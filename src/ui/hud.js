export function createHud(root) {
  const el = document.createElement('div');
  el.className = 'overlay hud';
  el.dataset.screen = 'hud';
  el.innerHTML = `
    <span class="pill" data-hud="walker">walker</span>
    <span class="pill" data-hud="sticks">sticks</span>
    <span class="pill" data-hud="stress">stress</span>
    <span class="pill" data-hud="weather">weather</span>
    <span class="pill" data-hud="seed">seed</span>
  `;
  root.appendChild(el);

  const q = (name) => el.querySelector(`[data-hud="${name}"]`);

  return {
    el,
    setWalker(def, index, total) {
      q('walker').textContent = `${index + 1}/${total} ${def.name} (${fmtMass(def.massKg)})`;
    },
    setSticks(used, budget) {
      q('sticks').textContent = `${used}/${budget} sticks`;
    },
    setStress(ratio) {
      q('stress').textContent = `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%`;
    },
    setWeather(text) {
      q('weather').textContent = text;
    },
    setSeed(seedStr) {
      q('seed').textContent = `seed: ${seedStr}`;
    },
    destroy() {
      el.remove();
    },
  };
}

function fmtMass(kg) {
  if (kg >= 1000) return `${kg / 1000}t`;
  return `${kg}kg`;
}
