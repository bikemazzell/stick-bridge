import { DEFAULTS, HINTS, WORLD } from '../game/config.js';
import { drawTypeSketch } from './sketch.js';

const TYPES = [
  { id: 'flat', name: 'Flat Beam', desc: 'One lonely layer of sticks. Cheap, honest, doomed.' },
  { id: 'truss', name: 'Truss', name2: 'Triangles!', desc: 'Warren, Pratt or Howe triangles hold real weight.' },
  { id: 'suspension', name: 'Suspension', desc: 'Towers and cables. Fancy, saggy, surprisingly strong.' },
];

const SEED_WORDS = ['woody', 'gluey', 'saggy', 'bouncy', 'snappy', 'creaky', 'wobbly', 'sturdy'];

export function createMenu(root, onStart) {
  const el = document.createElement('div');
  el.className = 'overlay menu';
  el.dataset.screen = 'menu';
  el.innerHTML = `
    <h1 class="title">Pop Bridge</h1>
    <p class="tagline">Popsicle sticks, glue, and bad decisions</p>
    <div class="cards"></div>
    <div class="controls">
      <label class="ctrl">
        <span>Sticks: <b data-out="budget">${DEFAULTS.budget}</b></span>
        <input data-input="budget" type="range" min="20" max="300" step="2" value="${DEFAULTS.budget}">
      </label>
      <label class="ctrl">
        <span>Stick length: <b data-out="stickLen">${DEFAULTS.stickLen}</b></span>
        <input data-input="stickLen" type="range" min="40" max="120" step="5" value="${DEFAULTS.stickLen}">
      </label>
      <label class="ctrl seedrow">
        <span>Seed</span>
        <input data-input="seed" type="text" value="pop-1" maxlength="24">
        <button data-action="dice" class="dice" title="Random seed">🎲</button>
      </label>
    </div>
    <p class="hint" data-out="hint"></p>
    <button class="start" data-action="start">Build it!</button>
  `;

  const cardsBox = el.querySelector('.cards');
  const state = { type: DEFAULTS.type };

  for (const t of TYPES) {
    const card = document.createElement('button');
    card.className = 'card';
    card.dataset.type = t.id;
    card.innerHTML = `
      <canvas width="180" height="90" data-sketch="${t.id}"></canvas>
      <h2>${t.name}${t.name2 ? `<em> ${t.name2}</em>` : ''}</h2>
      <p>${t.desc}</p>
    `;
    card.addEventListener('click', () => {
      state.type = t.id;
      for (const c of cardsBox.children) c.classList.toggle('selected', c === card);
    });
    if (t.id === state.type) card.classList.add('selected');
    cardsBox.appendChild(card);
    const canvas = card.querySelector('canvas');
    drawTypeSketch(canvas, t.id);
  }

  const budget = el.querySelector('[data-input="budget"]');
  const stickLen = el.querySelector('[data-input="stickLen"]');
  const seed = el.querySelector('[data-input="seed"]');
  const budgetOut = el.querySelector('[data-out="budget"]');
  const stickLenOut = el.querySelector('[data-out="stickLen"]');
  const hint = el.querySelector('[data-out="hint"]');
  const dice = el.querySelector('[data-action="dice"]');

  budget.addEventListener('input', () => { budgetOut.textContent = budget.value; });
  stickLen.addEventListener('input', () => { stickLenOut.textContent = stickLen.value; });
  dice.addEventListener('click', () => {
    const w = SEED_WORDS[Math.floor(Math.random() * SEED_WORDS.length)];
    seed.value = `${w}-${Math.floor(Math.random() * 900 + 100)}`;
  });

  let hintIndex = 0;
  hint.textContent = HINTS[0];
  const rotate = () => {
    hintIndex = (hintIndex + 1) % HINTS.length;
    hint.textContent = HINTS[hintIndex];
  };
  const hintTimer = setInterval(rotate, 5000);

  el.querySelector('[data-action="start"]').addEventListener('click', () => {
    onStart({
      type: state.type,
      seed: seed.value || 'pop-1',
      budget: parseInt(budget.value, 10),
      stickLen: parseInt(stickLen.value, 10),
    });
  });

  root.appendChild(el);

  return {
    el,
    destroy() {
      clearInterval(hintTimer);
      el.remove();
    },
  };
}
