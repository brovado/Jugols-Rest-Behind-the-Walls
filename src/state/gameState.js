const DAY_ACTIONS = 5;
const HOUSING_CAPACITY = 4;
const IMMIGRATION_BURST = 6;
const MAX_METER = 100;
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

const clampMeter = (value) => Math.max(0, Math.min(MAX_METER, value));

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
  locationCollected: {
    butcher: false,
    tavern: false,
    market: false,
  },
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
    return {
      ...base,
      ...data,
      pack: normalizePack(data.pack),
      locationCollected: {
        ...base.locationCollected,
        ...data.locationCollected,
      },
      eventLog: Array.isArray(data.eventLog) ? data.eventLog : [],
    };
  } catch (error) {
    console.warn('Failed to load game state', error);
    return null;
  }
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
  state.locationCollected = {
    butcher: false,
    tavern: false,
    market: false,
  };

  const baselineTension = state.routeGuardedTonight ? 0 : 5;
  state.tension = clampMeter(state.tension + baselineTension);
  state.routeGuardedTonight = false;

  if (state.campActive) {
    state.tension = clampMeter(state.tension + 10);
    state.overgrowth = clampMeter(state.overgrowth + 8);
    state.campPressure = clampMeter(state.campPressure + 12);
  }

  if (state.dayNumber % 3 === 0) {
    const overflow = IMMIGRATION_BURST - HOUSING_CAPACITY;
    if (overflow > 0) {
      state.campActive = true;
      state.campPressure = Math.max(state.campPressure, 30);
    }
  }

  evaluateStability(state);
  evaluateCollapse(state);
};

export const startNight = (state) => {
  state.phase = 'NIGHT';
  const staminaBase = Math.max(0, PACK_BASE_STAMINA - state.hyenaStaminaBasePenalty);
  const totals = getPackTotals(state.pack);
  state.packStamina = Math.max(0, staminaBase + totals.stamina);
  state.packPower = Math.max(0, PACK_BASE_POWER + totals.power);
  state.routeGuardedTonight = false;
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
  if (state.campPressure <= 0) {
    state.campActive = false;
    state.campPressure = 0;
  }
  state.dayActionsRemaining -= 1;
  return true;
};

export const clearOvergrowth = (state) => {
  if (state.phase !== 'NIGHT' || state.packStamina < 2) {
    return false;
  }
  state.packStamina -= 2;
  const hasWarden = hasPackRole(state.pack, 'Warden');
  state.overgrowth = clampMeter(state.overgrowth - (hasWarden ? 25 : 20));
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
  return true;
};

const evaluateStability = (state) => {
  const stable =
    state.overgrowth <= 30 &&
    state.threatActive === false &&
    state.tension <= 60 &&
    (!state.campActive || state.campPressure <= 40);

  if (stable) {
    state.consecutiveStableDays += 1;
  } else {
    state.consecutiveStableDays = 0;
  }

  if (state.consecutiveStableDays >= 3) {
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
