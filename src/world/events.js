import { FACTION_BY_ID } from './factions.js';
import { clampMeter } from '../state/gameState.js';

export const NARRATIVE_EVENTS = [
  {
    id: 'camp-fire-accord',
    triggerConditions: {
      campPopMin: 6,
      populationMin: 12,
    },
    text: 'A shared cookfire draws three camp elders into an unexpected accord. They agree to patrol the waterline together, easing a few nerves.',
    effect: {
      tension: -3,
      campPressure: -4,
    },
  },
  {
    id: 'arcane-quiet-lecture',
    triggerConditions: {
      district: 'arcane',
      populationMin: 14,
    },
    text: 'A late-night lecture spills into the street, drawing apprentices and neighbors alike. The talk turns practical, outlining better ways to keep the ivy back.',
    effect: {
      overgrowth: -3,
    },
  },
  {
    id: 'verdent-waterline',
    triggerConditions: {
      district: 'verdent',
      campPopMin: 4,
    },
    text: 'Verdent stewards mark a new waterline for the camp, cutting a clean trench through the brush. The work leaves fewer places for trouble to hide.',
    effect: {
      tension: -2,
      overgrowth: -2,
    },
  },
  {
    id: 'gilded-debt',
    triggerConditions: {
      factionPresence: 'gilded_exiles',
      campPopMin: 3,
    },
    text: 'A Gilded envoy offers supplies in exchange for a favor to be named later. The camp buzzes with rumors, but the shelves are fuller by dusk.',
    effect: {
      tension: 2,
      housingCapacity: 1,
      futureFlag: 'gilded_debt_owed',
    },
  },
];

const meetsConditions = (state, conditions) => {
  if (!conditions) {
    return true;
  }
  if (conditions.district && state.currentDistrictId !== conditions.district) {
    return false;
  }
  if (typeof conditions.campPopMin === 'number' && state.campPop < conditions.campPopMin) {
    return false;
  }
  if (typeof conditions.populationMin === 'number') {
    const total = (state.housedPop || 0) + (state.campPop || 0);
    if (total < conditions.populationMin) {
      return false;
    }
  }
  if (conditions.factionPresence) {
    const campCount = state.campFactions?.[conditions.factionPresence] || 0;
    if (campCount <= 0) {
      return false;
    }
  }
  return true;
};

export const getNarrativeEvent = (state) => {
  if (!state || state.lastNarrativeEventDay === state.dayNumber) {
    return null;
  }
  const matches = NARRATIVE_EVENTS.filter((event) =>
    meetsConditions(state, event.triggerConditions)
  );
  if (matches.length === 0) {
    return null;
  }
  const choice = matches[Math.floor(Math.random() * matches.length)];
  return choice || null;
};

export const applyNarrativeEventEffects = (state, event) => {
  if (!state || !event?.effect) {
    return;
  }
  const effect = event.effect;
  if (typeof effect.tension === 'number') {
    state.tension = clampMeter(state.tension + effect.tension);
  }
  if (typeof effect.overgrowth === 'number') {
    state.overgrowth = clampMeter(state.overgrowth + effect.overgrowth);
  }
  if (typeof effect.campPressure === 'number') {
    state.campPressure = clampMeter(state.campPressure + effect.campPressure);
  }
  if (typeof effect.housingCapacity === 'number') {
    state.housingCapacity = Math.max(0, state.housingCapacity + effect.housingCapacity);
  }
  if (effect.futureFlag) {
    if (!state.narrativeFlags) {
      state.narrativeFlags = {};
    }
    state.narrativeFlags[effect.futureFlag] = true;
  }
};

export const getNarrativeSourceLabel = (event) => {
  if (event?.triggerConditions?.factionPresence) {
    return FACTION_BY_ID[event.triggerConditions.factionPresence]?.displayName || 'City';
  }
  return 'City';
};
