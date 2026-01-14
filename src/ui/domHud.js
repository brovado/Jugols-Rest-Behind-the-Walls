import { getHyenaContribution, hasPackRole } from '../state/gameState.js';
import { getDomUI } from './domUI.js';

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
  const button = createElement('button', 'hud-button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', () => {
    if (!button.disabled) {
      onClick?.();
    }
  });

  return {
    el: button,
    setEnabled: (enabled) => {
      button.disabled = !enabled;
    },
    setVisible: (visible) => setVisible(button, visible),
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

export const initDomHud = (state, callbacks) => {
  if (domHudInstance) {
    return domHudInstance;
  }

  const actionsPanel = document.getElementById('actions-panel');
  const packPanel = document.getElementById('pack-panel');
  const metersPanel = document.getElementById('meters-panel');
  const consoleLog = document.getElementById('console-log');

  if (!actionsPanel || !packPanel || !metersPanel || !consoleLog) {
    return null;
  }

  actionsPanel.innerHTML = '';
  packPanel.innerHTML = '';
  metersPanel.innerHTML = '';

  const hudStatus = createElement('div', 'hud-status');
  const hudStatusRow = createElement('div', 'hud-status-row');
  const dayText = createElement('div', null, 'Day 1');
  const phaseBadge = createElement('div', 'hud-phase-badge hud-phase-day', 'DAY');
  hudStatusRow.append(dayText, phaseBadge);

  const statusText = createElement('div', 'status-value', '');
  hudStatus.append(hudStatusRow, statusText);

  const actionGroup = createElement('div', 'hud-action-group');
  const dayButtons = {
    butcher: createHudButton('Collect: Butcher', callbacks.onCollectButcher),
    tavern: createHudButton('Collect: Tavern', callbacks.onCollectTavern),
    market: createHudButton('Collect: Market', callbacks.onCollectMarket),
    feed: createHudButton('Feed Hyenas', callbacks.onFeedPack),
    stabilize: createHudButton('Stabilize Camp', callbacks.onStabilizeCamp),
    startNight: createHudButton('End Day (Start Night)', callbacks.onStartNight),
  };

  const nightButtons = {
    clear: createHudButton('Clear Overgrowth', callbacks.onClearOvergrowth),
    guard: createHudButton('Guard Route', callbacks.onGuardRoute),
    suppress: createHudButton('Suppress Threat', callbacks.onSuppressThreat),
    endNight: createHudButton('End Night', callbacks.onEndNight),
  };

  Object.values(dayButtons).forEach((button) => actionGroup.appendChild(button.el));
  Object.values(nightButtons).forEach((button) => actionGroup.appendChild(button.el));

  actionsPanel.append(hudStatus, actionGroup);

  const packSummary = createElement('div', null, 'Tonight’s contributions:');
  const packCardsContainer = createElement('div', 'hud-action-group');

  const panelState = { allocations: {} };
  const feedPanel = createElement('div', 'feed-panel hidden');
  const feedHeader = createElement('div', 'feed-header');
  const scrapsText = createElement('div', null, 'Scraps: 0');
  const fattyText = createElement('div', null, 'Fatty: 0');
  feedHeader.append(scrapsText, fattyText);

  const feedRowsContainer = createElement('div');
  const feedActions = createElement('div', 'feed-actions');

  const confirmButton = createHudButton('Confirm Feeding', () => {
    const feedPlan = Object.entries(panelState.allocations).map(([id, alloc]) => ({
      id,
      scraps: alloc.scraps,
      fatty: alloc.fatty,
    }));
    callbacks.onConfirmFeed(feedPlan);
    Object.values(panelState.allocations).forEach((alloc) => {
      alloc.scraps = 0;
      alloc.fatty = 0;
    });
  });

  const cancelButton = createHudButton('Cancel', () => {
    Object.values(panelState.allocations).forEach((alloc) => {
      alloc.scraps = 0;
      alloc.fatty = 0;
    });
    feedPanel.classList.add('hidden');
  });

  feedActions.append(confirmButton.el, cancelButton.el);
  feedPanel.append(feedHeader, feedRowsContainer, feedActions);

  packPanel.append(packSummary, packCardsContainer, feedPanel);
  const packCards = new Map();
  const feedRows = [];

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

  const createFeedRow = (hyena) => {
    const row = createElement('div', 'feed-row');
    const name = createElement('div', null, hyena.name);

    const scrapsValue = createElement('div', 'feed-alloc', 'Scraps: 0');
    const fattyValue = createElement('div', 'feed-alloc', 'Fatty: 0');

    const scrapsControls = createElement('div', 'feed-controls');
    const scrapsLabel = createElement('div', 'feed-alloc', 'Scraps');
    const scrapsMinus = createElement('button', 'feed-adjust', '-');
    const scrapsPlus = createElement('button', 'feed-adjust', '+');
    scrapsControls.append(scrapsLabel, scrapsMinus, scrapsPlus);

    const fattyControls = createElement('div', 'feed-controls');
    const fattyLabel = createElement('div', 'feed-alloc', 'Fatty');
    const fattyMinus = createElement('button', 'feed-adjust', '-');
    const fattyPlus = createElement('button', 'feed-adjust', '+');
    fattyControls.append(fattyLabel, fattyMinus, fattyPlus);

    row.append(name, scrapsValue, scrapsControls, fattyValue, fattyControls);
    feedRowsContainer.appendChild(row);

    scrapsMinus.addEventListener('click', () => {
      panelState.allocations[hyena.id].scraps = Math.max(
        0,
        panelState.allocations[hyena.id].scraps - 1
      );
    });
    scrapsPlus.addEventListener('click', () => {
      panelState.allocations[hyena.id].scraps += 1;
    });
    fattyMinus.addEventListener('click', () => {
      panelState.allocations[hyena.id].fatty = Math.max(
        0,
        panelState.allocations[hyena.id].fatty - 1
      );
    });
    fattyPlus.addEventListener('click', () => {
      panelState.allocations[hyena.id].fatty += 1;
    });

    return {
      scrapsValue,
      fattyValue,
      scrapsMinus,
      scrapsPlus,
      fattyMinus,
      fattyPlus,
      hyenaId: hyena.id,
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
      panelState.allocations[hyena.id] = { scraps: 0, fatty: 0 };
    });
  };

  const initializeFeedRows = (stateSnapshot) => {
    feedRowsContainer.innerHTML = '';
    feedRows.length = 0;
    if (!Array.isArray(stateSnapshot.pack)) {
      return;
    }
    stateSnapshot.pack.forEach((hyena) => {
      feedRows.push(createFeedRow(hyena));
    });
  };

  initializePackCards(state);
  initializeFeedRows(state);

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

  let interactionLocked = false;
  let lastEventCount = 0;
  let statusFlashTimer = null;

  const updateFeedPanel = (stateSnapshot) => {
    const maxScraps = stateSnapshot.foodScraps;
    const maxFatty = stateSnapshot.foodFatty;
    const canInteract = !interactionLocked;
    const allocations = Object.values(panelState.allocations);
    const sumAllocated = (key) =>
      allocations.reduce((sum, alloc) => sum + (alloc[key] || 0), 0);
    const trimAllocations = (key, max) => {
      let total = sumAllocated(key);
      if (total <= max) {
        return;
      }
      let excess = total - max;
      allocations.forEach((alloc) => {
        if (excess <= 0) {
          return;
        }
        const reduction = Math.min(excess, alloc[key]);
        alloc[key] -= reduction;
        excess -= reduction;
      });
    };

    trimAllocations('scraps', maxScraps);
    trimAllocations('fatty', maxFatty);

    const allocatedScraps = sumAllocated('scraps');
    const allocatedFatty = sumAllocated('fatty');

    scrapsText.textContent = `Scraps: ${allocatedScraps} / ${maxScraps}`;
    fattyText.textContent = `Fatty: ${allocatedFatty} / ${maxFatty}`;

    feedRows.forEach((row) => {
      const alloc = panelState.allocations[row.hyenaId];
      if (!alloc) {
        return;
      }
      row.scrapsValue.textContent = `Scraps: ${alloc.scraps}`;
      row.fattyValue.textContent = `Fatty: ${alloc.fatty}`;
      row.scrapsMinus.disabled = !(canInteract && alloc.scraps > 0);
      row.scrapsPlus.disabled = !(canInteract && allocatedScraps < maxScraps);
      row.fattyMinus.disabled = !(canInteract && alloc.fatty > 0);
      row.fattyPlus.disabled = !(canInteract && allocatedFatty < maxFatty);
    });

    confirmButton.setEnabled(
      canInteract &&
        (allocatedScraps > 0 || allocatedFatty > 0) &&
        stateSnapshot.dayActionsRemaining > 0
    );
    cancelButton.setEnabled(canInteract);
  };

  const updateTopStatus = (stateSnapshot) => {
    dayText.textContent = `Day ${stateSnapshot.dayNumber}`;
    phaseBadge.textContent = stateSnapshot.phase;
    phaseBadge.classList.toggle('hud-phase-day', stateSnapshot.phase === 'DAY');
    phaseBadge.classList.toggle('hud-phase-night', stateSnapshot.phase === 'NIGHT');
    statusText.textContent =
      stateSnapshot.phase === 'DAY'
        ? `Actions Remaining: ${stateSnapshot.dayActionsRemaining}`
        : `Pack Stamina: ${stateSnapshot.packStamina} | Power: ${stateSnapshot.packPower}`;
  };

  const updateButtons = (stateSnapshot, context) => {
    const isDay = stateSnapshot.phase === 'DAY';
    const isNight = stateSnapshot.phase === 'NIGHT';

    Object.values(dayButtons).forEach((button) => button.setVisible(isDay));
    Object.values(nightButtons).forEach((button) => button.setVisible(isNight));

    if (isDay) {
      dayButtons.butcher.setEnabled(
        !interactionLocked &&
          stateSnapshot.dayActionsRemaining > 0 &&
          context.nearButcher &&
          !stateSnapshot.locationCollected.butcher
      );
      dayButtons.tavern.setEnabled(
        !interactionLocked &&
          stateSnapshot.dayActionsRemaining > 0 &&
          context.nearTavern &&
          !stateSnapshot.locationCollected.tavern
      );
      dayButtons.market.setEnabled(
        !interactionLocked &&
          stateSnapshot.dayActionsRemaining > 0 &&
          context.nearMarket &&
          !stateSnapshot.locationCollected.market
      );
      dayButtons.feed.setEnabled(
        !interactionLocked && stateSnapshot.dayActionsRemaining > 0
      );
      dayButtons.stabilize.setEnabled(
        !interactionLocked &&
          stateSnapshot.dayActionsRemaining > 0 &&
          stateSnapshot.campActive &&
          stateSnapshot.foodScraps >= 2
      );
      dayButtons.startNight.setEnabled(!interactionLocked);
    }

    if (isNight) {
      const guardCost = Math.max(1, hasPackRole(stateSnapshot.pack, 'Scout') ? 1 : 2);
      const powerRequirement = hasPackRole(stateSnapshot.pack, 'Bruiser') ? 1 : 2;
      nightButtons.clear.setEnabled(
        !interactionLocked &&
          context.inOvergrowthZone &&
          stateSnapshot.packStamina >= 2
      );
      nightButtons.guard.setEnabled(
        !interactionLocked &&
          context.inRouteZone &&
          stateSnapshot.packStamina >= guardCost
      );
      nightButtons.suppress.setEnabled(
        !interactionLocked &&
          context.inThreatZone &&
          stateSnapshot.threatActive &&
          stateSnapshot.packStamina >= 3 &&
          stateSnapshot.packPower >= powerRequirement
      );
      nightButtons.endNight.setEnabled(!interactionLocked);
    }

    updateFeedPanel(stateSnapshot);
  };

  const updateMeters = (stateSnapshot) => {
    tensionMeter.update(stateSnapshot.tension, 100);
    overgrowthMeter.update(stateSnapshot.overgrowth, 100);
    campMeter.update(stateSnapshot.campActive ? stateSnapshot.campPressure : 0, 100);
    threatMeter.update(stateSnapshot.threatActive ? 100 : 0, 100);
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
      updateButtons(stateSnapshot, context);
      updateMeters(stateSnapshot);
      updatePackPanel(stateSnapshot);
      updateLog(stateSnapshot);
    },
    toggleFeedPanel: (show) => {
      feedPanel.classList.toggle('hidden', !show);
    },
    hideFeedPanel: () => {
      feedPanel.classList.add('hidden');
    },
    isFeedPanelVisible: () => !feedPanel.classList.contains('hidden'),
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
