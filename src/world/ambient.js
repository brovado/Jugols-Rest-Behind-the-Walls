import { FACTION_BY_ID } from './factions.js';
import { DISTRICTS } from './districts.js';

const DISTRICT_AMBIENT = {
  heart: {
    DAY: [
      'Merchants call out new prices while patrols pace the main avenue.',
      'Bakers pass warm loaves over the counter, trading nods with the watch.',
    ],
    NIGHT: [
      'Lanterns swing low as the Heart District settles into guarded quiet.',
      'You hear a distant bell mark the watch change near the plazas.',
    ],
  },
  arcane: {
    DAY: [
      'Arcane couriers hurry by with sealed satchels and ink-stained sleeves.',
      'A faint shimmer hangs over the market stalls near the academies.',
    ],
    NIGHT: [
      'Runes glow softly on shuttered doors, keeping the night polite.',
      'Whispers of lectures linger in the cool arcane air.',
    ],
  },
  verdent: {
    DAY: [
      'Verdent gardeners trade cuttings, promising to keep the ivy tame.',
      'Water carriers move in slow lines, splashing green light on the stone.',
    ],
    NIGHT: [
      'Crickets and watch whistles share the verdent night in equal measure.',
      'Leaves rustle where someone checks the perimeter with a lantern.',
    ],
  },
};

const GENERIC_AMBIENT = {
  DAY: [
    'Jugol’s Rest breathes, its alleys busy with small negotiations.',
    'A street singer hums a tune about the walls holding strong.',
  ],
  NIGHT: [
    'The city settles into a wary hush as the night watch takes over.',
    'Somewhere, a kettle rattles over a guarded fire.',
  ],
};

const CAMP_AMBIENT = {
  DAY: [
    'Camp stewards trade shifts, trying to keep tempers from rising.',
    'A line forms at the camp cookfire, quiet but expectant.',
  ],
  NIGHT: [
    'Campfires flicker while sentries trade hushed warnings.',
    'The camp settles into uneasy silence under the walls.',
  ],
};

const pickLine = (lines) => {
  if (!Array.isArray(lines) || lines.length === 0) {
    return null;
  }
  return lines[Math.floor(Math.random() * lines.length)];
};

export const getAmbientLine = (context) => {
  const phase = context?.phase === 'NIGHT' ? 'NIGHT' : 'DAY';
  const districtId = context?.currentDistrictId || 'heart';
  const factionId = context?.dominantFaction;

  const options = [];

  if (factionId && FACTION_BY_ID[factionId]?.ambientLines?.length) {
    options.push({
      source: FACTION_BY_ID[factionId].displayName,
      lines: FACTION_BY_ID[factionId].ambientLines,
    });
  }

  if (context?.campPop) {
    options.push({ source: 'City', lines: CAMP_AMBIENT[phase] });
  }

  const districtLines = DISTRICT_AMBIENT[districtId]?.[phase];
  if (districtLines?.length) {
    const districtName = DISTRICTS[districtId]?.displayName || 'City';
    options.push({ source: districtName, lines: districtLines });
  }

  options.push({ source: 'City', lines: GENERIC_AMBIENT[phase] });

  const choice = options[Math.floor(Math.random() * options.length)];
  const line = pickLine(choice?.lines);
  if (!line) {
    return null;
  }
  if (context) {
    context.ambientSource = choice?.source || 'City';
  }
  return line;
};
