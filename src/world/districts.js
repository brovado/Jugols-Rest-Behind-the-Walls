export const DISTRICTS = {
  camp: {
    id: 'camp',
    displayName: 'Camp',
    background: {
      imageKey: 'city',
      color: 0x111827,
      tint: 0x9ca3af,
    },
    spawn: { x: 520, y: 720 },
    spawnAnchors: {
      OVERGROWTH: [],
      ROUTE: [],
      RUCKUS: [],
      LOT: [],
    },
    dayLocations: {},
    shrineAnchors: [],
    campStructures: [
      {
        id: 'stable',
        label: 'Stable',
        action: 'Tend the Pack',
        x: 420,
        y: 760,
        color: 0x38bdf8,
      },
      {
        id: 'house',
        label: 'House',
        action: 'Rest',
        x: 680,
        y: 600,
        color: 0xfbbf24,
      },
    ],
    campNpcs: [
      { x: 360, y: 720, label: 'Warden', color: 0x94a3b8 },
      { x: 520, y: 700, label: 'Warden', color: 0x94a3b8 },
      { x: 600, y: 760, label: 'Warden', color: 0x94a3b8 },
    ],
    gateways: [
      {
        x: 1700,
        y: 520,
        w: 240,
        h: 200,
        toDistrictId: 'heart',
        spawnX: 260,
        spawnY: 760,
        label: 'Enter Jugol’s Rest',
      },
    ],
  },
  heart: {
    id: 'heart',
    displayName: 'Heart District',
    background: {
      imageKey: 'city',
      color: 0x1f2937,
      tint: 0xffffff,
    },
    spawnAnchors: {
      OVERGROWTH: [
        { x: 1380, y: 220 },
        { x: 1540, y: 410 },
        { x: 1220, y: 520 },
        { x: 1640, y: 640 },
        { x: 1180, y: 320 },
      ],
      ROUTE: [
        { x: 1260, y: 610 },
        { x: 1500, y: 520 },
        { x: 1060, y: 700 },
      ],
      RUCKUS: [
        { x: 1100, y: 890 },
        { x: 1400, y: 900 },
        { x: 1280, y: 980 },
      ],
      LOT: [
        { x: 1520, y: 760 },
        { x: 1200, y: 840 },
      ],
    },
    dayLocations: {
      butcher: { x: 350, y: 260 },
      tavern: { x: 880, y: 320 },
      market: { x: 620, y: 720 },
    },
    shrineAnchors: [
      { x: 540, y: 420 },
      { x: 760, y: 460 },
      { x: 980, y: 520 },
      { x: 620, y: 900 },
    ],
    campAnchors: [
      { x: 480, y: 980 },
      { x: 560, y: 1020 },
    ],
    gateways: [
      {
        x: 240,
        y: 920,
        w: 240,
        h: 200,
        toDistrictId: 'camp',
        spawnX: 1560,
        spawnY: 620,
        label: 'Exit to Camp',
      },
      {
        x: 1850,
        y: 120,
        w: 140,
        h: 240,
        toDistrictId: 'arcane',
        spawnX: 170,
        spawnY: 220,
        label: 'To Arcane District',
      },
      {
        x: 0,
        y: 760,
        w: 140,
        h: 240,
        toDistrictId: 'verdent',
        spawnX: 1820,
        spawnY: 840,
        label: 'To Verdent District',
      },
    ],
  },
  arcane: {
    id: 'arcane',
    displayName: 'Arcane District',
    background: {
      imageKey: 'city',
      color: 0x0f172a,
      tint: 0x9ca3af,
    },
    spawnAnchors: {
      OVERGROWTH: [
        { x: 1480, y: 260 },
        { x: 1680, y: 460 },
        { x: 1320, y: 520 },
        { x: 1600, y: 720 },
        { x: 1420, y: 360 },
      ],
      ROUTE: [
        { x: 1240, y: 640 },
        { x: 1460, y: 580 },
        { x: 1100, y: 740 },
      ],
      RUCKUS: [
        { x: 1040, y: 820 },
        { x: 1320, y: 940 },
        { x: 1500, y: 900 },
      ],
      LOT: [
        { x: 1540, y: 820 },
        { x: 1180, y: 900 },
      ],
    },
    dayLocations: {
      butcher: { x: 420, y: 220 },
      tavern: { x: 900, y: 260 },
      market: { x: 720, y: 680 },
    },
    shrineAnchors: [
      { x: 520, y: 380 },
      { x: 760, y: 540 },
      { x: 980, y: 600 },
      { x: 640, y: 920 },
    ],
    campAnchors: [
      { x: 360, y: 960 },
      { x: 520, y: 1060 },
    ],
    nightModifiers: {
      ruckusBonus: 1,
    },
    gateways: [
      {
        x: 0,
        y: 120,
        w: 140,
        h: 240,
        toDistrictId: 'heart',
        spawnX: 1760,
        spawnY: 220,
        label: 'To Heart District',
      },
      {
        x: 1850,
        y: 760,
        w: 140,
        h: 240,
        toDistrictId: 'verdent',
        spawnX: 220,
        spawnY: 860,
        label: 'To Verdent District',
      },
    ],
  },
  verdent: {
    id: 'verdent',
    displayName: 'Verdent District',
    background: {
      imageKey: 'city',
      color: 0x0f2a1f,
      tint: 0x86efac,
    },
    spawnAnchors: {
      OVERGROWTH: [
        { x: 1320, y: 240 },
        { x: 1500, y: 420 },
        { x: 1200, y: 580 },
        { x: 1680, y: 640 },
        { x: 1380, y: 320 },
      ],
      ROUTE: [
        { x: 1160, y: 620 },
        { x: 1420, y: 520 },
        { x: 1020, y: 720 },
      ],
      RUCKUS: [
        { x: 1080, y: 860 },
        { x: 1360, y: 900 },
        { x: 1240, y: 980 },
      ],
      LOT: [
        { x: 1500, y: 760 },
        { x: 1140, y: 820 },
      ],
    },
    dayLocations: {
      butcher: { x: 380, y: 300 },
      tavern: { x: 860, y: 360 },
      market: { x: 640, y: 760 },
    },
    shrineAnchors: [
      { x: 480, y: 420 },
      { x: 720, y: 520 },
      { x: 940, y: 580 },
      { x: 560, y: 900 },
    ],
    campAnchors: [
      { x: 520, y: 980 },
      { x: 620, y: 1040 },
    ],
    nightModifiers: {
      overgrowthBonus: 1,
    },
    gateways: [
      {
        x: 0,
        y: 200,
        w: 140,
        h: 240,
        toDistrictId: 'arcane',
        spawnX: 1760,
        spawnY: 300,
        label: 'To Arcane District',
      },
      {
        x: 1850,
        y: 760,
        w: 140,
        h: 240,
        toDistrictId: 'heart',
        spawnX: 220,
        spawnY: 840,
        label: 'To Heart District',
      },
    ],
  },
};

export const getDistrictConfig = (id) => {
  if (!id) {
    return DISTRICTS.camp;
  }
  return DISTRICTS[id] || DISTRICTS.camp;
};
