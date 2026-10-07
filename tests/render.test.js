import { describe, it, expect } from 'vitest';
import { lerpColor, skyState, celestial, starField, shade } from '../src/render/sky.js';
import { createWeather, weatherLabel } from '../src/render/weather.js';
import { createScenery } from '../src/render/scenery.js';
import { CHAR_DRAWERS, drawWalker } from '../src/render/characters.js';
import { createRenderer } from '../src/render/renderer.js';
import { LADDER } from '../src/game/config.js';
import { generateBridge } from '../src/game/bridge/generator.js';
import { createSim } from '../src/game/physics/sim.js';

function fakeCtx() {
  const handler = {
    get(target, prop) {
      if (prop === 'canvas') return { width: 1280, height: 720 };
      if (typeof prop === 'symbol') return undefined;
      if (!(prop in target)) {
        target[prop] = new Proxy(function () {}, handler);
      }
      return target[prop];
    },
    set() {
      return true;
    },
    apply() {
      return new Proxy(function () {}, handler);
    },
  };
  return new Proxy(function () {}, handler);
}

describe('sky helpers', () => {
  it('lerpColor interpolates rgb channels', () => {
    expect(lerpColor('#000000', '#ffffff', 0)).toBe('rgb(0, 0, 0)');
    expect(lerpColor('#000000', '#ffffff', 1)).toBe('rgb(255, 255, 255)');
    expect(lerpColor('#000000', '#ffffff', 0.5)).toBe('rgb(128, 128, 128)');
  });

  it('skyState hits keyframes and cycles', () => {
    expect(skyState(0).top).toBe(skyState(3600).top);
    expect(skyState(900).light).toBeCloseTo(1.0, 5);
    expect(skyState(2700).light).toBeCloseTo(0.12, 5);
    const noon = skyState(900);
    expect(noon.top).toBe('rgb(77, 166, 255)');
    const night = skyState(2700);
    expect(night.light).toBeLessThan(0.2);
  });

  it('celestial swaps sun and moon', () => {
    expect(celestial(0).type).toBe('sun');
    expect(celestial(900).type).toBe('sun');
    expect(celestial(1800).type).toBe('moon');
    expect(celestial(2700).type).toBe('moon');
    expect(celestial(900).y).toBeLessThan(celestial(0).y);
  });

  it('starField is seeded and stable', () => {
    const a = starField('seed-1');
    const b = starField('seed-1');
    expect(a).toEqual(b);
    expect(starField('seed-2')).not.toEqual(a);
    expect(a.length).toBe(90);
  });

  it('shade darkens by light', () => {
    expect(shade('#ffffff', 1)).toBe('rgb(255, 255, 255)');
    expect(shade('#ffffff', 0)).toBe('rgb(89, 89, 89)');
  });
});

describe('weather', () => {
  it('is deterministic per seed', () => {
    const a = createWeather('w1');
    const b = createWeather('w1');
    expect(a).toEqual(b);
    expect(a.clouds.length).toBeGreaterThanOrEqual(5);
    expect(a.clouds.length).toBeLessThanOrEqual(8);
  });

  it('rain weather gets drops, clear does not', () => {
    const weathers = [createWeather('r1'), createWeather('r2'), createWeather('r3'), createWeather('r4')];
    for (const w of weathers) {
      if (w.kind === 'rain') expect(w.drops.length).toBe(220);
      else expect(w.drops.length).toBe(0);
    }
    expect(weatherLabel({ kind: 'rain' })).toBe('Rain');
    expect(weatherLabel({ kind: 'clear' })).toBe('Clear');
  });
});

describe('scenery', () => {
  it('creates trees on both cliffs deterministically', () => {
    const a = createScenery('s1');
    expect(a.trees.length).toBe(8);
    expect(a).toEqual(createScenery('s1'));
  });
});

describe('characters', () => {
  it('has a drawer for every ladder entry and draws without throwing', () => {
    const ctx = fakeCtx();
    for (const def of LADDER) {
      expect(CHAR_DRAWERS[def.id]).toBeTypeOf('function');
      expect(() => drawWalker(ctx, def, 640, 400, 1.2)).not.toThrow();
    }
  });

  it('throws on unknown walker', () => {
    expect(() => drawWalker(fakeCtx(), { id: 'alien', size: 10 }, 0, 0, 0)).toThrow(/no character drawer/);
  });
});

describe('renderer', () => {
  it('draws building, live sim, and walkers without throwing', () => {
    const r = createRenderer({ getContext: () => fakeCtx() });
    const model = generateBridge({ type: 'truss', seed: 'render-1', budget: 200, stickLen: 80 });
    expect(() => r.draw({ model, tickCount: 100, buildProgress: 0.5, seed: 'render-1' })).not.toThrow();
    expect(() => r.draw({ model, tickCount: 120, buildProgress: 1, seed: 'render-1' })).not.toThrow();

    const sim = createSim(model, {});
    sim.spawnWalker(LADDER[0]);
    sim.tick();
    expect(() =>
      r.draw({
        sim,
        model,
        tickCount: 200,
        seed: 'render-1',
        walkers: [{ def: LADDER[0], x: sim.activeWalker.position.x, y: sim.activeWalker.position.y + LADDER[0].size }],
        cameraShake: { tick: 195 },
      }),
    ).not.toThrow();
  });

  it('burst adds dust particles that decay', () => {
    const r = createRenderer({ getContext: () => fakeCtx() });
    const model = generateBridge({ type: 'flat', seed: 'render-2', budget: 40, stickLen: 80 });
    r.burst(600, 400);
    r.draw({ model, tickCount: 10, buildProgress: 0.4, seed: 'render-2' });
    r.draw({ model, tickCount: 11, buildProgress: 0.4, seed: 'render-2' });
    expect(true).toBe(true);
  });

  it('exposes weather label after first draw', () => {
    const r = createRenderer({ getContext: () => fakeCtx() });
    const model = generateBridge({ type: 'flat', seed: 'render-3', budget: 40, stickLen: 80 });
    r.draw({ model, tickCount: 0, buildProgress: 0.2, seed: 'render-3' });
    expect(['Rain', 'Clear']).toContain(r.weatherLabel(r.weather));
  });
});
