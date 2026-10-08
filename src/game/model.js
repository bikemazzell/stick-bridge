import { worldFor } from './config.js';

export function createModel(type, seed, budget, stickLen, span) {
  return {
    type,
    seed,
    budget,
    stickLen,
    span: span ?? 640,
    nodes: [],
    members: [],
    meta: {},
  };
}

export function addNode(model, x, y, fixed = false) {
  const node = { id: model.nodes.length, x, y, fixed };
  model.nodes.push(node);
  return node;
}

export function addMember(model, aId, bId, material, strength) {
  const member = {
    id: model.members.length,
    a: aId,
    b: bId,
    material,
    strength: strength ?? (material === 'stick' ? 3.0 : 14.0),
  };
  model.members.push(member);
  return member;
}

export function sticksUsed(model) {
  return model.members.filter((m) => m.material === 'stick').length;
}

export function validate(model) {
  const errors = [];
  const nodeIds = new Set(model.nodes.map((n) => n.id));
  for (const n of model.nodes) {
    if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) {
      errors.push('node has non-finite coordinates');
    }
  }
  for (const m of model.members) {
    if (!nodeIds.has(m.a) || !nodeIds.has(m.b)) {
      errors.push('member references missing node');
    }
  }
  const byId = new Map(model.nodes.map((n) => [n.id, n]));
  for (const m of model.members) {
    const a = byId.get(m.a);
    const b = byId.get(m.b);
    if (a && b && Math.hypot(a.x - b.x, a.y - b.y) < 1e-6) {
      errors.push('zero-length member');
    }
  }
  return errors;
}

export function isConnected(model) {
  if (model.nodes.length === 0) return true;
  const adj = new Map(model.nodes.map((n) => [n.id, []]));
  for (const m of model.members) {
    if (adj.has(m.a) && adj.has(m.b)) {
      adj.get(m.a).push(m.b);
      adj.get(m.b).push(m.a);
    }
  }
  const start = model.nodes[0].id;
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift();
    for (const next of adj.get(cur) || []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen.size === model.nodes.length;
}

export function deckPath(model, epsilon = 5) {
  const { gapX0, gapX1, deckY } = worldFor(model.span);
  const deckNodes = model.nodes
    .filter((n) => Math.abs(n.y - deckY) <= epsilon)
    .sort((a, b) => a.x - b.x);
  const left = deckNodes.find((n) => n.x <= gapX0 + epsilon);
  const right = deckNodes.find((n) => n.x >= gapX1 - epsilon);
  if (!left || !right) {
    throw new Error('deck anchors not found at deck level');
  }
  const adj = new Map(deckNodes.map((n) => [n.id, []]));
  const byId = new Map(model.nodes.map((n) => [n.id, n]));
  for (const m of model.members) {
    const a = byId.get(m.a);
    const b = byId.get(m.b);
    if (a && b && adj.has(m.a) && adj.has(m.b)) {
      adj.get(m.a).push({ node: m.b, member: m });
      adj.get(m.b).push({ node: m.a, member: m });
    }
  }
  const prev = new Map([[left.id, null]]);
  const queue = [left.id];
  while (queue.length) {
    const cur = queue.shift();
    if (cur === right.id) break;
    for (const { node } of adj.get(cur) || []) {
      if (!prev.has(node)) {
        prev.set(node, cur);
        queue.push(node);
      }
    }
  }
  if (!prev.has(right.id)) {
    throw new Error('deck is not connected between anchors');
  }
  const nodes = [];
  for (let cur = right.id; cur !== null; cur = prev.get(cur)) {
    nodes.unshift(byId.get(cur));
  }
  const memberIds = new Set();
  for (let i = 1; i < nodes.length; i++) {
    for (const { member } of adj.get(nodes[i - 1].id) || []) {
      const other = member.a === nodes[i - 1].id ? member.b : member.a;
      if (other === nodes[i].id) memberIds.add(member.id);
    }
  }
  return { nodes, members: [...memberIds].map((id) => model.members[id]) };
}
