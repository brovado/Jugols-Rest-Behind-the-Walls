export const CONTACTS = [
  {
    id: 'heart-emberfold-tavern',
    name: 'Emberfold Tavern',
    role: 'Hearth Steward',
    factionId: 'embered_circle',
    districtId: 'heart',
    produces: { scraps: 2, fatty: 0 },
    availability: 'DAY',
    voiceLines: {
      normal: 'Warmth first, walls second. Take what you need, watch captain.',
      strained: 'The ovens run hot and the tempers hotter. Don’t linger.',
      camped: 'The hearths are stretched thin with the campfires outside.',
    },
    legacySlot: 'tavern',
  },
  {
    id: 'heart-coalbridge-exchange',
    name: 'Coalbridge Exchange',
    role: 'Market Steward',
    factionId: 'shadow_syndicate',
    districtId: 'heart',
    produces: { scraps: 1, fatty: 1 },
    availability: 'DAY',
    voiceLines: {
      normal: 'Coin or favors, either buys the day’s provisions.',
      strained: 'Keep your eyes open; the crowd’s on edge today.',
      camped: 'Campers trade in whispers now. Supplies are thinner.',
    },
    legacySlot: 'market',
  },
  {
    id: 'heart-dawncut-provisions',
    name: 'Dawncut Provisions',
    role: 'Butcher Captain',
    factionId: 'radiant_order',
    districtId: 'heart',
    produces: { scraps: 1, fatty: 2 },
    availability: 'DAY',
    voiceLines: {
      normal: 'Measured portions. The watch eats first, the city survives.',
      strained: 'We are rationing hard. Bring calm back to the lanes.',
      camped: 'The camps need discipline. Take what’s allotted and move.',
    },
    legacySlot: 'butcher',
  },
  {
    id: 'arcane-azure-supplier',
    name: 'Azure Supply Hall',
    role: 'Arcane Supplier',
    factionId: 'arcane_consortium',
    districtId: 'arcane',
    produces: { scraps: 2, fatty: 0 },
    availability: 'DAY',
    voiceLines: {
      normal: 'Filed, sealed, and sanctioned. Supplies await the watch.',
      strained: 'Volatile reactions ripple through the stacks. Be swift.',
      camped: 'The camp taxes our wards. Take only what you must.',
    },
    legacySlot: 'tavern',
  },
  {
    id: 'arcane-sigil-broker',
    name: 'Sigil Broker Selra',
    role: 'Sigil Broker',
    factionId: 'shadow_syndicate',
    districtId: 'arcane',
    produces: { scraps: 1, fatty: 1 },
    availability: 'DAY',
    voiceLines: {
      normal: 'Every mark has a price. Yours is already paid.',
      strained: 'Tension draws attention. Keep your sigils hidden.',
      camped: 'The camp murmurs reach even the vaults. Trade quick.',
    },
    legacySlot: 'market',
  },
  {
    id: 'arcane-ichor-butcher',
    name: 'Ichorwright Butchery',
    role: 'Alchemical Butcher',
    factionId: 'arcane_consortium',
    districtId: 'arcane',
    produces: { scraps: 1, fatty: 2 },
    availability: 'DAY',
    voiceLines: {
      normal: 'Cut clean, preserve the reagents. That keeps the city fed.',
      strained: 'The vats are unstable. Don’t jar the racks.',
      camped: 'We’ve diverted stock to the camp. Mind the quota.',
    },
    legacySlot: 'butcher',
  },
  {
    id: 'verdent-mossroot-forager',
    name: 'Mossroot Forager',
    role: 'Forager',
    factionId: 'verdant_enclave',
    districtId: 'verdent',
    produces: { scraps: 2, fatty: 0 },
    availability: 'DAY',
    voiceLines: {
      normal: 'Greens and roots today. The soil still listens.',
      strained: 'The thickets bristle. Tread softly to keep the trail.',
      camped: 'Camp smoke drives the game farther out. Supplies shrink.',
    },
    legacySlot: 'tavern',
  },
  {
    id: 'verdent-seed-market',
    name: 'Seedbound Market',
    role: 'Seed Merchant',
    factionId: 'verdant_enclave',
    districtId: 'verdent',
    produces: { scraps: 1, fatty: 1 },
    availability: 'DAY',
    voiceLines: {
      normal: 'Take seed and grain. Give the city a chance to regrow.',
      strained: 'Stormroots are restless. Don’t spill the baskets.',
      camped: 'The camp needs sprouts, too. Share with care.',
    },
    legacySlot: 'market',
  },
  {
    id: 'verdent-wilds-keeper',
    name: 'Wildskeeper Hound',
    role: 'Game Handler',
    factionId: 'verdant_enclave',
    districtId: 'verdent',
    produces: { scraps: 1, fatty: 2 },
    availability: 'DAY',
    voiceLines: {
      normal: 'Fresh cuts from the wilds. Keep the trails safe.',
      strained: 'Predators prowl closer. We’re stretched thin.',
      camped: 'Campfires spook the herds. Take what we can spare.',
    },
    legacySlot: 'butcher',
  },
];

export const CONTACT_BY_ID = Object.fromEntries(
  CONTACTS.map((contact) => [contact.id, contact])
);

export const getContactById = (contactId) => CONTACT_BY_ID[contactId] || null;

export const getContactsByDistrict = (districtId) =>
  CONTACTS.filter((contact) => contact.districtId === districtId);

export const getContactVoiceLine = (contact, state) => {
  if (!contact) {
    return '';
  }
  if (state.tension >= 60) {
    return contact.voiceLines?.strained || contact.voiceLines?.normal || '';
  }
  if (state.campPop > 0) {
    return contact.voiceLines?.camped || contact.voiceLines?.normal || '';
  }
  return contact.voiceLines?.normal || '';
};

const CONTACT_FACTION_EFFECTS = {
  embered_circle: { tensionDelta: 1 },
  shadow_syndicate: { scrapsBonus: 1 },
  radiant_order: { tensionDelta: -1 },
  arcane_consortium: { scrapsBonus: 1, tensionDelta: 1 },
  verdant_enclave: { fattyBonus: 1, tensionDelta: -1 },
  flame_seekers: { tensionDelta: 1 },
};

export const getContactFactionEffect = (factionId) =>
  CONTACT_FACTION_EFFECTS[factionId] || { tensionDelta: 0 };
