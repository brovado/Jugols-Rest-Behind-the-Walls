import {
  getDominantCampFaction,
  getHyenaContribution,
  getIncomingTotal,
} from '../state/gameState.js';
import { getActiveFactions } from '../state/factionSystem.js';
import { getDistrictConfig } from '../world/districts.js';
import {
  formatBlessingDuration,
  formatBlessingEffect,
} from '../world/blessings.js';
import { GODS, GOD_BY_ID } from '../world/gods.js';
import { getDomUI } from './domUI.js';
import {
  isPanelOpen,
  setPanelActive,
  setPanelDirty,
  setPanelStateText,
} from './panelDock.js';

const LOG_LINES = 5;
let domHudInstance = null;

const createElement = (tag, className, text) => {
  const el = document.createElement(tag);
  if (className) {
    el.className = className;
  }
  if (text !== undefined) {
    el.textContent = text;
  }
  return el;
};

const setVisible = (el, visible) => {
  el.style.display = visible ? '' : 'none';
};

const createHudButton = (label, onClick) => {
  const wrapper = createElement('div', 'hud-button-wrapper');
  const button = createElement('button', 'hud-button');
  const reason = createElement('div', 'hud-button-reason', '');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', () => {
    if (!button.disabled) {
      onClick?.();
    }
  });

  wrapper.append(button, reason);

  return {
    el: wrapper,
    setEnabled: (enabled) => {
      button.disabled = !enabled;
    },
    setLabel: (nextLabel) => {
      button.textContent = nextLabel;
    },
    setVisible: (visible) => setVisible(wrapper, visible),
    setHighlighted: (highlighted) => {
      button.classList.toggle('is-highlighted', Boolean(highlighted));
    },
    setReason: (text) => {
      if (text) {
        reason.textContent = text;
        reason.classList.add('is-visible');
      } else {
        reason.textContent = '';
        reason.classList.remove('is-visible');
      }
    },
  };
};

const createMeter = (label, color) => {
  const container = createElement('div', 'hud-meter');
  const header = createElement('div', 'hud-meter-header');
  const labelEl = createElement('div', null, label);
  const valueEl = createElement('div', null, '0%');
  header.append(labelEl, valueEl);

  const bar = createElement('div', 'hud-meter-bar');
  const fill = createElement('div', 'hud-meter-fill');
  fill.style.background = color;
  bar.appendChild(fill);

  container.append(header, bar);

  return {
    container,
    update: (value, max) => {
      const safeMax = max > 0 ? max : 1;
      const ratio = Math.max(0, Math.min(1, value / safeMax));
      fill.style.width = `${Math.round(ratio * 100)}%`;
      valueEl.textContent = `${Math.round(ratio * 100)}%`;
    },
  };
};

const createPopulationRow = (label) => {
  const labelEl = createElement('div', 'status-label', label);
  const valueEl = createElement('div', 'status-value', '0');
  return { labelEl, valueEl };
};

const createPopulationBar = (label, color) => {
  const container = createElement('div', 'population-bar');
  const header = createElement('div', 'population-bar-header');
  const labelEl = createElement('div', null, label);
  const valueEl = createElement('div', null, '0');
  header.append(labelEl, valueEl);

  const track = createElement('div', 'population-bar-track');
  const fill = createElement('div', 'population-bar-fill');
  fill.style.background = color;
  track.appendChild(fill);

  container.append(header, track);

  return {
    container,
    update: (value, total) => {
      const safeTotal = total > 0 ? total : 1;
      const ratio = Math.max(0, Math.min(1, value / safeTotal));
      fill.style.width = `${Math.round(ratio * 100)}%`;
      valueEl.textContent = total > 0 ? `${value} / ${total}` : `${value}`;
    },
  };
};

export const initDomHud = (state, callbacks) => {
  if (domHudInstance) {
    return domHudInstance;
  }

  const actionsPanel = document.getElementById('actions-panel');
  const packPanel = document.getElementById('pack-panel');
  const feedPanel = document.getElementById('feed-panel');
  const metersPanel = document.getElementById('meters-panel');
  const populationPanel = document.getElementById('population-panel');
  const consoleLog = document.getElementById('console-log');
  const headerLeft = document.getElementById('hud-header-left');
  const headerCenter = document.getElementById('hud-header-center');
  const headerRight = document.getElementById('hud-header-right');
  const interactionPrompt = document.getElementById('interaction-prompt');
  const interactionPromptText = interactionPrompt?.querySelector('.interaction-prompt-text') || null;
  const interactionPromptReason =
    interactionPrompt?.querySelector('.interaction-prompt-reason') || null;

  if (!actionsPanel || !packPanel || !feedPanel || !metersPanel || !populationPanel || !consoleLog) {
    return null;
  }

  actionsPanel.innerHTML = '';
  packPanel.innerHTML = '';
  feedPanel.innerHTML = '';
  metersPanel.innerHTML = '';
  populationPanel.innerHTML = '';

  const hudStatus = createElement('div', 'hud-status');
  const hudStatusRow = createElement('div', 'hud-status-row');
  const dayText = createElement('div', null, 'Day 1');
  const districtBadge = createElement('div', 'hud-phase-badge', 'Heart District');
  const phaseBadge = createElement('div', 'hud-phase-badge hud-phase-day', 'DAY');
  hudStatusRow.append(dayText, districtBadge, phaseBadge);

  const statusText = createElement('div', 'status-value', '');
  hudStatus.append(hudStatusRow, statusText);

  const poiPanel = createElement('div', 'poi-panel');
  const poiHeader = createElement('div', 'poi-panel-header', 'Active Patrols');
  const poiContext = createElement('div', 'poi-context', '');
  const poiList = createElement('div', 'poi-list');
  poiPanel.append(poiHeader, poiContext, poiList);

  const shrinePanel = createElement('div', 'shrine-panel');
  const shrineHeader = createElement('div', 'shrine-panel-header');
  const shrineTitle = createElement('div', null, 'Shrines');
  const shrineToggle = createElement('button', 'shrine-toggle', 'Show');
  shrineToggle.type = 'button';
  shrineHeader.append(shrineTitle, shrineToggle);

  const shrineCount = createElement('div', 'shrine-count', 'Shrines: 0/0');
  const shrinePrompt = createElement('div', 'shrine-prompt', '');
  const shrineList = createElement('div', 'shrine-list');

  const blessingHeader = createElement('div', 'shrine-panel-header', 'Active Blessings');
  const blessingList = createElement('div', 'blessing-list');

  shrinePanel.append(
    shrineHeader,
    shrineCount,
    shrinePrompt,
    shrineList,
    blessingHeader,
    blessingList
  );

  actionsPanel.append(hudStatus, poiPanel, shrinePanel);

  const packSummary = createElement('div', null, 'Tonight’s contributions:');
  const packCardsContainer = createElement('div', 'hud-action-group');
  packPanel.append(packSummary, packCardsContainer);
  const packCards = new Map();
  const feedPanelBody = createElement('div', 'feed-panel');
  const feedNote = createElement(
    'div',
    'feed-note',
    'Feeding now happens at the Stable command deck in Camp.'
  );
  feedPanelBody.append(feedNote);
  feedPanel.append(feedPanelBody);

  const createHyenaCard = (hyena) => {
    const card = createElement('div', 'pack-card');
    const header = createElement('div', 'pack-card-header');
    const nameText = createElement('div', 'pack-card-name', hyena.name);
    const roleText = createElement('div', 'pack-card-role', hyena.role);
    header.append(nameText, roleText);

    const temperamentText = createElement('div', 'pack-card-temp', hyena.temperament);

    const hungerWrapper = createElement('div');
    const hungerLabel = createElement('div', 'status-label', 'Hunger');
    const hungerBar = createElement('div', 'hunger-bar');
    const hungerFill = createElement('div', 'hunger-fill');
    hungerBar.appendChild(hungerFill);
    hungerWrapper.append(hungerLabel, hungerBar);

    const contributionText = createElement('div', 'pack-card-contrib', '');

    card.append(header, temperamentText, hungerWrapper, contributionText);
    packCardsContainer.appendChild(card);

    return {
      card,
      nameText,
      roleText,
      temperamentText,
      hungerFill,
      contributionText,
    };
  };

  const initializePackCards = (stateSnapshot) => {
    packCardsContainer.innerHTML = '';
    packCards.clear();
    if (!Array.isArray(stateSnapshot.pack)) {
      return;
    }
    stateSnapshot.pack.forEach((hyena) => {
      packCards.set(hyena.id, createHyenaCard(hyena));
    });
  };

  initializePackCards(state);

  const tensionMeter = createMeter('Tension', '#f97316');
  const overgrowthMeter = createMeter('Overgrowth', '#4ade80');
  const campMeter = createMeter('Camp Pressure', '#38bdf8');
  const threatMeter = createMeter('Threat', '#f87171');

  metersPanel.append(
    tensionMeter.container,
    overgrowthMeter.container,
    campMeter.container,
    threatMeter.container
  );

  const factionSection = createElement('div', 'hud-faction-section');
  const factionHeader = createElement('div', 'hud-faction-header', 'City Pressure');
  const factionList = createElement('div', 'hud-faction-list');
  factionSection.append(factionHeader, factionList);
  metersPanel.append(factionSection);

  const populationGrid = createElement('div', 'population-grid');
  const populationRows = {
    total: createPopulationRow('Total Population'),
    housed: createPopulationRow('Housed'),
    camped: createPopulationRow('Camped'),
    available: createPopulationRow('Available Housing'),
    incoming: createPopulationRow('Incoming Next Day'),
  };
  Object.values(populationRows).forEach(({ labelEl, valueEl }) => {
    populationGrid.append(labelEl, valueEl);
  });

  const housedBar = createPopulationBar('Housed', '#4ade80');
  const campedBar = createPopulationBar('Camped', '#f97316');

  const campDominanceNote = createElement('div', 'population-note', '');

  populationPanel.append(
    populationGrid,
    housedBar.container,
    campedBar.container,
    campDominanceNote
  );

  let interactionLocked = false;
  let lastEventCount = 0;
  let statusFlashTimer = null;
  let lastMeterSnapshot = null;
  let lastMeterChangeAt = 0;
  let lastPackSnapshot = null;
  let lastPackChangeAt = 0;
  let lastPackFood = null;
  let lastPopulationSnapshot = null;
  let lastPopulationChangeAt = 0;
  let shrineListVisible = false;
  const updateHeader = (stateSnapshot) => {
    const district = getDistrictConfig(stateSnapshot.currentDistrictId);
    if (headerLeft) {
      headerLeft.textContent = `Day ${stateSnapshot.dayNumber} • ${stateSnapshot.phase}`;
    }
    if (headerCenter) {
      headerCenter.textContent = district.displayName;
    }
    if (headerRight) {
      headerRight.textContent =
        stateSnapshot.phase === 'DAY'
          ? `Actions: ${stateSnapshot.dayActionsRemaining}`
          : `Stamina: ${stateSnapshot.packStamina} | Power: ${stateSnapshot.packPower}`;
    }
  };

  shrineToggle.addEventListener('click', () => {
    shrineListVisible = !shrineListVisible;
    shrineToggle.textContent = shrineListVisible ? 'Hide' : 'Show';
  });

  const updateTopStatus = (stateSnapshot) => {
    dayText.textContent = `Day ${stateSnapshot.dayNumber}`;
    const district = getDistrictConfig(stateSnapshot.currentDistrictId);
    districtBadge.textContent = district.displayName;
    phaseBadge.textContent = stateSnapshot.phase;
    phaseBadge.classList.toggle('hud-phase-day', stateSnapshot.phase === 'DAY');
    phaseBadge.classList.toggle('hud-phase-night', stateSnapshot.phase === 'NIGHT');
    statusText.textContent =
      stateSnapshot.phase === 'DAY'
        ? `Actions Remaining: ${stateSnapshot.dayActionsRemaining}`
        : `Pack Stamina: ${stateSnapshot.packStamina} | Power: ${stateSnapshot.packPower}`;
    updateHeader(stateSnapshot);
  };

  const formatPoiType = (type) => {
    switch (type) {
      case 'OVERGROWTH':
        return 'Overgrowth';
      case 'ROUTE':
        return 'Route';
      case 'RUCKUS':
        return 'Ruckus';
      case 'LOT':
        return 'Lot';
      default:
        return 'Unknown';
    }
  };

  const getPoiIcon = (type) => {
    switch (type) {
      case 'OVERGROWTH':
        return 'O';
      case 'ROUTE':
        return 'RT';
      case 'RUCKUS':
        return 'RK';
      case 'LOT':
        return 'L';
      default:
        return '?';
    }
  };

  const updatePoiPanel = (stateSnapshot, context) => {
    if (stateSnapshot.phase !== 'NIGHT') {
      poiContext.textContent = 'Patrols go live at nightfall.';
      poiList.innerHTML = '';
      return;
    }

    const activePois = Array.isArray(context.activePois) ? context.activePois : [];
    const sorted = activePois
      .slice()
      .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));

    if (context.nearestPoiInRange && context.nearestPoi) {
      poiContext.textContent = `Nearest POI: ${formatPoiType(context.nearestPoi.type)} (Severity ${context.nearestPoi.severity})`;
    } else if (context.nearestPoi) {
      poiContext.textContent = `Nearest POI: ${formatPoiType(context.nearestPoi.type)} (${Math.round(
        context.nearestPoiDistance || 0
      )}m)`;
    } else {
      poiContext.textContent = 'No active patrols found.';
    }

    poiList.innerHTML = '';
    if (sorted.length === 0) {
      const emptyRow = createElement('div', 'poi-row poi-row-empty', 'No active POIs.');
      poiList.appendChild(emptyRow);
      return;
    }

    sorted.slice(0, 4).forEach((poi) => {
      const row = createElement('div', 'poi-row');
      const icon = createElement('div', 'poi-icon', getPoiIcon(poi.type));
      const label = createElement(
        'div',
        'poi-label',
        `${formatPoiType(poi.type)} (S${poi.severity})`
      );
      const distance = createElement(
        'div',
        'poi-distance',
        `${Math.round(poi.distance ?? 0)}m`
      );
      row.append(icon, label, distance);
      poiList.appendChild(row);
    });
  };

  const updateShrinePanel = (stateSnapshot, context) => {
    const discovered = stateSnapshot.discoveredShrines || {};
    const discoveredCount = Object.keys(discovered).length;
    shrineCount.textContent = `Shrines: ${discoveredCount}/${GODS.length}`;

    shrinePrompt.textContent = '';
    if (context.nearestShrine && context.shrineGod) {
      if (context.nearestShrineInRange) {
        shrinePrompt.textContent = context.nearestShrine.prayedToday
          ? `Shrine of ${context.shrineGod.name} — Already prayed today`
          : `Shrine of ${context.shrineGod.name} — Press F to Pray`;
      } else if (typeof context.nearestShrineDistance === 'number') {
        shrinePrompt.textContent = `Shrine of ${context.shrineGod.name} — ${Math.round(
          context.nearestShrineDistance
        )}m away`;
      }
    }
    setVisible(shrinePrompt, Boolean(shrinePrompt.textContent));

    setVisible(shrineList, shrineListVisible);
    if (shrineListVisible) {
      shrineList.innerHTML = '';
      const discoveredGods = GODS.filter((god) => discovered[god.id]);
      if (discoveredGods.length === 0) {
        shrineList.append(
          createElement('div', 'shrine-list-empty', 'No shrines discovered yet.')
        );
      } else {
        discoveredGods.forEach((god) => {
          const row = createElement('div', 'shrine-list-row');
          const name = createElement('div', 'shrine-list-name', god.name);
          const domains = createElement(
            'div',
            'shrine-list-domains',
            god.domains.join(', ')
          );
          row.append(name, domains);
          shrineList.append(row);
        });
      }
    }

    blessingList.innerHTML = '';
    const activeBlessings = Array.isArray(stateSnapshot.activeBlessings)
      ? stateSnapshot.activeBlessings
      : [];
    if (activeBlessings.length === 0) {
      blessingList.append(
        createElement('div', 'blessing-empty', 'No active blessings.')
      );
      return;
    }
    activeBlessings.forEach((blessing) => {
      const row = createElement('div', 'blessing-row');
      const god = blessing?.godId ? GOD_BY_ID[blessing.godId] : null;
      const name = createElement('div', 'blessing-name', god?.name || 'Blessing');
      const effect = createElement(
        'div',
        'blessing-effect',
        formatBlessingEffect(blessing)
      );
      const duration = formatBlessingDuration(blessing);
      if (duration) {
        const durationEl = createElement('div', 'blessing-duration', duration);
        row.append(name, effect, durationEl);
      } else {
        row.append(name, effect);
      }
      blessingList.append(row);
    });
  };

  const updateInteractionPrompt = (context) => {
    if (!interactionPrompt || !interactionPromptText || !interactionPromptReason) {
      return;
    }
    const prompt = context?.interactionPrompt;
    if (!prompt) {
      interactionPrompt.classList.remove('is-visible');
      interactionPromptText.textContent = '';
      interactionPromptReason.textContent = '';
      return;
    }
    interactionPrompt.classList.add('is-visible');
    interactionPromptText.textContent = prompt.text || '';
    if (prompt.reason) {
      interactionPromptReason.textContent = prompt.reason;
      interactionPromptReason.style.display = 'block';
    } else {
      interactionPromptReason.textContent = '';
      interactionPromptReason.style.display = 'none';
    }
  };

  const updateMeters = (stateSnapshot) => {
    tensionMeter.update(stateSnapshot.tension, 100);
    overgrowthMeter.update(stateSnapshot.overgrowth, 100);
    campMeter.update(stateSnapshot.campPressure, 100);
    threatMeter.update(stateSnapshot.threatActive ? 100 : 0, 100);

    const activeFactions = getActiveFactions(stateSnapshot);
    factionList.innerHTML = '';
    if (activeFactions.length === 0) {
      factionList.append(
        createElement('div', 'hud-faction-empty', 'No active factions.')
      );
    } else {
      activeFactions.forEach((faction) => {
        const row = createElement('div', 'hud-faction-row');
        const icon = createElement('div', 'hud-faction-icon', faction.icon || '•');
        const name = createElement('div', 'hud-faction-name', faction.name);
        if (faction.color) {
          icon.style.color = faction.color;
          icon.style.borderColor = faction.color;
        }
        row.append(icon, name);
        factionList.appendChild(row);
      });
    }

    const snapshot = {
      tension: stateSnapshot.tension,
      overgrowth: stateSnapshot.overgrowth,
      camp: stateSnapshot.campPressure,
      threat: stateSnapshot.threatActive ? 100 : 0,
    };

    if (lastMeterSnapshot) {
      const changed =
        snapshot.tension !== lastMeterSnapshot.tension ||
        snapshot.overgrowth !== lastMeterSnapshot.overgrowth ||
        snapshot.camp !== lastMeterSnapshot.camp ||
        snapshot.threat !== lastMeterSnapshot.threat;
      if (changed) {
        lastMeterChangeAt = window.performance.now();
        if (!isPanelOpen('meters')) {
          setPanelDirty('meters', true);
        }
      }
    }
    lastMeterSnapshot = snapshot;
  };

  const updatePopulationPanel = (stateSnapshot) => {
    const housed = Math.max(0, stateSnapshot.housedPop || 0);
    const camped = Math.max(0, stateSnapshot.campPop || 0);
    const total = housed + camped;
    const capacity = Math.max(0, stateSnapshot.housingCapacity || 0);
    const available = Math.max(0, capacity - housed);
    const incoming = getIncomingTotal(stateSnapshot.incomingGroupsNextDay);

    populationRows.total.valueEl.textContent = `${total}`;
    populationRows.housed.valueEl.textContent = `${housed}`;
    populationRows.camped.valueEl.textContent = `${camped}`;
    populationRows.available.valueEl.textContent = `${available}`;
    populationRows.incoming.valueEl.textContent = `${incoming}`;

    housedBar.update(housed, total);
    campedBar.update(camped, total);

    const dominantFaction = getDominantCampFaction(stateSnapshot);
    if (camped > 0 && dominantFaction) {
      campDominanceNote.textContent = `Camps dominated by: ${dominantFaction.displayName}`;
      setVisible(campDominanceNote, true);
    } else if (camped > 0) {
      campDominanceNote.textContent = 'Camps are mixed.';
      setVisible(campDominanceNote, true);
    } else {
      campDominanceNote.textContent = '';
      setVisible(campDominanceNote, false);
    }

    const snapshot = {
      housed,
      camped,
      total,
      capacity,
      available,
      incoming,
      dominantFactionId: dominantFaction?.id || null,
    };

    if (lastPopulationSnapshot) {
      const changed = Object.keys(snapshot).some(
        (key) => snapshot[key] !== lastPopulationSnapshot[key]
      );
      if (changed) {
        lastPopulationChangeAt = window.performance.now();
        if (!isPanelOpen('population')) {
          setPanelDirty('population', true);
        }
      }
    }
    lastPopulationSnapshot = snapshot;
  };

  const updatePackPanel = (stateSnapshot) => {
    if (!Array.isArray(stateSnapshot.pack)) {
      return;
    }
    if (packCards.size !== stateSnapshot.pack.length) {
      initializePackCards(stateSnapshot);
      initializeFeedRows(stateSnapshot);
    }

    packSummary.textContent =
      stateSnapshot.phase === 'NIGHT'
        ? `Tonight: ${stateSnapshot.packStamina} Stamina | ${stateSnapshot.packPower} Power`
        : 'Tonight’s contributions:';

    stateSnapshot.pack.forEach((hyena) => {
      const card = packCards.get(hyena.id);
      if (!card) {
        return;
      }
      const hungerRatio = Math.max(0, Math.min(100, hyena.hunger)) / 100;
      card.hungerFill.style.width = `${Math.round(hungerRatio * 100)}%`;
      card.nameText.textContent = hyena.name;
      card.roleText.textContent = hyena.role;
      card.temperamentText.textContent = hyena.temperament;
      const contribution = getHyenaContribution(hyena);
      card.contributionText.textContent =
        `Tonight: +${contribution.stamina} STA / +${contribution.power} POW`;
    });

    const packSnapshot = stateSnapshot.pack.map((hyena) => ({
      id: hyena.id,
      hunger: hyena.hunger,
      role: hyena.role,
    }));

    if (lastPackSnapshot) {
      const changed = packSnapshot.some((member, index) => {
        const prev = lastPackSnapshot[index];
        if (!prev) {
          return true;
        }
        return member.hunger !== prev.hunger || member.role !== prev.role;
      });
      if (changed) {
        lastPackChangeAt = window.performance.now();
        if (!isPanelOpen('pack')) {
          setPanelDirty('pack', true);
        }
      }
    }
    lastPackSnapshot = packSnapshot;

    const foodSnapshot = {
      scraps: stateSnapshot.foodScraps,
      fatty: stateSnapshot.foodFatty,
    };
    if (lastPackFood) {
      if (
        foodSnapshot.scraps !== lastPackFood.scraps ||
        foodSnapshot.fatty !== lastPackFood.fatty
      ) {
        lastPackChangeAt = window.performance.now();
        if (!isPanelOpen('pack')) {
          setPanelDirty('pack', true);
        }
      }
    }
    lastPackFood = foodSnapshot;
  };

  const updateLog = (stateSnapshot) => {
    const entries = Array.isArray(stateSnapshot.eventLog)
      ? stateSnapshot.eventLog
      : [];
    if (entries.length < lastEventCount) {
      lastEventCount = 0;
    }

    const domUI = getDomUI();
    const hasAppend = Boolean(domUI?.appendLog);
    const newEntries = entries.slice(lastEventCount);

    if (newEntries.length === 0) {
      return;
    }

    const logEntries = newEntries.slice(-LOG_LINES);
    if (hasAppend) {
      logEntries.forEach((entry) => domUI.appendLog(entry));
    } else {
      logEntries.forEach((entry) => {
        const line = document.createElement('div');
        line.textContent = entry;
        consoleLog.appendChild(line);
      });
      consoleLog.scrollTop = consoleLog.scrollHeight;
    }

    lastEventCount = entries.length;
  };

  domHudInstance = {
    update: (stateSnapshot, context) => {
      updateTopStatus(stateSnapshot);
      updatePoiPanel(stateSnapshot, context);
      updateShrinePanel(stateSnapshot, context);
      updateMeters(stateSnapshot);
      updatePopulationPanel(stateSnapshot);
      updatePackPanel(stateSnapshot);
      updateLog(stateSnapshot);
      updateInteractionPrompt(context);

      setPanelStateText('actions', stateSnapshot.phase === 'DAY' ? 'DAY' : 'NIGHT');
      setPanelStateText(
        'pack',
        stateSnapshot.phase === 'DAY'
          ? `Scraps ${stateSnapshot.foodScraps}`
          : `Stamina ${stateSnapshot.packStamina}`
      );
      setPanelStateText(
        'feed',
        'Stable'
      );
      setPanelStateText('meters', stateSnapshot.threatActive ? 'Alert' : 'Stable');
      setPanelStateText(
        'population',
        stateSnapshot.campPop > 0 ? `Camped: ${stateSnapshot.campPop}` : 'Camp: None'
      );

      const now = window.performance.now();
      const metersActive =
        now - lastMeterChangeAt < 2000 ||
        stateSnapshot.tension >= 80 ||
        stateSnapshot.overgrowth >= 80 ||
        stateSnapshot.campPressure >= 70 ||
        stateSnapshot.threatActive;
      const packActive =
        now - lastPackChangeAt < 2000 ||
        stateSnapshot.pack.some((hyena) => hyena.hunger >= 70);
      setPanelActive('meters', metersActive);
      setPanelActive(
        'population',
        now - lastPopulationChangeAt < 2000 || stateSnapshot.campPop > 0
      );
      setPanelActive('pack', packActive);
      setPanelActive('feed', false);
    },
    toggleFeedPanel: () => {},
    hideFeedPanel: () => {},
    isFeedPanelVisible: () => false,
    setInteractionLocked: (locked) => {
      interactionLocked = locked;
    },
    playFeedAnimations: () => {},
    flashNightStats: () => {
      if (statusFlashTimer) {
        window.clearTimeout(statusFlashTimer);
      }
      statusText.classList.add('hud-status-flash');
      statusFlashTimer = window.setTimeout(() => {
        statusText.classList.remove('hud-status-flash');
      }, 600);
    },
  };

  return domHudInstance;
};

export const getDomHud = () => domHudInstance;
