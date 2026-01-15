export const DEFAULT_FACTION_ID = 'wayfarers';

export const FACTIONS = [
  {
    id: 'hearthbound_union',
    displayName: 'Hearthbound Union',
    ideologyTag: 'Duty & mutual aid',
    districtBias: 'heart',
    campBehavior: {
      tensionModifier: 0.9,
      overgrowthModifier: 1.0,
      ruckusModifier: 0.85,
    },
    ambientLines: [
      'A Union steward counts ration slips while neighbors trade quiet jokes.',
      'You catch the low hum of a work chant, steadying tired shoulders.',
    ],
    arrivalFlavor: 'Union kin arrive with handcarts and a clear plan for sharing work.'
  },
  {
    id: 'arcane_conclave',
    displayName: 'Arcane Conclave',
    ideologyTag: 'Knowledge & experiment',
    districtBias: 'arcane',
    campBehavior: {
      tensionModifier: 1.1,
      overgrowthModifier: 1.2,
      ruckusModifier: 1.05,
    },
    ambientLines: [
      'A pair of apprentices debate a warding glyph with chalk-stained hands.',
      'The air smells faintly of ozone where the Conclave pitches its tents.',
    ],
    arrivalFlavor: 'Conclave caravans set down cases of instruments and sealed books.'
  },
  {
    id: 'verdent_covenant',
    displayName: 'Verdent Covenant',
    ideologyTag: 'Balance & regrowth',
    districtBias: 'verdent',
    campBehavior: {
      tensionModifier: 0.85,
      overgrowthModifier: 0.7,
      ruckusModifier: 0.9,
    },
    ambientLines: [
      'Soft prayers mingle with the sound of seeds being counted by hand.',
      'A Covenant warden trades river herbs for a promise to keep the roots calm.',
    ],
    arrivalFlavor: 'Covenant travelers arrive with bundled seedlings and river water.'
  },
  {
    id: 'gilded_exiles',
    displayName: 'Gilded Exiles',
    ideologyTag: 'Status & survival',
    districtBias: 'any',
    campBehavior: {
      tensionModifier: 1.15,
      overgrowthModifier: 1.0,
      ruckusModifier: 1.2,
    },
    ambientLines: [
      'Silk-clad voices barter for privacy in the shadow of the walls.',
      'A Gilded courier whispers about debts owed beyond the gates.',
    ],
    arrivalFlavor: 'The Exiles arrive guarded, eyes sharp for new leverage.'
  },
  {
    id: 'wayfarers',
    displayName: 'Wayfarers',
    ideologyTag: 'Freedom & improvisation',
    districtBias: 'any',
    campBehavior: {
      tensionModifier: 1.0,
      overgrowthModifier: 1.0,
      ruckusModifier: 1.1,
    },
    ambientLines: [
      'Wayfarers swap road stories, mapping safe alleys with charcoal marks.',
      'A cookfire pops while a Wayfarer guard keeps an easy grin on watch.',
    ],
    arrivalFlavor: 'Wayfarers drift in with patched packs and fresh gossip.'
  },
];

export const FACTION_BY_ID = Object.fromEntries(
  FACTIONS.map((faction) => [faction.id, faction])
);

export const getFactionById = (id) => FACTION_BY_ID[id] || null;
