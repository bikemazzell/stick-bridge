export function createResult(root, handlers = {}) {
  const el = document.createElement('div');
  el.className = 'overlay result hidden';
  el.dataset.screen = 'result';
  el.innerHTML = `
    <div class="panel">
      <h2 class="rtitle" data-out="title">Collapsed!</h2>
      <p class="rline" data-out="heaviest"></p>
      <p class="rline" data-out="brokeby"></p>
      <p class="fact" data-out="fact"></p>
      <div class="row">
        <button data-action="replay">Replay</button>
        <button data-action="new" class="secondary">New Bridge</button>
      </div>
    </div>
  `;
  el.querySelector('[data-action="replay"]').addEventListener('click', () => handlers.onReplay && handlers.onReplay());
  el.querySelector('[data-action="new"]').addEventListener('click', () => handlers.onNew && handlers.onNew());
  root.appendChild(el);

  const q = (name) => el.querySelector(`[data-out="${name}"]`);

  return {
    el,
    show({ title, heaviestLine, brokeLine, fact }) {
      q('title').textContent = title;
      q('heaviest').textContent = heaviestLine;
      q('brokeby').textContent = brokeLine;
      q('fact').textContent = fact;
      el.classList.remove('hidden');
    },
    hide() {
      el.classList.add('hidden');
    },
    destroy() {
      el.remove();
    },
  };
}
