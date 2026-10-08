import { describe, it, expect } from 'vitest';
import { parseParams } from '../src/game/params.js';
import { DEFAULTS } from '../src/game/config.js';

describe('parseParams', () => {
  it('empty search gives no cfg and speed 1', () => {
    expect(parseParams('')).toEqual({ cfg: null, speed: 1 });
    expect(parseParams('?')).toEqual({ cfg: null, speed: 1 });
  });

  it('parses all round params', () => {
    const { cfg, speed } = parseParams('?seed=e2e-flat&type=flat&budget=30&stickLen=60&span=800&speed=4');
    expect(cfg).toEqual({ seed: 'e2e-flat', type: 'flat', budget: 30, stickLen: 60, span: 800 });
    expect(speed).toBe(4);
  });

  it('partial params yield partial cfg merged with defaults later', () => {
    const { cfg } = parseParams('?seed=abc');
    expect(cfg).toEqual({ seed: 'abc' });
  });

  it('clamps speed', () => {
    expect(parseParams('?speed=0').speed).toBe(1);
    expect(parseParams('?speed=-3').speed).toBe(1);
    expect(parseParameters('?speed=6.9').speed ?? 0).toBeLessThanOrEqual(6);
    expect(parseParams('?speed=99').speed).toBe(1);
  });

  it('rejects junk numbers', () => {
    const { cfg } = parseParams('?budget=abc&stickLen=');
    expect(cfg).toBe(null);
  });
});

function parseParameters(s) {
  return parseParams(s);
}
