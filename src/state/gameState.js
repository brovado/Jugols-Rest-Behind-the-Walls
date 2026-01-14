const DAY_ACTIONS = 5;
const HOUSING_CAPACITY = 4;
const IMMIGRATION_BURST = 6;
const MAX_METER = 100;
const SAVE_KEY = 'jugols-rest-save';

const clampMeter = (value) => Math.max(0, Math.min(MAX_METER, value));

export const createInitialState = () => ({
  dayNumber: 1,
  phase: 'DAY',
  dayActionsRemaining: DAY_ACTIONS,
  foodScraps: 0,
  foodFatty: 0,
  packFedScraps: 0,
  packFedFatty: 0,
  hyenaStamina: 0,
  hyenaPower: 0,
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
  const staminaBase = Math.max(0, 3 - state.hyenaStaminaBasePenalty);
  state.hyenaStamina = Math.max(
    0,
    staminaBase + state.packFedScraps + state.packFedFatty
  );
  state.hyenaPower = 1 + state.packFedFatty;
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

  state.packFedScraps = 0;
  state.packFedFatty = 0;

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

export const feedPack = (state, scrapsToFeed, fattyToFeed) => {
  if (state.phase !== 'DAY' || state.dayActionsRemaining <= 0) {
    return false;
  }
  if (scrapsToFeed <= 0 && fattyToFeed <= 0) {
    return false;
  }
  if (scrapsToFeed > state.foodScraps || fattyToFeed > state.foodFatty) {
    return false;
  }

  state.foodScraps -= scrapsToFeed;
  state.foodFatty -= fattyToFeed;
  state.packFedScraps += scrapsToFeed;
  state.packFedFatty += fattyToFeed;
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
  if (state.phase !== 'NIGHT' || state.hyenaStamina < 2) {
    return false;
  }
  state.hyenaStamina -= 2;
  state.overgrowth = clampMeter(state.overgrowth - 20);
  return true;
};

export const guardRoute = (state) => {
  if (state.phase !== 'NIGHT' || state.hyenaStamina < 2) {
    return false;
  }
  state.hyenaStamina -= 2;
  state.routeGuardedTonight = true;
  return true;
};

export const suppressThreat = (state) => {
  if (state.phase !== 'NIGHT' || state.hyenaStamina < 3) {
    return false;
  }
  if (!state.threatActive || state.hyenaPower < 2) {
    return false;
  }
  state.hyenaStamina -= 3;
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
