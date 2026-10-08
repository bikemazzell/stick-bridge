import { describe, it, expect } from 'vitest';
import { createSim } from '../src/game/physics/sim.js';
import { generateBridge } from '../src/game/bridge/generator.js';
import { createModel, addNode, addMember, deckPath } from '../src/game/model.js';
import { createLadderController } from '../src/game/walkers.js';
import { LADDER, WORLD, MASS_SCALE, worldFor } from '../src/game/config.js';
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

  it('uses the model span for spawn, cliffs and the crossing threshold', () => {
    const g = worldFor(800);
    const model = generateBridge({ type: 'flat', seed: 'sim-wide', budget: 60, stickLen: 80, span: 800 });
    const sim = createSim(model);
    sim.spawnWalker(byId('fly'));
    expect(sim.activeWalker.position.x).toBeLessThan(g.gapX0);
    expect(sim.activeWalker.position.x).toBeGreaterThan(g.gapX0 - 100);
    run(sim, 1200);
    expect(sim.walkerCrossed()).toBe(true);
    expect(sim.brokenCount).toBe(0);
  });

  it('narrow span truss carries a human across', () => {
    const model = generateBridge({ type: 'truss', seed: 'n1', budget: 200, stickLen: 80, span: 480 });
    const sim = createSim(model, { onBreak: () => { throw new Error('must not break'); } });
    sim.spawnWalker(byId('human'));
    run(sim, 1500, (s) => s.walkerCrossed());
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

  it('suspension towers stand and the main cable stays above the deck', () => {
    for (const seed of ['sus', 'e2e-susp', 'x2']) {
      const model = generateBridge({ type: 'suspension', seed, budget: 100, stickLen: 80 });
      const sim = createSim(model);
      sim.spawnWalker(byId('fly'));

      const towerTopY = deckY - model.meta.towerHeight;
      const tops = model.nodes.filter((n) => Math.abs(n.y - towerTopY) < 1);
      expect(tops.length, `tower tops for seed ${seed}`).toBeGreaterThanOrEqual(2);
      for (const t of tops) {
        const m = model.members.find((mm) => mm.material === 'stick' && (mm.a === t.id || mm.b === t.id));
        const body = sim.bodies.get(m.id);
        const ys = body.vertices.map((v) => v.y);
        const xs = body.vertices.map((v) => v.x);
        expect(Math.min(...xs), `tower top x for seed ${seed}`).toBeGreaterThan(t.x - 25);
        expect(Math.max(...xs), `tower top x for seed ${seed}`).toBeLessThan(t.x + 25);
        expect(Math.min(...ys), `tower top y for seed ${seed}`).toBeGreaterThan(towerTopY - 25);
        expect(Math.min(...ys), `tower top reaches model height for seed ${seed}`).toBeLessThan(towerTopY + 25);
      }

      let below = 0;
      for (const [id, b] of sim.nodeBodies) {
        const n = model.nodes[id];
        if (n && n.y < deckY - 5 && b && b.position.y > deckY) below++;
      }
      expect(below, `cable clamps below deck for seed ${seed}`).toBe(0);
    }
  });

  it('deck ends stay level under a heavy walker near the far anchor', () => {
    const model = generateBridge({ type: 'flat', seed: 'kink', budget: 300, stickLen: 80 });
    const sim = createSim(model);
    sim.spawnWalker(byId('human'));
    Matter.Body.setPosition(sim.activeWalker, { x: gapX1 - 60, y: deckY - 40 });
    run(sim, 400);

    const deck = deckPath(model);
    const slope = (member) => Math.abs(Math.sin(sim.bodies.get(member.id).angle));
    expect(slope(deck.members[0]), 'first panel slope').toBeLessThan(0.2);
    expect(slope(deck.members[deck.members.length - 1]), 'last panel slope').toBeLessThan(0.2);
  });

  it('a heavy walker stranded in a sag pocket struggles free and crosses', () => {
    const elephant = byId('elephant');
    const model = generateBridge({ type: 'suspension', seed: 'kink', budget: 300, stickLen: 120 });
    const sim = createSim(model);
    sim.spawnWalker(elephant);
    Matter.Body.setPosition(sim.activeWalker, { x: 640, y: deckY - elephant.size - 2 });
    run(sim, 6000, (s) => s.walkerCrossed());
    expect(sim.walkerCrossed(), 'elephant hops out of the pocket and crosses').toBe(true);
  });

  it('the formerly stuck elephant round no longer ends stuck', () => {
    const model = generateBridge({ type: 'suspension', seed: 'stuck-0', budget: 300, stickLen: 120 });
    const sim = createSim(model, {
      onWalkerExit: (id) => ctl.onExit(id),
      onWalkerFall: (id) => ctl.onFall(id),
    });
    let outcome = null;
    const ctl = createLadderController(sim, { onFinish: (reason) => { outcome = reason; } });
    ctl.start();
    for (let t = 0; t < 40000 && !ctl.finished; t++) {
      sim.tick();
      ctl.tick();
    }
    expect(outcome).not.toBe('stuck');
  });

  it('piers stand as rigid columns floor-to-deck and the bridge carries a human', () => {
    const model = generateBridge({ type: 'truss', seed: 'pier-sim', budget: 120, stickLen: 80 });
    expect(model.meta.piers).toBeGreaterThanOrEqual(2);
    const sim = createSim(model);
    sim.spawnWalker(byId('human'));

    const deckYs = new Set();
    for (const m of model.members) {
      if (!m.glued) continue;
      const body = sim.bodies.get(m.id);
      const ys = body.vertices.map((v) => v.y);
      const xs = body.vertices.map((v) => v.x);
      expect(Math.max(...ys), 'pier foot on the canyon floor').toBeGreaterThan(690);
      expect(Math.min(...ys), 'pier head at deck level').toBeLessThan(deckY + 25);
      expect(Math.max(...xs) - Math.min(...xs), 'pier column is vertical and slender').toBeLessThan(20);
      deckYs.add(body.id);
    }

    run(sim, 2000, (s) => s.walkerCrossed());
    expect(sim.walkerCrossed()).toBe(true);
  });
});
