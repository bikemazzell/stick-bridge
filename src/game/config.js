export const WORLD = {
  width: 1280,
  height: 720,
  gapX0: 320,
  gapX1: 960,
  deckY: 400,
  groundY: 700,
};

export const SPAN = {
  min: 480,
  max: 800,
  default: 640,
};

// Per-round world geometry: the canyon gap is centered and as wide as the
// requested span. Canvas size, deck line, and ground stay fixed.
export function worldFor(span) {
  const requested = Number.isFinite(span) ? span : SPAN.default;
  const clamped = Math.max(SPAN.min, Math.min(SPAN.max, Math.round(requested)));
  const gapX0 = (WORLD.width - clamped) / 2;
  return {
    width: WORLD.width,
    height: WORLD.height,
    gapX0,
    gapX1: gapX0 + clamped,
    deckY: WORLD.deckY,
    groundY: WORLD.groundY,
  };
}

export const MATERIAL = {
  stick: {
    breakStretch: 0.6,
    stiffness: 0.95,
    damping: 0.05,
    thickness: 6,
    density: 0.0002,
  },
  cable: {
    breakStretch: 14.0,
    stiffness: 0.06,
    damping: 0,
    thickness: 3,
  },
};

export const MASS_SCALE = 0.05;

// stuck walker shows its frustration bubble after 5 s (60 ticks/s) in one spot
export const STUCK_BUBBLE_TICKS = 300;

export const LADDER = [
  { id: 'fly', name: 'Fly', massKg: 0.01, speed: 2.0, size: 5, fact: 'A fly weighs about as much as a raindrop.' },
  { id: 'mouse', name: 'Mouse', massKg: 0.05, speed: 1.8, size: 8, fact: 'A mouse weighs less than a slice of bread.' },
  { id: 'toycar', name: 'Toy Car', massKg: 0.5, speed: 2.4, size: 12, fact: 'First real test: half a kilogram of plastic.' },
  { id: 'cat', name: 'House Cat', massKg: 4, speed: 1.6, size: 16, fact: 'Cats land on their feet. Bridges do not.' },
  { id: 'dog', name: 'Dog', massKg: 15, speed: 1.6, size: 20, fact: 'A medium dog, eager to cross.' },
  { id: 'human', name: 'Human', massKg: 70, speed: 1.4, size: 26, fact: 'The classic popsicle bridge contest load.' },
  { id: 'horse', name: 'Horse', massKg: 400, speed: 1.2, size: 34, fact: 'Horses were the trucks of the old world.' },
  { id: 'car', name: 'Car', massKg: 1200, speed: 1.8, size: 34, fact: 'A family car is about 17 humans.' },
  { id: 'elephant', name: 'Elephant', massKg: 5000, speed: 1.0, size: 44, fact: 'Elephants avoid bridges for a reason.' },
  { id: 'tank', name: 'Tank', massKg: 42000, speed: 0.9, size: 40, fact: 'The final boss of bridge testing.' },
];

export const FACTS = {
  flat: [
    'A flat beam sags in the middle because every load bends it. Bending pulls the bottom apart (tension) and squeezes the top together (compression).',
    'Doubling the deck doubles the glue area and roughly doubles the strength. That is why layered sticks beat a single layer.',
  ],
  truss: [
    'A truss turns bending into pure pushes and pulls. Each triangle passes load along its sides, so no single stick has to bend.',
    'In a Pratt truss the diagonals stretch (tension) and the verticals squeeze (compression). The Howe truss flips those roles.',
    'Warren trusses use equilateral triangles so load spreads evenly across many members.',
  ],
  suspension: [
    'A suspension bridge hangs the deck from cables. The cables carry tension, and the towers push down into the ground.',
    'The main cable sags in a curve, so each hanger takes only a slice of the deck load.',
  ],
};

export const HINTS = [
  'Triangles do not bend like squares. That is why trusses are strong.',
  'Cables are great at pulling and useless at pushing.',
  'Glued laps spread the load. One stick alone snaps, a laminate bends far less.',
  'Real contest bridges built from about 100 sticks have held over 90 kg.',
  'A bridge fails where its weakest joint is. Watch the red sticks.',
];

export const DEFAULTS = {
  type: 'truss',
  budget: 120,
  stickLen: 80,
  span: SPAN.default,
};
