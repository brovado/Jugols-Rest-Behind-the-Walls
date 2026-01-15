const PHASE_ORDER = {
  DAY: 0,
  NIGHT: 1,
};

const clampMeter = (value) => Math.max(0, Math.min(100, Math.round(value)));

const sumBlessings = (state, type) => {
  if (!Array.isArray(state?.activeBlessings)) {
    return 0;
  }
  return state.activeBlessings.reduce((sum, blessing) => {
    if (!blessing || blessing.type !== type) {
      return sum;
    }
    return sum + (Number(blessing.value) || 0);
  }, 0);
};

export const formatBlessingEffect = (blessing) => {
  if (!blessing) {
    return '';
  }
  const value = Number(blessing.value) || 0;
  const sign = value >= 0 ? '+' : '';
  switch (blessing.type) {
    case 'PACK_STAMINA':
      return `Pack stamina ${sign}${value} at night`;
    case 'PACK_POWER':
      return `Pack power ${sign}${value} at night`;
    case 'ACTION_COST':
      return `Night action costs ${sign}${value}`;
    case 'MORNING_TENSION':
      return `Dawn tension ${sign}${value}`;
    case 'MORNING_OVERGROWTH':
      return `Dawn overgrowth ${sign}${value}`;
    case 'MORNING_CAMP':
      return `Dawn camp pressure ${sign}${value}`;
    case 'HOUSING_REWARD':
      return `Housing rewards ${sign}${value}`;
    default:
      return `Blessing ${sign}${value}`;
  }
};

export const formatBlessingDuration = (blessing) => {
  if (!blessing?.duration) {
    return '';
  }
  switch (blessing.duration) {
    case 'DAY':
      return 'Until nightfall';
    case 'NIGHT':
      return 'Through the next night';
    case 'CYCLE':
      return 'Through the next dawn';
    default:
      return '';
  }
};

export const createBlessingEntry = (state, god) => {
  const source = god?.blessing || {};
  const duration = source.duration || 'DAY';
  const entry = {
    godId: god?.id,
    type: source.type,
    value: source.value,
    duration,
  };

  if (duration === 'DAY') {
    return { ...entry, expiresDay: state.dayNumber, expiresPhase: 'NIGHT' };
  }
  if (duration === 'NIGHT') {
    return { ...entry, expiresDay: state.dayNumber + 1, expiresPhase: 'DAY' };
  }
  if (duration === 'CYCLE') {
    return {
      ...entry,
      expiresDay: state.dayNumber + 1,
      expiresPhase: 'DAY',
      cycleGrace: true,
    };
  }
  return entry;
};

const isBlessingExpired = (blessing, state, { allowCycleGrace } = {}) => {
  if (!blessing || !state) {
    return true;
  }
  if (blessing.cycleGrace && allowCycleGrace) {
    return false;
  }
  if (typeof blessing.expiresDay !== 'number' || !blessing.expiresPhase) {
    return false;
  }
  if (state.dayNumber > blessing.expiresDay) {
    return true;
  }
  if (state.dayNumber < blessing.expiresDay) {
    return false;
  }
  return PHASE_ORDER[state.phase] >= PHASE_ORDER[blessing.expiresPhase];
};

export const pruneExpiredBlessings = (state, options = {}) => {
  if (!Array.isArray(state?.activeBlessings)) {
    state.activeBlessings = [];
    return;
  }
  state.activeBlessings = state.activeBlessings.filter(
    (blessing) => !isBlessingExpired(blessing, state, options)
  );
};

export const applyBlessingPackStats = (state, stats) => {
  const staminaBonus = sumBlessings(state, 'PACK_STAMINA');
  const powerBonus = sumBlessings(state, 'PACK_POWER');
  return {
    stamina: Math.max(0, (stats?.stamina || 0) + staminaBonus),
    power: Math.max(0, (stats?.power || 0) + powerBonus),
  };
};

export const getBlessingActionCostModifier = (state) =>
  sumBlessings(state, 'ACTION_COST');

export const applyBlessingMorningTicks = (state) => {
  if (!state) {
    return;
  }
  const tensionDelta = sumBlessings(state, 'MORNING_TENSION');
  const overgrowthDelta = sumBlessings(state, 'MORNING_OVERGROWTH');
  const campDelta = sumBlessings(state, 'MORNING_CAMP');

  if (tensionDelta) {
    state.tension = clampMeter(state.tension + tensionDelta);
  }
  if (overgrowthDelta) {
    state.overgrowth = clampMeter(state.overgrowth + overgrowthDelta);
  }
  if (campDelta) {
    state.campPressure = clampMeter(state.campPressure + campDelta);
  }
};

export const applyBlessingHousingReward = (state, baseReward) => {
  const bonus = sumBlessings(state, 'HOUSING_REWARD');
  return Math.max(0, (baseReward || 0) + bonus);
};
