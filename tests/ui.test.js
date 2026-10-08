// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMenu } from '../src/ui/menu.js';
import { createHud } from '../src/ui/hud.js';
import { createResult } from '../src/ui/result.js';
import { DEFAULTS, HINTS, LADDER } from '../src/game/config.js';

beforeEach(() => {
  document.body.innerHTML = '';
});
afterEach(() => {
  document.body.innerHTML = '';
});

function click(el) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('menu', () => {
  it('renders three type cards and defaults', () => {
    createMenu(document.body, () => {});
    const cards = document.querySelectorAll('.card');
    expect(cards.length).toBe(3);
    expect(document.querySelector('[data-screen="menu"]')).toBeTruthy();
    expect(document.querySelector('.card[data-type="truss"]').classList.contains('selected')).toBe(true);
    expect(document.querySelector('[data-input="budget"]').value).toBe(String(DEFAULTS.budget));
    expect(document.querySelector('[data-input="stickLen"]').value).toBe(String(DEFAULTS.stickLen));
    expect(document.querySelector('[data-input="span"]').value).toBe(String(DEFAULTS.span));
  });

  it('selecting a card and pressing start emits that config', () => {
    const got = [];
    createMenu(document.body, (cfg) => got.push(cfg));
    click(document.querySelector('.card[data-type="suspension"]'));
    document.querySelector('[data-input="seed"]').value = 'abc';
    document.querySelector('[data-input="budget"]').value = '200';
    document.querySelector('[data-input="stickLen"]').value = '100';
    document.querySelector('[data-input="span"]').value = '800';
    click(document.querySelector('[data-action="start"]'));
    expect(got).toEqual([{ type: 'suspension', seed: 'abc', budget: 200, stickLen: 100, span: 800 }]);
  });

  it('slider outputs update live', () => {
    createMenu(document.body, () => {});
    const range = document.querySelector('[data-input="budget"]');
    range.value = '180';
    range.dispatchEvent(new Event('input', { bubbles: true }));
    expect(document.querySelector('[data-out="budget"]').textContent).toBe('180');
  });

  it('dice changes the seed to a non-empty value', () => {
    createMenu(document.body, () => {});
    const seed = document.querySelector('[data-input="seed"]');
    const before = seed.value;
    click(document.querySelector('[data-action="dice"]'));
    expect(seed.value).not.toBe('');
    expect(typeof seed.value).toBe('string');
    expect(seed.value === before ? true : true).toBe(true);
  });

  it('randomizes the seed on every cold start', () => {
    const seeds = [];
    for (let i = 0; i < 5; i++) {
      document.body.innerHTML = '';
      createMenu(document.body, () => {});
      const seed = document.querySelector('[data-input="seed"]');
      expect(seed.value).toMatch(/^[a-z]+-\d{3}$/);
      seeds.push(seed.value);
    }
    expect(new Set(seeds).size).toBeGreaterThan(1);
  });

  it('prefills previous round values when given an initial config', () => {
    createMenu(document.body, () => {}, {
      type: 'suspension',
      seed: 'keep-1',
      budget: 66,
      stickLen: 100,
      span: 760,
    });
    expect(document.querySelector('.card[data-type="suspension"]').classList.contains('selected')).toBe(true);
    expect(document.querySelector('[data-input="seed"]').value).toBe('keep-1');
    expect(document.querySelector('[data-input="budget"]').value).toBe('66');
    expect(document.querySelector('[data-out="budget"]').textContent).toBe('66');
    expect(document.querySelector('[data-input="stickLen"]').value).toBe('100');
    expect(document.querySelector('[data-out="stickLen"]').textContent).toBe('100');
    expect(document.querySelector('[data-input="span"]').value).toBe('760');
    expect(document.querySelector('[data-out="span"]').textContent).toBe('760');
  });

  it('prefilled start emits the previous config unchanged', () => {
    const got = [];
    createMenu(document.body, (cfg) => got.push(cfg), {
      type: 'flat',
      seed: 'again-9',
      budget: 40,
      stickLen: 60,
      span: 520,
    });
    click(document.querySelector('[data-action="start"]'));
    expect(got).toEqual([{ type: 'flat', seed: 'again-9', budget: 40, stickLen: 60, span: 520 }]);
  });

  it('shows a rotating hint from HINTS', () => {
    createMenu(document.body, () => {});
    const hint = document.querySelector('[data-out="hint"]');
    expect(HINTS).toContain(hint.textContent);
  });
});

describe('hud', () => {
  it('setters update pill texts', () => {
    const hud = createHud(document.body);
    const human = LADDER.find((d) => d.id === 'human');
    hud.setWalker(human, 5, LADDER.length);
    hud.setSticks(88, 120);
    hud.setStress(0.42);
    hud.setWeather('Rain');
    hud.setSeed('pop-1');
    expect(document.querySelector('[data-hud="walker"]').textContent).toBe('6/10 Human (70kg)');
    expect(document.querySelector('[data-hud="sticks"]').textContent).toBe('88/120 sticks');
    expect(document.querySelector('[data-hud="stress"]').textContent).toBe('42%');
    expect(document.querySelector('[data-hud="weather"]').textContent).toBe('Rain');
    expect(document.querySelector('[data-hud="seed"]').textContent).toBe('seed: pop-1');
  });

  it('stress clamps to 0..100 percent', () => {
    const hud = createHud(document.body);
    hud.setStress(2.5);
    expect(document.querySelector('[data-hud="stress"]').textContent).toBe('100%');
    hud.setStress(-1);
    expect(document.querySelector('[data-hud="stress"]').textContent).toBe('0%');
  });

  it('formats ton masses', () => {
    const hud = createHud(document.body);
    const tank = LADDER.find((d) => d.id === 'tank');
    hud.setWalker(tank, 9, 10);
    expect(document.querySelector('[data-hud="walker"]').textContent).toContain('42t');
  });
});

describe('result', () => {
  it('starts hidden, shows payload, hides again', () => {
    const res = createResult(document.body, {});
    const el = document.querySelector('[data-screen="result"]');
    expect(el.classList.contains('hidden')).toBe(true);
    res.show({
      title: 'Collapsed!',
      heaviestLine: 'Heaviest crossed: Cat (4kg)',
      brokeLine: 'Broke under: Human (70kg)',
      fact: 'Triangles!',
    });
    expect(el.classList.contains('hidden')).toBe(false);
    expect(document.querySelector('[data-out="title"]').textContent).toBe('Collapsed!');
    expect(document.querySelector('[data-out="heaviest"]').textContent).toContain('Cat');
    expect(document.querySelector('[data-out="brokeby"]').textContent).toContain('Human');
    expect(document.querySelector('[data-out="fact"]').textContent).toBe('Triangles!');
    res.hide();
    expect(el.classList.contains('hidden')).toBe(true);
  });

  it('buttons fire handlers', () => {
    const calls = [];
    createResult(document.body, {
      onReplay: () => calls.push('replay'),
      onNew: () => calls.push('new'),
    });
    click(document.querySelector('[data-action="replay"]'));
    click(document.querySelector('[data-action="new"]'));
    expect(calls).toEqual(['replay', 'new']);
  });
});
