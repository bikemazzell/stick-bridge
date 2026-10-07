import { describe, it, expect } from 'vitest';
import { createSim } from '../src/game/physics/sim.js';
import { generateBridge } from '../src/game/bridge/generator.js';
import { createModel, addNode, addMember, deckPath } from '../src/game/model.js';
import { LADDER, WORLD, MASS_SCALE } from '../src/game/config.js';
import Matter from 'matter-js';

const { gapX0, gapX1, deckY } = WORLD;
const byId = (id) => LADDER.find((w) => w.id === id);

function run(sim, maxTicks, until) {
  for (let i = 0; i < maxTicks; i++) {
    sim.tick();
    if (until && until(sim)) return i;
  }
  return maxTicks;
}

describe('physics simulation', () => {
  it('flat bridge carries a fly across without breaking', () => {
    const model = generateBridge({ type: 'flat', seed: 'sim-flat', budget: 30, stickLen: 80 });
    const sim = createSim(model);
    sim.spawnWalker(byId('fly'));
    run(sim, 900);
    expect(sim.walkerCrossed()).toBe(true);
    expect(sim.brokenCount).toBe(0);
  });

  it('flat minimal deck breaks under a human and the walker falls', () => {
    const model = generateBridge({ type: 'flat', seed: 'sim-flat', budget: 30, stickLen: 80 });
    const events = { breaks: [], falls: [] };
    const sim = createSim(model, {
      onBreak: (id) => events.breaks.push(id),
      onWalkerFall: (name) => events.falls.push(name),
    });
    sim.spawnWalker(byId('human'));
    run(sim, 600);
    expect(sim.brokenCount).toBeGreaterThan(0);
    expect(events.breaks.length).toBe(sim.brokenCount);
    expect(events.falls).toEqual(['human']);
    expect(sim.walkerFell()).toBe(true);
  });

  it('truss bridge carries a human across intact', () => {
    const model = generateBridge({ type: 'truss', seed: 'sim-truss', budget: 200, stickLen: 80 });
    const sim = createSim(model, { onBreak: () => { throw new Error('must not break'); } });
    sim.spawnWalker(byId('human'));
    run(sim, 1500);
    expect(sim.walkerCrossed()).toBe(true);
    expect(sim.brokenCount).toBe(0);
  });

  it('a tank destroys any bridge quickly', () => {
    const model = generateBridge({ type: 'flat', seed: 'sim-tank', budget: 300, stickLen: 80 });
    const sim = createSim(model);
    sim.spawnWalker(byId('tank'));
    run(sim, 300);
    expect(sim.brokenCount).toBeGreaterThan(0);
  });

  it('cables go slack when compressed, hold when taut, and snap when overstretched', () => {
    const makeModel = (strength) => {
      const m = createModel('flat', 'slack', 10, 80);
      const a = addNode(m, 600, 200, true);
      const b = addNode(m, 600, 260);
      const cable = addMember(m, a.id, b.id, 'cable', strength);
      cable.restLength = 100;
      return { m, b };
    };

    const strong = makeModel(14);
    const simStrong = createSim(strong.m);
    expect(simStrong.cables[0].constraint.stiffness).toBe(0);
    run(simStrong, 240);
    expect(simStrong.cables[0].constraint.stiffness).toBeGreaterThan(0);
    expect(simStrong.brokenCount).toBe(0);
    const bodyB = simStrong.nodeBodies.get(strong.b.id);
    expect(bodyB.position.y).toBeGreaterThan(290);
    expect(bodyB.position.y).toBeLessThan(360);

    const weak = makeModel(0.5);
    const breaks = [];
    const simWeak = createSim(weak.m, { onBreak: (id) => breaks.push(id) });
    Matter.Body.setVelocity(simWeak.nodeBodies.get(weak.b.id), { x: 0, y: 6 });
    run(simWeak, 300, (s) => s.brokenCount > 0);
    expect(simWeak.brokenCount).toBe(1);
    expect(breaks).toEqual([0]);
  });

  it('is deterministic for identical models and op sequences', () => {
    const runOnce = () => {
      const model = generateBridge({ type: 'flat', seed: 'sim-det', budget: 30, stickLen: 80 });
      const breaks = [];
      const sim = createSim(model, { onBreak: (id) => breaks.push(id) });
      sim.spawnWalker(byId('human'));
      run(sim, 600);
      return { breaks, broken: sim.brokenCount };
    };
    expect(runOnce()).toEqual(runOnce());
  });

  it('mid-deck joints strain more than anchor joints under a centered load', () => {
    const model = generateBridge({ type: 'flat', seed: 'sim-strain', budget: 30, stickLen: 80 });
    const sim = createSim(model);
    sim.spawnWalker(byId('human'));
    Matter.Body.setPosition(sim.activeWalker, { x: 600, y: deckY - 40 });
    run(sim, 150);

    const deck = deckPath(model);
    const midJoints = sim.joints.filter((j) => j.nodeId === deck.nodes[4].id);
    const edgeJoints = sim.joints.filter((j) => j.nodeId === deck.nodes[1].id);
    const maxRatio = (js) => Math.max(...js.filter((j) => !j.broken).map((j) => Math.abs(j.ratio)));
    expect(maxRatio(midJoints)).toBeGreaterThan(maxRatio(edgeJoints));
    expect(sim.maxStrainRatio()).toBeGreaterThan(0);
  });

  it('walkers spawn left of the gap with scaled mass', () => {
    const model = generateBridge({ type: 'flat', seed: 'sim-spawn', budget: 30, stickLen: 80 });
    const sim = createSim(model);
    sim.spawnWalker(byId('human'));
    const w = sim.activeWalker;
    expect(w.position.x).toBeLessThan(gapX0);
    expect(w.position.y).toBeLessThan(deckY);
    expect(w.mass).toBeCloseTo(byId('human').massKg * MASS_SCALE, 5);
    expect(sim.walkerCrossed()).toBe(false);
    expect(sim.walkerFell()).toBe(false);
  });
});
