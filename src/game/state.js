import { FACTS } from './config.js';
import { hashSeed } from './rng.js';

export function createGameState() {
  return {
    state: 'menu',
    config: null,
    walkerIndex: 0,
    heaviestCrossedKg: 0,
    heaviestCrossedName: null,
    brokeBy: null,
    resultReason: null,
    fact: null,
    brokenMembers: [],
  };
}

function pickFact(config) {
  const pool = FACTS[config.type];
  if (!pool || pool.length === 0) return null;
  return pool[hashSeed(String(config.seed)) % pool.length];
}

function freshRound(prev) {
  return {
    ...prev,
    walkerIndex: 0,
    heaviestCrossedKg: 0,
    heaviestCrossedName: null,
    brokeBy: null,
    resultReason: null,
    fact: null,
    brokenMembers: [],
  };
}

export function transition(gs, event, payload) {
  const handlers = {
    menu: {
      START: (g) => ({ ...freshRound(g), state: 'building', config: payload }),
    },
    building: {
      BUILT: (g) => ({ ...g, state: 'testing', fact: pickFact(g.config) }),
      EXIT: () => createGameState(),
    },
    testing: {
      WALKER_EXIT: (g) => {
        const heavier = payload.massKg > g.heaviestCrossedKg;
        return {
          ...g,
          walkerIndex: g.walkerIndex + 1,
          heaviestCrossedKg: heavier ? payload.massKg : g.heaviestCrossedKg,
          heaviestCrossedName: heavier ? payload.name : g.heaviestCrossedName,
        };
      },
      WALKER_FALL: (g) => ({
        ...g,
        state: 'result',
        resultReason: 'collapsed',
        brokeBy: { name: payload.name, massKg: payload.massKg },
      }),
      BROKE: (g) => ({ ...g, brokenMembers: [...g.brokenMembers, payload.memberId] }),
      DONE: (g) => ({
        ...g,
        state: 'result',
        resultReason: payload && payload.reason ? payload.reason : 'survived',
      }),
      EXIT: () => createGameState(),
    },
    result: {
      REPLAY: (g) => ({ ...freshRound(g), state: 'building', config: g.config, fact: pickFact(g.config) }),
      NEW: () => createGameState(),
    },
  };

  const handler = handlers[gs.state] && handlers[gs.state][event];
  if (!handler) return gs;
  return handler(gs);
}
