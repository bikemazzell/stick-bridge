import Matter from 'matter-js';
import { MATERIAL, MASS_SCALE, worldFor } from '../config.js';
import { deckPath } from '../model.js';

const { Engine, World, Bodies, Body, Composite, Constraint, Vector } = Matter;

const GROUND_CATEGORY = 0x0001;
const DECK_CATEGORY = 0x0002;
const STRUCTURE_CATEGORY = 0x0004;
const WALKER_CATEGORY = 0x0008;

// structure pins are softer than the laminated deck road surface so bracing
// masses do not yank deck joints during crossings
const STRUCTURE_STIFFNESS = 0.95;

// Matter constraint points live in creation-time world axes; Matter rotates them
// itself by (body.angle - constraint.angleA) during solving. So offsets are plain
// world-axis deltas, never pre-rotated.
const offsetFrom = (body, worldPoint) => Vector.sub(worldPoint, body.position);

const constraintStretch = (constraint) =>
  Vector.magnitude(Vector.sub(Constraint.pointAWorld(constraint), Constraint.pointBWorld(constraint)));

export function createSim(model, hooks = {}) {
  const { onBreak, onWalkerExit, onWalkerFall } = hooks;
  const { width, gapX0, gapX1, deckY, groundY } = worldFor(model.span);
  const engine = Engine.create();
  engine.gravity.x = 0;
  engine.gravity.y = 1;
  engine.gravity.scale = 0.0005;
  engine.constraintIterations = 10;
  engine.positionIterations = 8;
  engine.velocityIterations = 6;

  const staticOpts = { isStatic: true, collisionFilter: { category: GROUND_CATEGORY } };
  World.add(engine.world, [
    Bodies.rectangle(width / 2, groundY + 60, width * 2, 120, staticOpts),
    Bodies.rectangle(gapX0 / 2, deckY + 300, gapX0, 600, staticOpts),
    Bodies.rectangle((gapX1 + width) / 2, deckY + 300, width - gapX1, 600, staticOpts),
  ]);

  let deck = { members: [], nodes: [] };
  try { deck = deckPath(model); } catch { /* custom test models may lack a deck */ }
  const deckMemberIds = new Set(deck.members.map((m) => m.id));
  const deckNodeIds = new Set(deck.nodes.map((n) => n.id));

  const nodesById = new Map(model.nodes.map((n) => [n.id, n]));
  const bodies = new Map();
  const nodeBodies = new Map();
  const joints = [];
  const cables = [];
  const brokenMembers = new Set();

  const stickMembers = model.members.filter((m) => m.material === 'stick');

  const memberGroup = new Map();
  const deckBodies = new Set();

  const registerGroup = (members, body, isDeck) => {
    World.add(engine.world, body);
    const group = { id: members[0].id, members, body, isDeck, strength: members.reduce((s, m) => s + m.strength, 0) };
    for (const m of members) {
      memberGroup.set(m.id, group);
      bodies.set(m.id, body);
    }
    if (isDeck) deckBodies.add(body);
    return group;
  };

  const bodyOpts = (isDeck, thick) => ({
    density: MATERIAL.stick.density,
    friction: 0.8,
    frictionAir: 0.02,
    collisionFilter: {
      group: -1,
      category: isDeck ? DECK_CATEGORY : STRUCTURE_CATEGORY,
      mask: isDeck ? WALKER_CATEGORY : 0,
    },
  });

  // Glued chains (tower stacks) become ONE rigid column body: a glued popsicle
  // stack is a solid column, and pin-chained segments buckle in the solver no
  // matter how the joints are stiffened.
  const gluedChains = [];
  {
    const chainOf = new Map(); // node id -> chain index
    for (const m of stickMembers) {
      if (!m.glued) continue;
      const ga = chainOf.get(m.a);
      const gb = chainOf.get(m.b);
      if (ga !== undefined && gb !== undefined && ga !== gb) {
        const [dst, src] = [gluedChains[ga], gluedChains[gb]];
        for (const mem of src) {
          chainOf.set(mem.a, ga);
          chainOf.set(mem.b, ga);
        }
        gluedChains[ga] = [...dst, ...src];
        gluedChains[gb] = null;
      } else if (ga !== undefined && gb === undefined) {
        chainOf.set(m.b, ga);
        gluedChains[ga].push(m);
      } else if (gb !== undefined && ga === undefined) {
        chainOf.set(m.a, gb);
        gluedChains[gb].push(m);
      } else {
        chainOf.set(m.a, gluedChains.length);
        chainOf.set(m.b, gluedChains.length);
        gluedChains.push([m]);
      }
    }
    for (const members of gluedChains) {
      if (!members) continue;
      const deg = new Map();
      for (const m of members) {
        deg.set(m.a, (deg.get(m.a) ?? 0) + 1);
        deg.set(m.b, (deg.get(m.b) ?? 0) + 1);
      }
      const ends = [...deg.entries()].filter(([, d]) => d === 1).map(([id]) => nodesById.get(id));
      if (ends.length !== 2) continue; // degenerate chain: fall through to pin grouping
      const [a, b] = ends[0].y >= ends[1].y ? [ends[0], ends[1]] : [ends[1], ends[0]];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      const body = Bodies.rectangle((a.x + b.x) / 2, (a.y + b.y) / 2, len + MATERIAL.stick.thickness, MATERIAL.stick.thickness, {
        angle: Math.atan2(dy, dx),
        ...bodyOpts(false, MATERIAL.stick.thickness),
      });
      registerGroup(members, body, false);
    }
  }

  // Parallel stick members sharing both endpoints are laminated into one body
  // (models glued popsicle laps). The laminate breaks as a unit; its joints
  // strain against the weakest member's strength.
  const groups = new Map();
  for (const member of stickMembers) {
    if (memberGroup.has(member.id)) continue; // already part of a glued chain
    const key = member.a < member.b ? `${member.a}|${member.b}` : `${member.b}|${member.a}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(member);
  }

  for (const members of groups.values()) {
    const a = nodesById.get(members[0].a);
    const b = nodesById.get(members[0].b);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const thick = MATERIAL.stick.thickness * members.length;
    const isDeck = members.some((m) => deckMemberIds.has(m.id));
    // keep the walking surface flush: laminated decks hang below the deck line
    // instead of rising above it
    const sag = isDeck ? (thick - MATERIAL.stick.thickness) / 2 : 0;
    const body = Bodies.rectangle((a.x + b.x) / 2, (a.y + b.y) / 2 + sag, len + MATERIAL.stick.thickness, thick, {
      angle: Math.atan2(dy, dx),
      ...bodyOpts(isDeck, thick),
    });
    registerGroup(members, body, isDeck);
  }

  for (const node of model.nodes) {
    if (node.fixed) continue;
    const hasStick = model.members.some(
      (m) => m.material === 'stick' && (m.a === node.id || m.b === node.id)
    );
    if (!hasStick) {
      const dot = Bodies.circle(node.x, node.y, 2, {
        density: 0.05,
        frictionAir: 0.001,
        collisionFilter: { group: -1, category: STRUCTURE_CATEGORY, mask: 0 },
      });
      World.add(engine.world, dot);
      nodeBodies.set(node.id, dot);
    }
  }

  const nodeBody = (node) => {
    if (node.fixed) return null;
    if (nodeBodies.has(node.id)) return nodeBodies.get(node.id);
    const member = model.members.find(
      (m) => m.material === 'stick' && (m.a === node.id || m.b === node.id)
    );
    return bodies.get(member.id);
  };

  const addJoint = (group, nodeId, anchorA, anchorB) => {
    const aIsDeck = anchorA.body ? deckBodies.has(anchorA.body) : deckBodies.has(anchorB.body);
    const bIsDeck = anchorB.body ? deckBodies.has(anchorB.body) : deckBodies.has(anchorA.body);
    const deckJoint = aIsDeck && bIsDeck && (deckNodeIds.has(nodeId) || group.isDeck);
    const constraint = Constraint.create({
      bodyA: anchorA.body,
      pointA: anchorA.point,
      bodyB: anchorB.body,
      pointB: anchorB.point,
      stiffness: STRUCTURE_STIFFNESS,
      damping: MATERIAL.stick.damping,
      length: 0,
    });
    World.add(engine.world, constraint);
    const joint = { memberId: group.id, nodeId, constraint, broken: false, ratio: 0 };
    joints.push(joint);
    return joint;
  };

  // One pin per adjacent pair of laminated sticks at each movable node; fixed
  // nodes pin every incident stick to the world. Structure stiffness comes from
  // triangulation (trusses) and lamination (doubled decks), not extra constraints.
  // Exception: glued members (tower stacks) get a second offset constraint per
  // joint - a pin pair welds rotation, so towers stand as rigid columns instead
  // of buckling like chains.
  const gluedGroup = (g) => g.members.some((m) => m.glued);
  const weldPoint = (group, node) => {
    const m = group.members[0];
    const other = nodesById.get(m.a === node.id ? m.b : m.a);
    const dx = other.x - node.x;
    const dy = other.y - node.y;
    const len = Math.hypot(dx, dy) || 1;
    const off = Math.min(10, len * 0.3);
    return { x: node.x + (dx / len) * off, y: node.y + (dy / len) * off };
  };

  for (const node of model.nodes) {
    const seenGroups = new Set();
    const here = [];
    for (const m of model.members) {
      if (m.material !== 'stick' || (m.a !== node.id && m.b !== node.id)) continue;
      const group = memberGroup.get(m.id);
      if (seenGroups.has(group.id)) continue;
      seenGroups.add(group.id);
      here.push({ group, end: { body: group.body, point: offsetFrom(group.body, node) } });
    }
    if (here.length === 0) continue;

    if (node.fixed) {
      const anchor = { body: null, point: { x: node.x, y: node.y } };
      for (const e of here) {
        addJoint(e.group, node.id, anchor, e.end);
        if (gluedGroup(e.group)) {
          const w = weldPoint(e.group, node);
          addJoint(e.group, node.id, { body: null, point: w }, { body: e.group.body, point: offsetFrom(e.group.body, w) });
        }
      }
    } else {
      for (let i = 1; i < here.length; i++) {
        addJoint(here[i].group, node.id, here[i - 1].end, here[i].end);
        if (gluedGroup(here[i].group) && gluedGroup(here[i - 1].group)) {
          const wA = weldPoint(here[i - 1].group, node);
          const wB = weldPoint(here[i].group, node);
          addJoint(
            here[i].group,
            node.id,
            { body: here[i - 1].group.body, point: offsetFrom(here[i - 1].group.body, wA) },
            { body: here[i].group.body, point: offsetFrom(here[i].group.body, wB) },
          );
        }
      }
    }
  }

  for (const member of cableMembers(model)) {
    const a = nodesById.get(member.a);
    const b = nodesById.get(member.b);
    const bodyA = nodeBody(a);
    const bodyB = nodeBody(b);
    const endA = { body: bodyA, point: bodyA ? offsetFrom(bodyA, a) : { x: a.x, y: a.y } };
    const endB = { body: bodyB, point: bodyB ? offsetFrom(bodyB, b) : { x: b.x, y: b.y } };
    const restLength = member.restLength ?? Vector.magnitude(Vector.sub(a, b));
    const constraint = Constraint.create({
      bodyA: endA.body,
      pointA: endA.point,
      bodyB: endB.body,
      pointB: endB.point,
      stiffness: MATERIAL.cable.stiffness,
      damping: MATERIAL.cable.damping,
      length: restLength,
    });
    World.add(engine.world, constraint);
    cables.push({
      memberId: member.id,
      member,
      constraint,
      restLength,
      strength: member.strength,
      broken: false,
      endA,
      endB,
    });
  }

  function* cableMembers(m) {
    for (const mem of m.members) if (mem.material === 'cable') yield mem;
  }

  const removeMember = (memberId) => {
    const group = memberGroup.get(memberId);
    const dead = group ? group.members : [model.members[memberId]];
    for (const m of dead) {
      if (brokenMembers.has(m.id)) continue;
      brokenMembers.add(m.id);
      if (onBreak) onBreak(m.id);
    }
    if (group && group.body) {
      // keep broken members in the world as tumbling debris; they only collide
      // with the ground afterwards (never with the bridge or walkers)
      group.body.collisionFilter.mask = GROUND_CATEGORY;
      group.body.plugin.debris = true;
      group.body.plugin.brokeAt = sim.time;
      debris.push(group.body);
      for (const j of joints) {
        if (j.memberId === group.id && !j.broken) {
          j.broken = true;
          j.ratio = 0;
          World.remove(engine.world, j.constraint);
        }
      }
    }
    for (const c of cables) {
      if (c.memberId === memberId && !c.broken) {
        c.broken = true;
        World.remove(engine.world, c.constraint);
      }
    }
  };

  let walker = null;
  let walkerDef = null;
  let crossed = false;
  let fell = false;
  let settled = false;
  const debris = [];

  const updateCableSlack = () => {
    for (const c of cables) {
      if (c.broken) continue;
      const d = constraintStretch(c.constraint);
      c.constraint.stiffness = d < c.restLength ? 0 : MATERIAL.cable.stiffness;
    }
  };
  updateCableSlack();

  const settle = (ticks = 450) => {
    for (let i = 0; i < ticks; i++) {
      Engine.update(engine, 1000 / 60);
      updateCableSlack();
    }
    // freeze residual ringing so the first live tick measures static strain only
    for (const body of Composite.allBodies(engine.world)) {
      if (body.isStatic) continue;
      Body.setVelocity(body, { x: 0, y: 0 });
      Body.setAngularVelocity(body, 0);
    }
    // glue pre-tension: record each joint's settled stretch as its baseline;
    // strain counts only load BEYOND the settled state
    for (const j of joints) {
      j.baseline = constraintStretch(j.constraint);
      j.ratio = 0;
    }
  };

  const sim = {
    engine,
    bodies,
    nodeBodies,
    joints,
    cables,
    debris,
    time: 0,
    get activeWalker() { return walker; },
    get brokenCount() { return brokenMembers.size; },

    spawnWalker(def) {
      if (!settled) { settle(); settled = true; }
      if (walker) World.remove(engine.world, walker);
      walkerDef = def;
      crossed = false;
      fell = false;
      walker = Bodies.circle(gapX0 - 60, deckY - def.size - 10, def.size, {
        density: 0.001,
        friction: 0.05,
        frictionStatic: 0.1,
        restitution: 0,
        collisionFilter: { group: 0, category: WALKER_CATEGORY, mask: GROUND_CATEGORY | DECK_CATEGORY },
      });
      Body.setMass(walker, def.massKg * MASS_SCALE);
      World.add(engine.world, walker);
    },

    walkerCrossed() { return crossed; },
    walkerFell() { return fell; },

    maxStrainRatio() {
      let max = 0;
      for (const j of joints) if (!j.broken && Math.abs(j.ratio) > max) max = Math.abs(j.ratio);
      return max;
    },

    tick(dtMs = 1000 / 60) {
      if (walker && !crossed && !fell) {
        const target = walkerDef.speed;
        const dv = Math.max(-0.08, Math.min(0.08, target - walker.velocity.x));
        Body.setVelocity(walker, { x: walker.velocity.x + dv, y: walker.velocity.y });
      }
      Engine.update(engine, dtMs);
      sim.time++;

      for (const j of joints) {
        if (j.broken) continue;
        const group = memberGroup.get(j.memberId);
        j.ratio = (constraintStretch(j.constraint) - j.baseline) / group.strength;
        if (j.ratio >= 1) removeMember(j.memberId);
      }

      for (const c of cables) {
        if (c.broken) continue;
        const d = constraintStretch(c.constraint);
        c.constraint.stiffness = d < c.restLength ? 0 : MATERIAL.cable.stiffness;
        const ratio = (d - c.restLength) / c.strength;
        if (ratio >= 1) removeMember(c.memberId);
      }

      if (walker && !crossed && !fell) {
        if (walker.position.x > gapX1 + 60) {
          crossed = true;
          if (onWalkerExit) onWalkerExit(walkerDef.id);
        } else if (walker.position.y > deckY + 120) {
          fell = true;
          if (onWalkerFall) onWalkerFall(walkerDef.id);
        }
      }
    },
  };

  return sim;
}
