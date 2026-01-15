import { getDistrictConfig } from '../world/districts.js';

const DAY_ACTIONS = 5;
const BASE_INCOMING = 3;
const BURST_INTERVAL = 3;
const BURST_AMOUNT = 12;
const MAX_METER = 100;
const POP_TARGET = 60;
const SAVE_KEY = 'jugols-rest-save';

// Tunable pack rules and role-based contributions.
const PACK_BASE_STAMINA = 3;
const PACK_BASE_POWER = 1;
const HUNGER_REDUCTION_PER_FOOD = 15;

const SCRAPS_STAMINA_BY_ROLE = {
  Scout: 2,
  Bruiser: 1,
  Warden: 1,
};

const FATTY_POWER_BY_ROLE = {
  Scout: 0,
  Bruiser: 2,
  Warden: 1,
};

export const clampMeter = (value) => Math.max(0, Math.min(MAX_METER, value));

const getAvailableHousing = (state) =>
  Math.max(0, (state.housingCapacity || 0) - (state.housedPop || 0));

const getTotalPopulation = (state) => (state.housedPop || 0) + (state.campPop || 0);

const getForecastForDay = (dayNumber) =>
  BASE_INCOMING + (dayNumber % BURST_INTERVAL === 0 ? BURST_AMOUNT : 0);

const createPack = () => ([
  {
    id: 'hyena-scout',
    name: 'Kefa',
    role: 'Scout',
    temperament: 'Wary',
    hunger: 45,
    fedScraps: 0,
    fedFatty: 0,
  },
  {
    id: 'hyena-bruiser',
    name: 'Asha',
    role: 'Bruiser',
    temperament: 'Fierce',
    hunger: 50,
    fedScraps: 0,
    fedFatty: 0,
  },
  {
    id: 'hyena-warden',
    name: 'Rift',
    role: 'Warden',
    temperament: 'Calm',
    hunger: 40,
    fedScraps: 0,
    fedFatty: 0,
  },
]);

const POI_RADIUS = 60;
const POI_TYPES = ['OVERGROWTH', 'RUCKUS', 'ROUTE', 'LOT'];

const getNightPoiPoints = (districtConfig) =>
  districtConfig?.spawnAnchors || getDistrictConfig('heart').spawnAnchors;

const createPoi = (state, type, point, index, severity) => ({
  id: `poi-${state.dayNumber}-${state.phase}-${type}-${index}`,
  type,
  x: point.x,
  y: point.y,
  radius: POI_RADIUS,
  severity,
  resolved: false,
});

const pickPoints = (points, count, seed) => {
  if (!Array.isArray(points) || points.length === 0 || count <= 0) {
    return [];
  }
  const start = Math.abs(seed) % points.length;
  return Array.from({ length: Math.min(count, points.length) }, (_, idx) =>
    points[(start + idx) % points.length]
  );
};

const getOvergrowthCount = (overgrowth) => {
  if (overgrowth < 40) {
    return 2;
  }
  if (overgrowth <= 70) {
    return 3;
  }
  return 4;
};

const getOvergrowthSeverity = (overgrowth) => {
  if (overgrowth >= 70) {
    return 3;
  }
  if (overgrowth >= 40) {
    return 2;
  }
  return 1;
};

const getRuckusSeverity = (tension) => {
  if (tension >= 80) {
    return 3;
  }
  if (tension >= 60) {
    return 2;
  }
  return 1;
};

const normalizePack = (packData) => {
  if (!Array.isArray(packData) || packData.length === 0) {
    return createPack();
  }
  const defaults = createPack();
  return defaults.map((base) => {
    const existing = packData.find((entry) => entry.id === base.id) || {};
    return {
      ...base,
      ...existing,
      fedScraps: existing.fedScraps ?? base.fedScraps,
      fedFatty: existing.fedFatty ?? base.fedFatty,
      hunger: typeof existing.hunger === 'number' ? clampMeter(existing.hunger) : base.hunger,
    };
  });
};

export const getHyenaContribution = (hyena) => {
  const stamina = (SCRAPS_STAMINA_BY_ROLE[hyena.role] || 0) * (hyena.fedScraps || 0);
  const power = (FATTY_POWER_BY_ROLE[hyena.role] || 0) * (hyena.fedFatty || 0);
  return { stamina, power };
};

export const getPackTotals = (pack) => {
  if (!Array.isArray(pack)) {
    return { stamina: 0, power: 0 };
  }
  return pack.reduce(
    (totals, hyena) => {
      const contribution = getHyenaContribution(hyena);
      return {
        stamina: totals.stamina + contribution.stamina,
        power: totals.power + contribution.power,
      };
    },
    { stamina: 0, power: 0 }
  );
};

export const hasPackRole = (pack, role) =>
  Array.isArray(pack) && pack.some((hyena) => hyena.role === role);

export const packRules = {
  SCRAPS_STAMINA_BY_ROLE,
  FATTY_POWER_BY_ROLE,
  HUNGER_REDUCTION_PER_FOOD,
  PACK_BASE_STAMINA,
  PACK_BASE_POWER,
};

export const createInitialState = () => ({
  dayNumber: 1,
  phase: 'DAY',
  dayActionsRemaining: DAY_ACTIONS,
  foodScraps: 0,
  foodFatty: 0,
  pack: createPack(),
  packStamina: 0,
  packPower: 0,
  tension: 10,
  overgrowth: 10,
  threatActive: false,
  threatNightsActiveCount: 0,
  campActive: false,
  campPressure: 0,
  consecutiveStableDays: 0,
  collapseDays: 0,
  hyenaStaminaBasePenalty: 0,
  routeGuardedTonight: false,
  housedPop: 6,
  campPop: 0,
  incomingNextDay: getForecastForDay(1),
  housingCapacity: 10,
  housingBoostedTonight: false,
  clearedOvergrowthTonight: false,
  clearedOvergrowthLastNight: false,
  activePois: [],
  locationCollected: {
    butcher: false,
    tavern: false,
    market: false,
  },
  currentDistrictId: 'heart',
  victory: false,
  gameOver: false,
  eventLog: [],
});

export const addEvent = (state, message) => {
  if (!state.eventLog) {
    state.eventLog = [];
  }
  state.eventLog.push(message);
  if (state.eventLog.length > 25) {
    state.eventLog.shift();
  }
};

export const saveGameState = (state) => {
  try {
    const payload = JSON.stringify(state);
    window.localStorage.setItem(SAVE_KEY, payload);
  } catch (error) {
    console.warn('Failed to save game state', error);
  }
};

export const loadGameState = () => {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) {
      return null;
    }
    const base = createInitialState();
    const data = JSON.parse(raw);
    const resolvedDistrictId = getDistrictConfig(data.currentDistrictId).id;
    const merged = {
      ...base,
      ...data,
      currentDistrictId: resolvedDistrictId,
      pack: normalizePack(data.pack),
      locationCollected: {
        ...base.locationCollected,
        ...data.locationCollected,
      },
      activePois: Array.isArray(data.activePois)
        ? data.activePois.filter((poi) => POI_TYPES.includes(poi.type))
        : [],
      eventLog: Array.isArray(data.eventLog) ? data.eventLog : [],
    };
    merged.housedPop = Math.max(0, merged.housedPop || 0);
    merged.campPop = Math.max(0, merged.campPop || 0);
    merged.housingCapacity = Math.max(0, merged.housingCapacity || 0);
    merged.incomingNextDay =
      merged.incomingNextDay ?? getForecastForDay(merged.dayNumber + 1);
    merged.campActive = merged.campPop > 0;
    merged.campPressure = clampMeter(merged.campPressure || 0);
    merged.clearedOvergrowthTonight = Boolean(merged.clearedOvergrowthTonight);
    merged.clearedOvergrowthLastNight = Boolean(merged.clearedOvergrowthLastNight);
    return merged;
  } catch (error) {
    console.warn('Failed to load game state', error);
    return null;
  }
};

export const spawnPoisForDay = (state) => {
  state.activePois = [];
  return state.activePois;
};

export const spawnPoisForNight = (state, districtConfig) => {
  const anchors = getNightPoiPoints(
    districtConfig || getDistrictConfig(state.currentDistrictId)
  );
  const nextPois = [];
  const routeSeed = state.dayNumber * 3;
  const routePoint = pickPoints(anchors.ROUTE, 1, routeSeed)[0];
  if (routePoint) {
    nextPois.push(createPoi(state, 'ROUTE', routePoint, routeSeed, 1 + (state.dayNumber % 2)));
  }

  const baseOvergrowthCount = getOvergrowthCount(state.overgrowth);
  const overgrowthBonus = districtConfig?.nightModifiers?.overgrowthBonus ?? 0;
  const overgrowthCount = baseOvergrowthCount + overgrowthBonus;
  const overgrowthSeverity = getOvergrowthSeverity(state.overgrowth);
  const overgrowthPoints = pickPoints(
    anchors.OVERGROWTH,
    overgrowthCount,
    state.dayNumber * 5 + state.overgrowth
  );
  overgrowthPoints.forEach((point, index) => {
    nextPois.push(
      createPoi(state, 'OVERGROWTH', point, index, Math.min(3, overgrowthSeverity + (index % 2)))
    );
  });

  const shouldSpawnRuckus =
    state.tension >= 60 || state.campPop > 0 || state.threatActive;
  if (shouldSpawnRuckus) {
    const baseRuckusCount = state.tension >= 80 ? 2 : 1;
    const ruckusBonus = districtConfig?.nightModifiers?.ruckusBonus ?? 0;
    const ruckusCount = baseRuckusCount + ruckusBonus;
    const ruckusSeverity = getRuckusSeverity(state.tension);
    const ruckusPoints = pickPoints(
      anchors.RUCKUS,
      ruckusCount,
      state.dayNumber * 7 + state.tension
    );
    ruckusPoints.forEach((point, index) => {
      nextPois.push(
        createPoi(state, 'RUCKUS', point, index, Math.min(3, ruckusSeverity + (index % 2)))
      );
    });
  }

  const needsLotReward =
    state.clearedOvergrowthLastNight || getAvailableHousing(state) <= 0;
  if (needsLotReward) {
    const lotPoint = pickPoints(anchors.LOT, 1, state.dayNumber * 11)[0];
    if (lotPoint) {
      nextPois.push(createPoi(state, 'LOT', lotPoint, state.dayNumber, 1));
    }
  }

  state.activePois = nextPois;
  return state.activePois;
};

export const resolvePoi = (state, id) => {
  if (!Array.isArray(state.activePois)) {
    return null;
  }
  const poi = state.activePois.find((entry) => entry.id === id);
  if (!poi || poi.resolved) {
    return null;
  }
  poi.resolved = true;
  return poi;
};

export const hasSavedGame = () => {
  try {
    return Boolean(window.localStorage.getItem(SAVE_KEY));
  } catch (error) {
    return false;
  }
};

export const startDay = (state, { advanceDay }) => {
  if (advanceDay) {
    state.dayNumber += 1;
  }

  state.phase = 'DAY';
  state.dayActionsRemaining = DAY_ACTIONS;
  spawnPoisForDay(state);
  state.locationCollected = {
    butcher: false,
    tavern: false,
    market: false,
  };

  const baselineTension = state.routeGuardedTonight ? 0 : 5;
  state.tension = clampMeter(state.tension + baselineTension);
  state.routeGuardedTonight = false;

  const arrivals = Math.max(0, state.incomingNextDay || 0);
  const availableHousing = getAvailableHousing(state);
  const toHouse = Math.min(arrivals, availableHousing);
  const overflow = Math.max(0, arrivals - toHouse);
  state.housedPop += toHouse;
  state.campPop += overflow;
  state.campActive = state.campPop > 0;
  if (arrivals > 0) {
    addEvent(
      state,
      `Dawn: +${arrivals} arrivals. Housed +${toHouse}, Camped +${overflow}.`
    );
  }

  if (state.campPop > 0) {
    state.campPressure = clampMeter(
      state.campPressure + 5 + Math.floor(state.campPop / 5) * 2
    );
    state.tension = clampMeter(
      state.tension + 5 + Math.floor(state.campPop / 5) * 3
    );
    state.overgrowth = clampMeter(
      state.overgrowth + 3 + Math.floor(state.campPop / 10) * 2
    );
  } else {
    state.campPressure = clampMeter(state.campPressure - 10);
  }

  state.incomingNextDay = getForecastForDay(state.dayNumber + 1);
  addEvent(state, `Forecast: +${state.incomingNextDay} arriving tomorrow.`);

  evaluateVictory(state);
  evaluateCollapse(state);
};

export const startNight = (state) => {
  state.phase = 'NIGHT';
  const staminaBase = Math.max(0, PACK_BASE_STAMINA - state.hyenaStaminaBasePenalty);
  const totals = getPackTotals(state.pack);
  state.packStamina = Math.max(0, staminaBase + totals.stamina);
  state.packPower = Math.max(0, PACK_BASE_POWER + totals.power);
  state.routeGuardedTonight = false;
  state.housingBoostedTonight = false;
  state.clearedOvergrowthTonight = false;
};

export const endNight = (state) => {
  if (state.overgrowth >= 60 || state.campActive) {
    state.threatActive = true;
  }

  if (state.threatActive) {
    state.threatNightsActiveCount += 1;
  } else {
    state.threatNightsActiveCount = 0;
  }

  if (Array.isArray(state.pack)) {
    state.pack.forEach((hyena) => {
      hyena.fedScraps = 0;
      hyena.fedFatty = 0;
    });
  }

  state.clearedOvergrowthLastNight = state.clearedOvergrowthTonight;
  state.clearedOvergrowthTonight = false;
  startDay(state, { advanceDay: true });
};

export const collectLocation = (state, locationKey) => {
  if (state.phase !== 'DAY' || state.dayActionsRemaining <= 0) {
    return false;
  }
  if (state.locationCollected[locationKey]) {
    return false;
  }

  const rewards = {
    butcher: { scraps: 1, fatty: 2 },
    tavern: { scraps: 2, fatty: 0 },
    market: { scraps: 1, fatty: 1 },
  };

  const reward = rewards[locationKey];
  if (!reward) {
    return false;
  }

  state.foodScraps += reward.scraps;
  state.foodFatty += reward.fatty;
  state.dayActionsRemaining -= 1;
  state.locationCollected[locationKey] = true;
  return true;
};

export const feedHyenas = (state, feedPlan) => {
  if (state.phase !== 'DAY' || state.dayActionsRemaining <= 0) {
    return false;
  }
  if (!Array.isArray(feedPlan) || feedPlan.length === 0) {
    return false;
  }
  const totals = feedPlan.reduce(
    (sum, entry) => ({
      scraps: sum.scraps + Math.max(0, entry.scraps || 0),
      fatty: sum.fatty + Math.max(0, entry.fatty || 0),
    }),
    { scraps: 0, fatty: 0 }
  );
  if (totals.scraps <= 0 && totals.fatty <= 0) {
    return false;
  }
  if (totals.scraps > state.foodScraps || totals.fatty > state.foodFatty) {
    return false;
  }

  const packMap = new Map(state.pack.map((hyena) => [hyena.id, hyena]));
  feedPlan.forEach((entry) => {
    const hyena = packMap.get(entry.id);
    if (!hyena) {
      return;
    }
    const scraps = Math.max(0, entry.scraps || 0);
    const fatty = Math.max(0, entry.fatty || 0);
    hyena.fedScraps += scraps;
    hyena.fedFatty += fatty;
    // Each unit of food both sates hunger and boosts tonight's role-based totals.
    const hungerDrop = (scraps + fatty) * HUNGER_REDUCTION_PER_FOOD;
    hyena.hunger = clampMeter(hyena.hunger - hungerDrop);
  });

  state.foodScraps -= totals.scraps;
  state.foodFatty -= totals.fatty;
  state.dayActionsRemaining -= 1;
  return true;
};

export const stabilizeCamp = (state) => {
  if (state.phase !== 'DAY' || state.dayActionsRemaining <= 0) {
    return false;
  }
  if (!state.campActive || state.foodScraps < 2) {
    return false;
  }
  state.foodScraps -= 2;
  state.campPressure = clampMeter(state.campPressure - 20);
  const availableHousing = getAvailableHousing(state);
  const moved = Math.min(availableHousing, 3, state.campPop);
  if (moved > 0) {
    state.housedPop += moved;
    state.campPop -= moved;
  }
  state.campActive = state.campPop > 0;
  state.dayActionsRemaining -= 1;
  return { moved };
};

export const clearOvergrowth = (state) => {
  if (state.phase !== 'NIGHT' || state.packStamina < 2) {
    return false;
  }
  state.packStamina -= 2;
  const hasWarden = hasPackRole(state.pack, 'Warden');
  state.overgrowth = clampMeter(state.overgrowth - (hasWarden ? 25 : 20));
  state.housingCapacity += 1;
  addEvent(state, 'Cleared lots: Housing capacity +1.');
  return true;
};

export const guardRoute = (state) => {
  const staminaCost = Math.max(1, hasPackRole(state.pack, 'Scout') ? 1 : 2);
  if (state.phase !== 'NIGHT' || state.packStamina < staminaCost) {
    return false;
  }
  state.packStamina -= staminaCost;
  state.routeGuardedTonight = true;
  return true;
};

export const suppressThreat = (state) => {
  const powerRequirement = hasPackRole(state.pack, 'Bruiser') ? 1 : 2;
  if (state.phase !== 'NIGHT' || state.packStamina < 3) {
    return false;
  }
  if (!state.threatActive || state.packPower < powerRequirement) {
    return false;
  }
  state.packStamina -= 3;
  state.threatActive = false;
  if (!state.housingBoostedTonight) {
    state.housingCapacity += 1;
    state.housingBoostedTonight = true;
    addEvent(state, 'Secured a safehouse: Housing capacity +1.');
  }
  return true;
};

const evaluateVictory = (state) => {
  if (getTotalPopulation(state) >= POP_TARGET) {
    state.victory = true;
  }
};

const evaluateCollapse = (state) => {
  const triggers = [
    state.overgrowth >= 100,
    state.tension >= 100,
    state.threatNightsActiveCount >= 2,
    state.campPressure >= 100,
  ];

  const triggeredCount = triggers.filter(Boolean).length;
  if (triggeredCount >= 2) {
    state.collapseDays += 1;
    state.hyenaStaminaBasePenalty += 1;
  }

  if (state.collapseDays >= 2) {
    state.gameOver = true;
  }
};
