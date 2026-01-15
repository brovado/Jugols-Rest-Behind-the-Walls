const HYENA_NAMES = [
  'Kefa',
  'Asha',
  'Rift',
  'Milo',
  'Zuri',
  'Baki',
  'Nima',
  'Taro',
  'Luma',
  'Kori',
  'Rasa',
  'Pax',
];

export const HYENA_ROLES = ['Scout', 'Bruiser', 'Warden'];
export const HYENA_TEMPERAMENTS = ['Calm', 'Fierce', 'Wary'];

const pickFrom = (list, seed) => {
  if (!Array.isArray(list) || list.length === 0) {
    return '';
  }
  const index = Math.abs(seed) % list.length;
  return list[index];
};

const toFedToday = (fedToday) => ({
  scraps: Math.max(0, fedToday?.scraps || 0),
  fatty: Math.max(0, fedToday?.fatty || 0),
});

export const createHyena = (data) => ({
  id: data.id,
  name: data.name,
  role: data.role,
  temperament: data.temperament,
  hunger: Math.max(0, Math.min(100, data.hunger ?? 50)),
  traits: Array.isArray(data.traits) ? data.traits : [],
  baseStats: data.baseStats || null,
  fedToday: toFedToday(data.fedToday || {}),
});

export const createStarterRoster = () => ([
  createHyena({
    id: 'hyena-scout',
    name: 'Kefa',
    role: 'Scout',
    temperament: 'Wary',
    hunger: 45,
    traits: ['Quick'],
    baseStats: { staminaBonus: 1, powerBonus: 0 },
  }),
  createHyena({
    id: 'hyena-bruiser',
    name: 'Asha',
    role: 'Bruiser',
    temperament: 'Fierce',
    hunger: 50,
    traits: ['Relentless'],
    baseStats: { staminaBonus: 0, powerBonus: 1 },
  }),
  createHyena({
    id: 'hyena-warden',
    name: 'Rift',
    role: 'Warden',
    temperament: 'Calm',
    hunger: 40,
    traits: ['Steady'],
    baseStats: { staminaBonus: 1, powerBonus: 0 },
  }),
  createHyena({
    id: 'hyena-shadow',
    name: 'Nima',
    role: 'Scout',
    temperament: 'Wary',
    hunger: 55,
    traits: ['Silent'],
    baseStats: { staminaBonus: 1, powerBonus: 0 },
  }),
]);

export const createDraftCandidates = (state, count = 3) => {
  const daySeed = (state?.dayNumber || 1) * 17;
  const burstSeed = (state?.burstCount || 0) * 29;
  return Array.from({ length: count }, (_, index) => {
    const seed = daySeed + burstSeed + index * 11;
    const role = pickFrom(HYENA_ROLES, seed);
    const temperament = pickFrom(HYENA_TEMPERAMENTS, seed + 5);
    return createHyena({
      id: `hyena-draft-${state?.dayNumber || 1}-${index}-${seed}`,
      name: pickFrom(HYENA_NAMES, seed + 3),
      role,
      temperament,
      hunger: 35 + ((seed * 3) % 30),
      traits: index % 2 === 0 ? ['Unbroken'] : ['Keen-Eyed'],
      baseStats: {
        staminaBonus: role === 'Scout' ? 1 : 0,
        powerBonus: role === 'Bruiser' ? 1 : 0,
      },
    });
  });
};
