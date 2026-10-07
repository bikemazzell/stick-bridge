function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

export function hashSeed(str) {
  return xmur3(String(str))();
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const s = typeof seed === 'string' ? hashSeed(seed) : seed >>> 0;
  return mulberry32(s);
}

export function rngHelpers(rng) {
  return {
    range(min, max) {
      return min + rng() * (max - min);
    },
    int(min, max) {
      return Math.floor(min + rng() * (max - min + 1));
    },
    pick(arr) {
      return arr[Math.floor(rng() * arr.length)];
    },
    jitter(amount) {
      return (rng() * 2 - 1) * amount;
    },
    chance(p) {
      return rng() < p;
    },
  };
}
