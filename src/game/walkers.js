import { LADDER } from './config.js';

export function ladderSequence() {
  return [...LADDER];
}

export function nextWalker(index) {
  if (!Number.isInteger(index) || index < 0 || index >= LADDER.length) return null;
  return LADDER[index];
}

export function walkerPhase(x, speed) {
  const stride = 10 + Math.max(speed, 0.1) * 4;
  const cycles = x / stride;
  return (cycles * Math.PI * 2) % (Math.PI * 2);
}

export function createLadderController(sim, hooks = {}) {
  const ctl = {
    index: 0,
    current: null,
    finished: false,
    ticksSinceProgress: 0,
    bestX: -Infinity,

    start() {
      this.index = 0;
      this.finished = false;
      this.ticksSinceProgress = 0;
      this.spawnCurrent();
    },

    spawnCurrent() {
      const def = nextWalker(this.index);
      if (!def) {
        this.finish('survived', null);
        return;
      }
      this.current = def;
      this.bestX = -Infinity;
      this.ticksSinceProgress = 0;
      sim.spawnWalker(def);
    },

    finish(reason, def) {
      if (this.finished) return;
      this.finished = true;
      if (hooks.onFinish) hooks.onFinish(reason, def);
    },

    readX() {
      if (sim.activeWalker && sim.activeWalker.position) return sim.activeWalker.position.x;
      if (typeof sim.walkerX === 'number') return sim.walkerX;
      return this.bestX;
    },

    tick() {
      if (this.finished || !this.current) return;
      const x = this.readX();
      if (x > this.bestX + 2) {
        this.bestX = x;
        this.ticksSinceProgress = 0;
      } else {
        this.ticksSinceProgress += 1;
        if (this.ticksSinceProgress >= 1800) {
          this.finish('stuck', this.current);
        }
      }
    },

    advance() {
      this.index += 1;
      if (hooks.onAdvance) hooks.onAdvance(this.current, this.index);
      if (!nextWalker(this.index)) {
        this.finish('survived', null);
        return;
      }
      this.spawnCurrent();
    },

    onExit(id) {
      if (this.finished || !this.current || id !== this.current.id) return;
      this.advance();
    },

    onFall(id) {
      if (this.finished || !this.current || id !== this.current.id) return;
      this.finish('collapsed', this.current);
    },

    skip(index) {
      if (this.finished) return;
      if (!nextWalker(index)) return;
      this.index = index;
      this.spawnCurrent();
    },
  };
  return ctl;
}
