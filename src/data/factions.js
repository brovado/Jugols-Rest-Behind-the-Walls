export const FACTION_REGISTRY = [
  {
    id: 'flame_seekers',
    name: 'Flame Seekers',
    theme: 'Art, expression, culture, passion, performance',
    influenceMeters: ['Tension', 'Morale', 'Night Events'],
    pressureStyle: 'Volatility',
    state: 'active',
    npcRefs: [
      'Maestro Lyric Firestone',
      'Sculptor Aura Marblehands',
      'Bard Jasper Silvertongue',
      'Philosopher Iris Freemind',
      'Rahel Kinbarr',
      'Mara Brightstone',
    ],
    favor: 0,
    visibilityLevel: 65,
    color: '#f97316',
    icon: '🎭',
    activationMessages: {
      reveal: 'Lantern-lit rumors of artists gather in the alleys.',
      active: 'The city surges with a new cultural pulse.',
    },
    influenceRules: [
      {
        action: 'collect',
        location: 'tavern',
        meterDeltas: { tension: 4 },
        visibilityDelta: 6,
        favorDelta: 2,
        log: 'Cultural unrest simmers in the streets.',
      },
      {
        action: 'collect',
        location: 'market',
        meterDeltas: { tension: 2 },
        visibilityDelta: 4,
        favorDelta: 1,
      },
      {
        action: 'start_night',
        requires: { tensionMin: 55 },
        meterDeltas: { tension: 3 },
        visibilityDelta: 2,
        log: 'Lantern-lit performances spill into the alleys.',
      },
    ],
    visibilityTriggers: [
      { type: 'meter', key: 'tension', min: 50, delta: 3 },
    ],
  },
  {
    id: 'arcane_consortium',
    name: 'Arcane Consortium',
    theme: 'Knowledge, experimentation, progress, arcane control',
    influenceMeters: ['Overgrowth', 'Resource Efficiency', 'Risk'],
    pressureStyle: 'Escalation',
    state: 'active',
    npcRefs: [
      'Archmage Zephyr Stormweaver',
      'Professor Elyndria Moonwhisper',
      'Artificer Garrick Gearspinner',
      'Lorekeeper Thalindra Stargazer',
    ],
    favor: 0,
    visibilityLevel: 60,
    color: '#38bdf8',
    icon: '🔮',
    activationMessages: {
      reveal: 'Arcane signals ripple beneath the city’s routine.',
      active: 'Experimental energies crackle through the streets.',
    },
    influenceRules: [
      {
        action: 'collect',
        location: 'market',
        resourceDeltas: { foodScraps: 1 },
        meterDeltas: { overgrowth: 1 },
        visibilityDelta: 4,
        favorDelta: 2,
        log: 'Arcane experimentation strains the city’s balance.',
      },
      {
        action: 'clear_overgrowth',
        meterDeltas: { overgrowth: -5, tension: 2 },
        visibilityDelta: 3,
        favorDelta: 1,
      },
    ],
    visibilityTriggers: [
      { type: 'meter', key: 'overgrowth', min: 40, delta: 3 },
    ],
  },
  {
    id: 'radiant_order',
    name: 'Radiant Order',
    theme: 'Law, order, public safety, authority',
    influenceMeters: ['Camp Pressure', 'Threat Suppression', 'Stability'],
    pressureStyle: 'Restriction',
    state: 'active',
    npcRefs: [
      'High Councilor Elara Dawnbringer',
      'Captain Thorne Ironshield',
      'Judge Lyra Truthseeker',
      'Healer Aric Lighttouch',
      'Roderic Thorne',
      'Baroness Freya Fuskwood',
    ],
    favor: 0,
    visibilityLevel: 55,
    color: '#facc15',
    icon: '🛡️',
    activationMessages: {
      reveal: 'Orderly patrol patterns tighten in the background.',
      active: 'Authority stiffens across the city wards.',
    },
    influenceRules: [
      {
        action: 'stabilize_camp',
        meterDeltas: { campPressure: -6, tension: -3 },
        visibilityDelta: 5,
        favorDelta: 2,
        log: 'Watch patrols tighten their routes.',
      },
      {
        action: 'guard_route',
        meterDeltas: { campPressure: -2 },
        visibilityDelta: 2,
        favorDelta: 1,
      },
      {
        action: 'suppress_threat',
        meterDeltas: { tension: -4 },
        visibilityDelta: 3,
        favorDelta: 2,
      },
    ],
    visibilityTriggers: [
      { type: 'meter', key: 'campPressure', min: 35, delta: 3 },
      { type: 'flag', key: 'threatActive', value: true, delta: 3 },
    ],
  },
  {
    id: 'shadow_syndicate',
    name: 'Shadow Syndicate',
    theme: 'Secrets, leverage, influence, crime, information',
    influenceMeters: ['Tension', 'Action Availability', 'Hidden Outcomes'],
    pressureStyle: 'Opportunism',
    state: 'hidden',
    npcRefs: ['The Whisper', 'Raven', 'Silvertongue', 'Shadowblade'],
    favor: 0,
    visibilityLevel: 15,
    color: '#64748b',
    icon: '🕯️',
    activationMessages: {
      reveal: 'Whispers collect along the city’s shadowed lanes.',
      active: 'Secretive deals now steer the city’s pulse.',
    },
    influenceRules: [
      {
        action: 'collect',
        location: 'market',
        resourceDeltas: { foodScraps: 1 },
        meterDeltas: { tension: -2 },
        visibilityDelta: 4,
        favorDelta: 2,
        log: 'Unseen bargains shift the city’s balance.',
      },
    ],
    visibilityTriggers: [
      { type: 'meter', key: 'tension', min: 60, delta: 4 },
      { type: 'flag', key: 'threatActive', value: true, delta: 3 },
    ],
  },
  {
    id: 'verdant_enclave',
    name: 'Verdant Enclave',
    theme: 'Nature, balance, growth, preservation',
    influenceMeters: ['Overgrowth', 'Population Flow', 'Resource Renewal'],
    pressureStyle: 'Entanglement',
    state: 'dormant',
    npcRefs: [
      'Elder Thorne Oakenheart',
      'Druid Willow Streamwhisper',
      'Ranger Alder Pathfinder',
      'Alchemist Sage Greenleaf',
      'Eldrin Silverleaf',
    ],
    favor: 0,
    visibilityLevel: 35,
    color: '#4ade80',
    icon: '🌿',
    activationMessages: {
      reveal: 'Vines creep closer to the city’s edge.',
      active: 'Nature’s balance presses into the streets.',
    },
    influenceRules: [
      {
        action: 'clear_overgrowth',
        meterDeltas: { overgrowth: -6, campPressure: -1 },
        visibilityDelta: 4,
        favorDelta: 2,
        log: 'Verdant growth reshapes the outskirts.',
      },
    ],
    visibilityTriggers: [
      { type: 'meter', key: 'overgrowth', min: 50, delta: 4 },
    ],
  },
  {
    id: 'embered_circle',
    name: 'Embered Circle',
    theme: 'Architecture, infrastructure, long-term design, control',
    influenceMeters: ['Camp Pressure', 'Route Zones', 'Structural Stability'],
    pressureStyle: 'Permanence',
    state: 'dormant',
    npcRefs: [
      'Grand Architect Lyria Voss',
      'Arcanist Talon Sable',
      'Lady Seraphina Stormwind',
      'Varek Ironclad',
      'Kaelin Yrlathor',
    ],
    favor: 0,
    visibilityLevel: 30,
    color: '#a855f7',
    icon: '🏗️',
    activationMessages: {
      reveal: 'Blueprints quietly circulate among builders.',
      active: 'Long-term plans begin to shape the city.',
    },
    influenceRules: [
      {
        action: 'secure_lot',
        resourceDeltas: { housingCapacity: 1 },
        meterDeltas: { campPressure: -3 },
        visibilityDelta: 4,
        favorDelta: 2,
        log: 'Foundations settle into lasting shape.',
      },
      {
        action: 'guard_route',
        meterDeltas: { campPressure: -1 },
        visibilityDelta: 2,
        favorDelta: 1,
      },
    ],
    visibilityTriggers: [
      { type: 'meter', key: 'campPressure', min: 45, delta: 4 },
    ],
  },
];

// TODO: Narrative unlocks per faction.
// TODO: NPC introduction events.
// TODO: Faction collision events.
// TODO: Reputation-based branching.

export const FACTION_BY_ID = Object.fromEntries(
  FACTION_REGISTRY.map((faction) => [faction.id, faction])
);

export const createFactionStates = () =>
  FACTION_REGISTRY.map((faction) => ({
    id: faction.id,
    state: faction.state,
    favor: faction.favor,
    visibilityLevel: faction.visibilityLevel,
  }));

export const normalizeFactionStates = (savedFactions) => {
  const base = createFactionStates();
  if (!Array.isArray(savedFactions)) {
    return base;
  }
  const savedById = new Map(savedFactions.map((faction) => [faction.id, faction]));
  return base.map((faction) => {
    const saved = savedById.get(faction.id);
    if (!saved) {
      return faction;
    }
    return {
      ...faction,
      state: ['active', 'dormant', 'hidden'].includes(saved.state)
        ? saved.state
        : faction.state,
      favor: typeof saved.favor === 'number' ? saved.favor : faction.favor,
      visibilityLevel:
        typeof saved.visibilityLevel === 'number'
          ? saved.visibilityLevel
          : faction.visibilityLevel,
    };
  });
};
