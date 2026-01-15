import { createFactionStates, normalizeFactionStates } from '../data/factions.js';
import {
  DEFAULT_FACTION_ID,
  FACTION_BY_ID,
  FACTIONS,
} from '../world/factions.js';
import { DISTRICTS, getDistrictConfig } from '../world/districts.js';
import { GODS } from '../world/gods.js';
import {
  applyBlessingMorningTicks,
  applyBlessingPackStats,
  pruneExpiredBlessings,
} from '../world/blessings.js';

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

const clampPositive = (value) => Math.max(0, Math.floor(value || 0));

export const getIncomingTotal = (groups) =>
  Array.isArray(groups)
    ? groups.reduce((sum, group) => sum + clampPositive(group.size), 0)
    : 0;

const createIncomingGroupsForDay = (dayNumber) => {
  const total = getForecastForDay(dayNumber);
  if (total <= 0) {
    return [];
  }
  const factionIds = FACTIONS.map((faction) => faction.id);
  const groupCount = total >= 12 ? 3 : total >= 6 ? 2 : 1;
  const baseSize = Math.floor(total / groupCount);
  const remainder = total % groupCount;
  return Array.from({ length: groupCount }, (_, idx) => ({
    factionId: factionIds[(dayNumber + idx) % factionIds.length],
    size: baseSize + (idx < remainder ? 1 : 0),
  }));
};

const normalizeIncomingGroups = (groups, fallbackTotal) => {
  if (!Array.isArray(groups)) {
    if (typeof fallbackTotal === 'number') {
      const size = clampPositive(fallbackTotal);
      return size > 0
        ? [
          {
            factionId: DEFAULT_FACTION_ID,
            size,
          },
        ]
        : [];
    }
    return [];
  }
  return groups
    .map((group) => ({
      factionId: FACTION_BY_ID[group?.factionId] ? group.factionId : DEFAULT_FACTION_ID,
      size: clampPositive(group?.size),
    }))
    .filter((group) => group.size > 0);
};

const normalizeCampFactions = (campFactions, campPop) => {
  const normalized = {};
  if (campFactions && typeof campFactions === 'object') {
    Object.entries(campFactions).forEach(([id, count]) => {
      if (!FACTION_BY_ID[id]) {
        return;
      }
      const value = clampPositive(count);
      if (value > 0) {
        normalized[id] = value;
      }
    });
  }
  let total = Object.values(normalized).reduce((sum, value) => sum + value, 0);
  const campCount = clampPositive(campPop);
  if (campCount > 0 && total === 0) {
    normalized[DEFAULT_FACTION_ID] = campCount;
    total = campCount;
  }
  if (total > campCount) {
    const entries = Object.entries(normalized).sort((a, b) => b[1] - a[1]);
    let excess = total - campCount;
    entries.forEach(([id, count]) => {
      if (excess <= 0) {
        return;
      }
      const removal = Math.min(excess, count);
      const next = count - removal;
      if (next <= 0) {
        delete normalized[id];
      } else {
        normalized[id] = next;
      }
      excess -= removal;
    });
  } else if (total < campCount) {
    normalized[DEFAULT_FACTION_ID] = (normalized[DEFAULT_FACTION_ID] || 0) + (campCount - total);
  }
  return normalized;
};

export const getDominantCampFaction = (state) => {
  if (!state?.campFactions) {
    return null;
  }
  const entries = Object.entries(state.campFactions).filter(([, count]) => count > 0);
  if (entries.length === 0) {
    return null;
  }
  entries.sort((a, b) => b[1] - a[1]);
  const [id] = entries[0];
  return FACTION_BY_ID[id] || null;
};

const applyCampPopulation = (state, factionId, count) => {
  if (count <= 0) {
    return;
  }
  if (!state.campFactions || typeof state.campFactions !== 'object') {
    state.campFactions = {};
  }
  const resolvedId = FACTION_BY_ID[factionId] ? factionId : DEFAULT_FACTION_ID;
  state.campFactions[resolvedId] = (state.campFactions[resolvedId] || 0) + count;
};

const removeCampPopulation = (state, count) => {
  if (!state.campFactions || count <= 0) {
    return;
  }
  const entries = Object.entries(state.campFactions).sort((a, b) => b[1] - a[1]);
  let remaining = count;
  entries.forEach(([id, value]) => {
    if (remaining <= 0) {
      return;
    }
    const removal = Math.min(remaining, value);
    const next = value - removal;
    if (next <= 0) {
      delete state.campFactions[id];
    } else {
      state.campFactions[id] = next;
    }
    remaining -= removal;
  });
  if (Object.keys(state.campFactions).length === 0) {
    state.campFactions = {};
  }
};

const getCampBehavior = (state) => {
  const dominant = getDominantCampFaction(state);
  return dominant?.campBehavior || {
    tensionModifier: 1,
    overgrowthModifier: 1,
    ruckusModifier: 1,
  };
};

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
const POI_TYPES = ['OVERGROWTH', 'RUCKUS', 'ROUTE', 'LOT', 'SHRINE'];

const getNightPoiPoints = (districtConfig) =>
  districtConfig?.spawnAnchors || getDistrictConfig('heart').spawnAnchors;

const createDistrictCollections = () =>
  Object.keys(DISTRICTS).reduce((acc, id) => {
    acc[id] = {
      butcher: false,
      tavern: false,
      market: false,
    };
    return acc;
  }, {});

const createDistrictPois = () =>
  Object.keys(DISTRICTS).reduce((acc, id) => {
    acc[id] = [];
    return acc;
  }, {});

const getActiveShrines = (state, districtId) => {
  const pois = ensureDistrictPois(state, districtId);
  return pois.filter((poi) => poi.type === 'SHRINE' && !poi.resolved);
};

const normalizeShrinePoi = (state, poi) => ({
  ...poi,
  type: 'SHRINE',
  discovered: Boolean(state.discoveredShrines?.[poi.godId]),
  prayedToday: Boolean(poi.prayedToday),
});

const ensureDistrictCollections = (state, districtId) => {
  if (!state.dayCollectedByDistrict) {
    state.dayCollectedByDistrict = createDistrictCollections();
  }
  if (!state.dayCollectedByDistrict[districtId]) {
    state.dayCollectedByDistrict[districtId] = {
      butcher: false,
      tavern: false,
      market: false,
    };
  }
  return state.dayCollectedByDistrict[districtId];
};

const ensureDistrictPois = (state, districtId) => {
  if (!state.activePoisByDistrict) {
    state.activePoisByDistrict = createDistrictPois();
  }
  if (!Array.isArray(state.activePoisByDistrict[districtId])) {
    state.activePoisByDistrict[districtId] = [];
  }
  return state.activePoisByDistrict[districtId];
};

const createPoi = (state, type, point, index, severity) => ({
  id: `poi-${state.dayNumber}-${state.phase}-${type}-${index}`,
  type,
  x: point.x,
  y: point.y,
  radius: POI_RADIUS,
  severity,
  resolved: false,
});

const createShrinePoi = (state, godId, point, districtId) => ({
  id: `shrine-${state.dayNumber}-${districtId}-${godId}`,
  type: 'SHRINE',
  x: point.x,
  y: point.y,
  radius: POI_RADIUS + 10,
  resolved: false,
  godId,
  discovered: Boolean(state.discoveredShrines?.[godId]),
  prayedToday: false,
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

const pickShrineGodId = (state, districtId) => {
  if (!Array.isArray(GODS) || GODS.length === 0) {
    return null;
  }
  const preferred = GODS.filter((god) => god.districtAffinity === districtId);
  const flexible = GODS.filter((god) => god.districtAffinity === 'any');
  const pool = preferred.length > 0 ? [...preferred, ...flexible] : GODS;
  const recent = new Set(state.lastShrineGodIds || []);
  const filtered = pool.filter((god) => !recent.has(god.id));
  const selectionPool = filtered.length > 0 ? filtered : pool;
  const seed =
    state.dayNumber * 31 +
    districtId.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const index = Math.abs(seed) % selectionPool.length;
  return selectionPool[index]?.id || selectionPool[0]?.id || null;
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
  incomingGroupsNextDay: createIncomingGroupsForDay(1),
  housingCapacity: 10,
  housingBoostedTonight: false,
  clearedOvergrowthTonight: false,
  clearedOvergrowthLastNight: false,
  activePoisByDistrict: createDistrictPois(),
  dayCollectedByDistrict: createDistrictCollections(),
  currentDistrictId: 'heart',
  factions: createFactionStates(),
  worldFactions: FACTIONS,
  campFactions: {},
  narrativeFlags: {},
  lastNarrativeEventDay: 0,
  lastAmbientLineKey: '',
  discoveredShrines: {},
  activeBlessings: [],
  lastShrineGodIds: [],
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

export const addNarrativeEvent = (state, sourceLabel, message) => {
  if (!message) {
    return;
  }
  const label = sourceLabel || 'City';
  addEvent(state, `${label}: ${message}`);
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
      factions: normalizeFactionStates(data.factions),
      dayCollectedByDistrict: {
        ...base.dayCollectedByDistrict,
        ...(data.dayCollectedByDistrict || {}),
      },
      activePoisByDistrict: {
        ...base.activePoisByDistrict,
        ...(data.activePoisByDistrict || {}),
      },
      discoveredShrines:
        data.discoveredShrines && typeof data.discoveredShrines === 'object'
          ? data.discoveredShrines
          : {},
      activeBlessings: Array.isArray(data.activeBlessings) ? data.activeBlessings : [],
      lastShrineGodIds: Array.isArray(data.lastShrineGodIds) ? data.lastShrineGodIds : [],
      eventLog: Array.isArray(data.eventLog) ? data.eventLog : [],
      worldFactions: base.worldFactions,
    };
    const legacyCollected = data.locationCollected;
    if (!data.dayCollectedByDistrict && legacyCollected) {
      merged.dayCollectedByDistrict[resolvedDistrictId] = {
        ...merged.dayCollectedByDistrict[resolvedDistrictId],
        ...legacyCollected,
      };
    }
    Object.keys(DISTRICTS).forEach((districtId) => {
      const collected = merged.dayCollectedByDistrict[districtId];
      merged.dayCollectedByDistrict[districtId] = {
        butcher: Boolean(collected?.butcher),
        tavern: Boolean(collected?.tavern),
        market: Boolean(collected?.market),
      };
      const storedPois = merged.activePoisByDistrict[districtId];
      merged.activePoisByDistrict[districtId] = Array.isArray(storedPois)
        ? storedPois
          .filter((poi) => POI_TYPES.includes(poi.type))
          .map((poi) =>
            poi.type === 'SHRINE' ? normalizeShrinePoi(merged, poi) : poi
          )
        : [];
    });
    if (!data.activePoisByDistrict && Array.isArray(data.activePois)) {
      merged.activePoisByDistrict[resolvedDistrictId] = data.activePois
        .filter((poi) => POI_TYPES.includes(poi.type))
        .map((poi) => (poi.type === 'SHRINE' ? normalizeShrinePoi(merged, poi) : poi));
    }
    merged.housedPop = Math.max(0, merged.housedPop || 0);
    merged.campPop = Math.max(0, merged.campPop || 0);
    merged.housingCapacity = Math.max(0, merged.housingCapacity || 0);
    merged.incomingGroupsNextDay = normalizeIncomingGroups(
      merged.incomingGroupsNextDay,
      data.incomingNextDay ?? getForecastForDay(merged.dayNumber + 1)
    );
    merged.campActive = merged.campPop > 0;
    merged.campFactions = normalizeCampFactions(merged.campFactions, merged.campPop);
    merged.campPressure = clampMeter(merged.campPressure || 0);
    merged.clearedOvergrowthTonight = Boolean(merged.clearedOvergrowthTonight);
    merged.clearedOvergrowthLastNight = Boolean(merged.clearedOvergrowthLastNight);
    merged.narrativeFlags = merged.narrativeFlags && typeof merged.narrativeFlags === 'object'
      ? merged.narrativeFlags
      : {};
    merged.lastNarrativeEventDay = clampPositive(merged.lastNarrativeEventDay);
    merged.lastAmbientLineKey = typeof merged.lastAmbientLineKey === 'string'
      ? merged.lastAmbientLineKey
      : '';
    return merged;
  } catch (error) {
    console.warn('Failed to load game state', error);
    return null;
  }
};

export const spawnPoisForDay = (state) => {
  const existing = state.activePoisByDistrict || createDistrictPois();
  Object.keys(DISTRICTS).forEach((districtId) => {
    const preservedShrines = Array.isArray(existing[districtId])
      ? existing[districtId].filter((poi) => poi.type === 'SHRINE' && !poi.resolved)
      : [];
    preservedShrines.forEach((poi) => {
      poi.prayedToday = false;
    });
    existing[districtId] = preservedShrines;
  });
  state.activePoisByDistrict = existing;
  return ensureDistrictPois(state, state.currentDistrictId);
};

export const spawnShrineForDay = (state, districtConfig) => {
  const districtId = districtConfig?.id || state.currentDistrictId;
  const activeShrines = getActiveShrines(state, districtId);
  if (activeShrines.length > 0) {
    return activeShrines;
  }

  const anchors = districtConfig?.shrineAnchors || getDistrictConfig('heart').shrineAnchors || [];
  const anchor = pickPoints(
    anchors,
    1,
    state.dayNumber * 13 + districtId.length
  )[0];
  if (!anchor) {
    return activeShrines;
  }
  const godId = pickShrineGodId(state, districtId);
  if (!godId) {
    return activeShrines;
  }
  const shrine = createShrinePoi(state, godId, anchor, districtId);
  const targetList = ensureDistrictPois(state, districtId);
  targetList.push(shrine);
  if (!Array.isArray(state.lastShrineGodIds)) {
    state.lastShrineGodIds = [];
  }
  state.lastShrineGodIds.unshift(godId);
  state.lastShrineGodIds = state.lastShrineGodIds.slice(0, 3);
  return [shrine];
};

export const spawnPoisForNight = (state, districtConfig) => {
  const districtId = districtConfig?.id || state.currentDistrictId;
  const anchors = getNightPoiPoints(
    districtConfig || getDistrictConfig(state.currentDistrictId)
  );
  const nextPois = [];
  const preservedShrines = getActiveShrines(state, districtId);
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
    const campBehavior = getCampBehavior(state);
    const ruckusCount = Math.max(
      1,
      Math.round((baseRuckusCount + ruckusBonus) * campBehavior.ruckusModifier)
    );
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

  state.activePoisByDistrict = state.activePoisByDistrict || createDistrictPois();
  state.activePoisByDistrict[districtId] = [...preservedShrines, ...nextPois];
  return state.activePoisByDistrict[districtId];
};

export const resolvePoi = (state, id) => {
  const pois = ensureDistrictPois(state, state.currentDistrictId);
  const poi = pois.find((entry) => entry.id === id);
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
    state.activePoisByDistrict = createDistrictPois();
  }

  state.phase = 'DAY';
  state.dayActionsRemaining = DAY_ACTIONS;
  spawnPoisForDay(state);
  spawnShrineForDay(state, getDistrictConfig(state.currentDistrictId));
  state.dayCollectedByDistrict = createDistrictCollections();
  pruneExpiredBlessings(state, { allowCycleGrace: true });

  const baselineTension = state.routeGuardedTonight ? 0 : 5;
  state.tension = clampMeter(state.tension + baselineTension);
  state.routeGuardedTonight = false;

  const incomingGroups = normalizeIncomingGroups(state.incomingGroupsNextDay);
  const arrivals = getIncomingTotal(incomingGroups);
  incomingGroups.forEach((group) => {
    if (group.size <= 0) {
      return;
    }
    const availableHousing = getAvailableHousing(state);
    const toHouse = Math.min(group.size, availableHousing);
    const overflow = Math.max(0, group.size - toHouse);
    state.housedPop += toHouse;
    state.campPop += overflow;
    if (overflow > 0) {
      applyCampPopulation(state, group.factionId, overflow);
    }
    const faction = FACTION_BY_ID[group.factionId];
    const factionName = faction?.displayName || 'Arrivals';
    const flavor = faction?.arrivalFlavor || 'New families step carefully through the gates.';
    addEvent(
      state,
      `${factionName}: ${flavor} (+${group.size} arrivals; Housed +${toHouse}, Camped +${overflow}).`
    );
  });
  state.campActive = state.campPop > 0;
  state.campFactions = normalizeCampFactions(state.campFactions, state.campPop);

  if (state.campPop > 0) {
    state.campPressure = clampMeter(
      state.campPressure + 5 + Math.floor(state.campPop / 5) * 2
    );
    const campBehavior = getCampBehavior(state);
    const tensionDelta = Math.round(
      (5 + Math.floor(state.campPop / 5) * 3) * campBehavior.tensionModifier
    );
    const overgrowthDelta = Math.round(
      (3 + Math.floor(state.campPop / 10) * 2) * campBehavior.overgrowthModifier
    );
    state.tension = clampMeter(state.tension + tensionDelta);
    state.overgrowth = clampMeter(state.overgrowth + overgrowthDelta);
  } else {
    state.campPressure = clampMeter(state.campPressure - 10);
  }

  applyBlessingMorningTicks(state);
  pruneExpiredBlessings(state);

  state.incomingGroupsNextDay = createIncomingGroupsForDay(state.dayNumber + 1);
  const forecastTotal = getIncomingTotal(state.incomingGroupsNextDay);
  const forecastFactions = state.incomingGroupsNextDay
    .map((group) => FACTION_BY_ID[group.factionId]?.displayName || 'Arrivals')
    .join(', ');
  addEvent(
    state,
    `Forecast: +${forecastTotal} arriving tomorrow${forecastFactions ? ` (${forecastFactions}).` : '.'}`
  );

  evaluateVictory(state);
  evaluateCollapse(state);
};

export const startNight = (state) => {
  state.phase = 'NIGHT';
  pruneExpiredBlessings(state);
  const staminaBase = Math.max(0, PACK_BASE_STAMINA - state.hyenaStaminaBasePenalty);
  const totals = getPackTotals(state.pack);
  const baseStats = {
    stamina: Math.max(0, staminaBase + totals.stamina),
    power: Math.max(0, PACK_BASE_POWER + totals.power),
  };
  const blessedStats = applyBlessingPackStats(state, baseStats);
  state.packStamina = blessedStats.stamina;
  state.packPower = blessedStats.power;
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
  const collected = ensureDistrictCollections(state, state.currentDistrictId);
  if (collected[locationKey]) {
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
  collected[locationKey] = true;
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
    removeCampPopulation(state, moved);
  }
  state.campActive = state.campPop > 0;
  if (!state.campActive) {
    state.campFactions = {};
  }
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
