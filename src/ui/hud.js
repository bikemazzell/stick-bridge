export function createHud(root, actions = {}) {
  const el = document.createElement('div');
  el.className = 'overlay hud';
  el.dataset.screen = 'hud';
  el.innerHTML = `
    <span class="pill" data-hud="walker">walker</span>
    <span class="pill" data-hud="sticks">sticks</span>
    <span class="pill" data-hud="stress">stress</span>
    <span class="pill" data-hud="weather">weather</span>
    <span class="pill" data-hud="seed">seed</span>
    <button class="pill pill-btn" data-action="speed" title="Simulation speed">1x</button>
    <button class="pill pill-btn" data-action="menu" title="Back to menu">Menu</button>
  `;
  root.appendChild(el);

  const q = (name) => el.querySelector(`[data-hud="${name}"]`);
  el.querySelector('[data-action="speed"]').addEventListener('click', () => actions.onSpeed && actions.onSpeed());
  el.querySelector('[data-action="menu"]').addEventListener('click', () => actions.onMenu && actions.onMenu());

  return {
    el,
    setSpeed(mult) {
      el.querySelector('[data-action="speed"]').textContent = `${mult}x`;
    },
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
