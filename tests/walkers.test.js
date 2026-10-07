import { describe, it, expect } from 'vitest';
import {
  ladderSequence,
  nextWalker,
  walkerPhase,
  createLadderController,
} from '../src/game/walkers.js';
import { LADDER } from '../src/game/config.js';

function fakeSim(xGetter) {
  return {
    spawned: [],
    spawnWalker(def) {
      this.spawned.push(def.id);
    },
    get walkerX() {
      return xGetter();
    },
  };
}

describe('ladder sequence', () => {
  it('returns a copy of LADDER', () => {
    const seq = ladderSequence();
    expect(seq).toEqual(LADDER);
    seq.pop();
    expect(ladderSequence().length).toBe(LADDER.length);
  });

  it('nextWalker walks the ladder and stops', () => {
    expect(nextWalker(0).id).toBe('fly');
    expect(nextWalker(9).id).toBe('tank');
    expect(nextWalker(10)).toBe(null);
    expect(nextWalker(-1)).toBe(null);
  });
});

describe('walkerPhase', () => {
  it('returns a phase in [0, 2pi) that grows with distance', () => {
    const a = walkerPhase(0, 1.4);
    const b = walkerPhase(100, 1.4);
    const c = walkerPhase(200, 1.4);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(Math.PI * 2);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(Math.PI * 2);
    expect(b).not.toBe(a);
    expect(c).not.toBe(b);
  });

  it('is deterministic', () => {
    expect(walkerPhase(137.5, 1.4)).toBe(walkerPhase(137.5, 1.4));
  });
});

describe('ladder controller', () => {
  it('spawns walkers in ladder order as previous ones exit', () => {
    const sim = fakeSim(() => 300);
    const ctl = createLadderController(sim);
    ctl.start();
    expect(sim.spawned).toEqual(['fly']);
    ctl.onExit('fly');
    expect(sim.spawned).toEqual(['fly', 'mouse']);
    ctl.onExit('mouse');
    expect(sim.spawned).toEqual(['fly', 'mouse', 'toycar']);
  });

  it('finishes with survived after the tank exits', () => {
    const sim = fakeSim(() => 300);
    const finishes = [];
    const ctl = createLadderController(sim, { onFinish: (reason, def) => finishes.push([reason, def]) });
    ctl.start();
    for (let i = 0; i < LADDER.length; i++) ctl.onExit(LADDER[i].id);
    expect(sim.spawned.length).toBe(LADDER.length);
    expect(ctl.finished).toBe(true);
    expect(finishes).toEqual([['survived', null]]);
    ctl.onExit('ghost');
    expect(sim.spawned.length).toBe(LADDER.length);
    expect(finishes.length).toBe(1);
  });

  it('fall stops the ladder with collapsed', () => {
    const sim = fakeSim(() => 300);
    const finishes = [];
    const ctl = createLadderController(sim, { onFinish: (reason, def) => finishes.push([reason, def]) });
    ctl.start();
    ctl.onExit('fly');
    ctl.onExit('mouse');
    ctl.onFall('toycar');
    expect(ctl.finished).toBe(true);
    expect(sim.spawned).toEqual(['fly', 'mouse', 'toycar']);
    expect(finishes.length).toBe(1);
    expect(finishes[0][0]).toBe('collapsed');
    expect(finishes[0][1].id).toBe('toycar');
  });

  it('stalls after 1800 ticks without progress', () => {
    let x = 260;
    const sim = fakeSim(() => x);
    const finishes = [];
    const ctl = createLadderController(sim, { onFinish: (reason, def) => finishes.push([reason, def]) });
    ctl.start();
    for (let i = 0; i < 1800; i++) ctl.tick();
    expect(ctl.finished).toBe(false);
    ctl.tick();
    expect(ctl.finished).toBe(true);
    expect(finishes[0][0]).toBe('stuck');
    expect(finishes[0][1].id).toBe('fly');
  });

  it('progress resets the stall counter', () => {
    let x = 260;
    const sim = fakeSim(() => x);
    const ctl = createLadderController(sim);
    ctl.start();
    for (let round = 0; round < 8; round++) {
      for (let i = 0; i < 500; i++) ctl.tick();
      x += 10;
    }
    expect(ctl.finished).toBe(false);
  });

  it('reports walker index and current def', () => {
    const sim = fakeSim(() => 300);
    const ctl = createLadderController(sim);
    ctl.start();
    expect(ctl.current.id).toBe('fly');
    expect(ctl.index).toBe(0);
    ctl.onExit('fly');
    expect(ctl.current.id).toBe('mouse');
    expect(ctl.index).toBe(1);
  });

  it('ticks before start and after finish are safe no-ops', () => {
    const sim = fakeSim(() => 300);
    const ctl = createLadderController(sim);
    expect(() => ctl.tick()).not.toThrow();
    ctl.start();
    ctl.onFall('fly');
    expect(() => ctl.tick()).not.toThrow();
  });

  it('skip jumps the ladder index and respawns', () => {
    const sim = fakeSim(() => 300);
    const ctl = createLadderController(sim);
    ctl.start();
    ctl.skip(6);
    expect(ctl.index).toBe(6);
    expect(ctl.current.id).toBe('horse');
    expect(sim.spawned).toEqual(['fly', 'horse']);
    ctl.skip(99);
    expect(ctl.index).toBe(6);
    ctl.onExit('horse');
    expect(ctl.current.id).toBe('car');
  });
});
