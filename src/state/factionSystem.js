import {
  FACTION_REGISTRY,
  FACTION_BY_ID,
  createFactionStates,
} from '../data/factions.js';
import { addEvent, clampMeter } from './gameState.js';

const VISIBILITY_THRESHOLDS = {
  dormant: 40,
  active: 65,
};

const clampVisibility = (value) => Math.max(0, Math.min(100, value));

const getRuntimeFaction = (state, factionId) => {
  if (!Array.isArray(state.factions)) {
    state.factions = createFactionStates();
  }
  let runtime = state.factions.find((entry) => entry.id === factionId);
  if (!runtime) {
    runtime = {
      id: factionId,
      state: 'dormant',
      favor: 0,
      visibilityLevel: 0,
    };
    state.factions.push(runtime);
  }
  return runtime;
};

const matchesRule = (rule, action, context, state) => {
  if (rule.action && rule.action !== action) {
    return false;
  }
  if (rule.location && rule.location !== context.location) {
    return false;
  }
  if (rule.requires?.tensionMin && state.tension < rule.requires.tensionMin) {
    return false;
  }
  if (rule.requires?.overgrowthMin && state.overgrowth < rule.requires.overgrowthMin) {
    return false;
  }
  if (rule.requires?.campPressureMin && state.campPressure < rule.requires.campPressureMin) {
    return false;
  }
  return true;
};

const applyMeterDeltas = (state, meterDeltas) => {
  if (!meterDeltas) {
    return;
  }
  if (typeof meterDeltas.tension === 'number') {
    state.tension = clampMeter(state.tension + meterDeltas.tension);
  }
  if (typeof meterDeltas.overgrowth === 'number') {
    state.overgrowth = clampMeter(state.overgrowth + meterDeltas.overgrowth);
  }
  if (typeof meterDeltas.campPressure === 'number') {
    state.campPressure = clampMeter(state.campPressure + meterDeltas.campPressure);
  }
  if (typeof meterDeltas.threat === 'number') {
    const nextThreat = state.threatActive ? 100 : 0;
    const nextValue = clampMeter(nextThreat + meterDeltas.threat);
    state.threatActive = nextValue >= 50;
  }
};

const applyResourceDeltas = (state, resourceDeltas) => {
  if (!resourceDeltas) {
    return;
  }
  if (typeof resourceDeltas.foodScraps === 'number') {
    state.foodScraps = Math.max(0, state.foodScraps + resourceDeltas.foodScraps);
  }
  if (typeof resourceDeltas.foodFatty === 'number') {
    state.foodFatty = Math.max(0, state.foodFatty + resourceDeltas.foodFatty);
  }
  if (typeof resourceDeltas.housingCapacity === 'number') {
    state.housingCapacity = Math.max(0, state.housingCapacity + resourceDeltas.housingCapacity);
  }
};

const applyVisibilityTriggers = (state, faction, runtime) => {
  const triggers = faction.visibilityTriggers || [];
  triggers.forEach((trigger) => {
    if (trigger.type === 'meter') {
      const value = state[trigger.key];
      if (typeof value === 'number' && value >= trigger.min) {
        runtime.visibilityLevel = clampVisibility(
          runtime.visibilityLevel + (trigger.delta || 0)
        );
      }
    }
    if (trigger.type === 'flag') {
      const value = state[trigger.key];
      if (value === trigger.value) {
        runtime.visibilityLevel = clampVisibility(
          runtime.visibilityLevel + (trigger.delta || 0)
        );
      }
    }
  });
};

const updateFactionState = (state, faction, runtime) => {
  const previous = runtime.state;
  if (runtime.visibilityLevel >= VISIBILITY_THRESHOLDS.active) {
    runtime.state = 'active';
  } else if (runtime.visibilityLevel >= VISIBILITY_THRESHOLDS.dormant) {
    runtime.state = runtime.state === 'hidden' ? 'dormant' : runtime.state;
  }

  if (previous === runtime.state) {
    return;
  }

  const messageKey = runtime.state === 'active' ? 'active' : 'reveal';
  const message = faction.activationMessages?.[messageKey];
  if (message) {
    addEvent(state, message);
  }
};

export const applyFactionInfluence = (state, action, context = {}) => {
  if (!state) {
    return;
  }

  FACTION_REGISTRY.forEach((faction) => {
    const runtime = getRuntimeFaction(state, faction.id);
    if (runtime.state !== 'active') {
      return;
    }
    (faction.influenceRules || []).forEach((rule) => {
      if (!matchesRule(rule, action, context, state)) {
        return;
      }
      applyMeterDeltas(state, rule.meterDeltas);
      applyResourceDeltas(state, rule.resourceDeltas);
      if (typeof rule.visibilityDelta === 'number') {
        runtime.visibilityLevel = clampVisibility(
          runtime.visibilityLevel + rule.visibilityDelta
        );
      }
      if (typeof rule.favorDelta === 'number') {
        runtime.favor += rule.favorDelta;
      }
      if (rule.log) {
        addEvent(state, rule.log);
      }
    });
  });

  FACTION_REGISTRY.forEach((faction) => {
    const runtime = getRuntimeFaction(state, faction.id);
    applyVisibilityTriggers(state, faction, runtime);
    updateFactionState(state, faction, runtime);
  });
};

export const getActiveFactions = (state) => {
  if (!Array.isArray(state?.factions)) {
    return [];
  }
  return state.factions
    .filter((faction) => faction.state === 'active')
    .map((faction) => ({
      ...faction,
      ...FACTION_BY_ID[faction.id],
    }))
    .filter((faction) => Boolean(faction.name));
};
