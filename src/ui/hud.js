import { createButton, createPanel, createMeter } from './components.js';
import { getHyenaContribution, hasPackRole } from '../state/gameState.js';

const LOG_LINES = 5;

export const createHud = (scene, state, callbacks) => {
  const hud = scene.add.container(0, 0).setScrollFactor(0).setDepth(10);
  const width = scene.scale.width;
  const height = scene.scale.height;

  const topBar = scene.add.container(0, 0);
  const topBg = scene.add
    .rectangle(0, 0, width, 52, 0x0f172a, 0.92)
    .setOrigin(0, 0)
    .setStrokeStyle(0, 0x0f172a);
  const dayText = scene.add.text(24, 16, 'Day 1', {
    fontSize: '18px',
    color: '#f8fafc',
    fontStyle: 'bold',
  });
  const phaseBadge = scene.add
    .rectangle(150, 12, 92, 28, 0x1e293b, 0.95)
    .setOrigin(0, 0)
    .setStrokeStyle(1, 0x334155, 1);
  const phaseText = scene.add.text(196, 16, 'DAY', {
    fontSize: '14px',
    color: '#e2e8f0',
    fontStyle: 'bold',
  }).setOrigin(0.5, 0);
  const statusText = scene.add.text(width - 24, 18, '', {
    fontSize: '13px',
    color: '#94a3b8',
  }).setOrigin(1, 0);

  topBar.add([topBg, dayText, phaseBadge, phaseText, statusText]);

  const leftPanel = createPanel(scene, {
    x: 16,
    y: 70,
    width: 280,
    height: 420,
    title: 'Actions',
  });

  const rightPanel = createPanel(scene, {
    x: width - 296,
    y: 70,
    width: 280,
    height: 300,
    title: 'Meters',
  });

  const packPanel = createPanel(scene, {
    x: 316,
    y: 70,
    width: 360,
    height: 260,
    title: 'THE PACK',
  });

  const logPanel = createPanel(scene, {
    x: 16,
    y: height - 160,
    width: width - 32,
    height: 140,
    title: 'Event Log',
  });

  const logText = scene.add.text(20, 16, '', {
    fontSize: '13px',
    color: '#e2e8f0',
    lineSpacing: 6,
  });
  logPanel.body.add(logText);

  const dayButtons = {
    butcher: createButton(scene, {
      x: 20,
      y: 64,
      width: 240,
      label: 'Collect: Butcher',
      onClick: callbacks.onCollectButcher,
    }),
    tavern: createButton(scene, {
      x: 20,
      y: 108,
      width: 240,
      label: 'Collect: Tavern',
      onClick: callbacks.onCollectTavern,
    }),
    market: createButton(scene, {
      x: 20,
      y: 152,
      width: 240,
      label: 'Collect: Market',
      onClick: callbacks.onCollectMarket,
    }),
    feed: createButton(scene, {
      x: 20,
      y: 196,
      width: 240,
      label: 'Feed Hyenas',
      onClick: callbacks.onFeedPack,
    }),
    stabilize: createButton(scene, {
      x: 20,
      y: 240,
      width: 240,
      label: 'Stabilize Camp',
      onClick: callbacks.onStabilizeCamp,
    }),
    startNight: createButton(scene, {
      x: 20,
      y: 284,
      width: 240,
      label: 'End Day (Start Night)',
      onClick: callbacks.onStartNight,
    }),
  };

  const nightButtons = {
    clear: createButton(scene, {
      x: 20,
      y: 64,
      width: 240,
      label: 'Clear Overgrowth',
      onClick: callbacks.onClearOvergrowth,
    }),
    guard: createButton(scene, {
      x: 20,
      y: 108,
      width: 240,
      label: 'Guard Route',
      onClick: callbacks.onGuardRoute,
    }),
    suppress: createButton(scene, {
      x: 20,
      y: 152,
      width: 240,
      label: 'Suppress Threat',
      onClick: callbacks.onSuppressThreat,
    }),
    endNight: createButton(scene, {
      x: 20,
      y: 196,
      width: 240,
      label: 'End Night',
      onClick: callbacks.onEndNight,
    }),
  };

  leftPanel.body.add([
    ...Object.values(dayButtons),
    ...Object.values(nightButtons),
  ]);

  const feedPanel = createPanel(scene, {
    x: 316,
    y: 340,
    width: 360,
    height: 200,
    title: 'Feed Hyenas',
  });
  feedPanel.container.setVisible(false);

  const scrapsText = scene.add.text(16, 10, 'Scraps: 0', {
    fontSize: '13px',
    color: '#e2e8f0',
  });
  const fattyText = scene.add.text(180, 10, 'Fatty: 0', {
    fontSize: '13px',
    color: '#e2e8f0',
  });
  feedPanel.body.add([scrapsText, fattyText]);

  const panelState = { allocations: {} };

  // Pack panel shows the three hyenas plus tonight's contributions.
  const packSummaryText = scene.add.text(16, 6, '', {
    fontSize: '13px',
    color: '#cbd5f5',
  });
  packPanel.body.add(packSummaryText);

  const packCards = new Map();

  const createHyenaCard = (hyena, index) => {
    const y = 28 + index * 70;
    const card = scene.add.container(16, y);
    const bg = scene.add
      .rectangle(0, 0, 328, 64, 0x0f172a, 0.9)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x1f2937, 1);
    const nameText = scene.add.text(10, 6, hyena.name, {
      fontSize: '15px',
      color: '#f8fafc',
      fontStyle: 'bold',
    });
    const roleText = scene.add.text(328 - 10, 6, hyena.role, {
      fontSize: '13px',
      color: '#94a3b8',
    }).setOrigin(1, 0);
    const temperamentText = scene.add.text(10, 26, hyena.temperament, {
      fontSize: '12px',
      color: '#94a3b8',
    });
    const hungerLabel = scene.add.text(10, 44, 'Hunger', {
      fontSize: '11px',
      color: '#cbd5f5',
    });
    const hungerBg = scene.add
      .rectangle(58, 48, 120, 10, 0x111827, 0.9)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x1f2937, 1);
    const hungerFill = scene.add
      .rectangle(58, 48, 0, 10, 0xf59e0b, 0.95)
      .setOrigin(0, 0);
    const contributionText = scene.add.text(328 - 10, 42, '', {
      fontSize: '12px',
      color: '#e2e8f0',
    }).setOrigin(1, 0);

    card.add([
      bg,
      nameText,
      roleText,
      temperamentText,
      hungerLabel,
      hungerBg,
      hungerFill,
      contributionText,
    ]);
    packPanel.body.add(card);

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
    packCards.clear();
    if (!Array.isArray(stateSnapshot.pack)) {
      return;
    }
    stateSnapshot.pack.forEach((hyena, index) => {
      packCards.set(hyena.id, createHyenaCard(hyena, index));
      panelState.allocations[hyena.id] = { scraps: 0, fatty: 0 };
    });
  };

  initializePackCards(state);

  const makeAdjustButton = (x, y, label, onClick) =>
    createButton(scene, {
      x,
      y,
      width: 34,
      height: 24,
      label,
      onClick,
    });

  const feedRows = [];

  const createFeedRow = (hyena, index) => {
    const rowY = 36 + index * 46;
    const name = scene.add.text(16, rowY + 4, hyena.name, {
      fontSize: '13px',
      color: '#f8fafc',
    });
    const scrapsValue = scene.add.text(120, rowY + 4, 'Scraps: 0', {
      fontSize: '12px',
      color: '#cbd5f5',
    });
    const fattyValue = scene.add.text(120, rowY + 22, 'Fatty: 0', {
      fontSize: '12px',
      color: '#cbd5f5',
    });

    const scrapsMinus = makeAdjustButton(220, rowY, '-', () => {
      panelState.allocations[hyena.id].scraps = Math.max(
        0,
        panelState.allocations[hyena.id].scraps - 1
      );
    });
    const scrapsPlus = makeAdjustButton(258, rowY, '+', () => {
      panelState.allocations[hyena.id].scraps += 1;
    });
    const fattyMinus = makeAdjustButton(220, rowY + 20, '-', () => {
      panelState.allocations[hyena.id].fatty = Math.max(
        0,
        panelState.allocations[hyena.id].fatty - 1
      );
    });
    const fattyPlus = makeAdjustButton(258, rowY + 20, '+', () => {
      panelState.allocations[hyena.id].fatty += 1;
    });

    feedPanel.body.add([
      name,
      scrapsValue,
      fattyValue,
      scrapsMinus,
      scrapsPlus,
      fattyMinus,
      fattyPlus,
    ]);

    return {
      name,
      scrapsValue,
      fattyValue,
      scrapsMinus,
      scrapsPlus,
      fattyMinus,
      fattyPlus,
      hyenaId: hyena.id,
    };
  };

  const initializeFeedRows = (stateSnapshot) => {
    feedRows.length = 0;
    if (!Array.isArray(stateSnapshot.pack)) {
      return;
    }
    stateSnapshot.pack.forEach((hyena, index) => {
      feedRows.push(createFeedRow(hyena, index));
    });
  };

  initializeFeedRows(state);

  const confirmButton = createButton(scene, {
    x: 16,
    y: 172,
    width: 150,
    height: 24,
    label: 'Confirm Feeding',
    onClick: () => {
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
    },
  });
  const cancelButton = createButton(scene, {
    x: 186,
    y: 172,
    width: 150,
    height: 24,
    label: 'Cancel',
    onClick: () => {
      Object.values(panelState.allocations).forEach((alloc) => {
        alloc.scraps = 0;
        alloc.fatty = 0;
      });
      feedPanel.container.setVisible(false);
    },
  });

  feedPanel.body.add([confirmButton, cancelButton]);

  const meterSpacing = 64;
  const tensionMeter = createMeter(scene, {
    x: 20,
    y: 64,
    width: 240,
    label: 'Tension',
    color: 0xf97316,
  });
  const overgrowthMeter = createMeter(scene, {
    x: 20,
    y: 64 + meterSpacing,
    width: 240,
    label: 'Overgrowth',
    color: 0x4ade80,
  });
  const campMeter = createMeter(scene, {
    x: 20,
    y: 64 + meterSpacing * 2,
    width: 240,
    label: 'Camp Pressure',
    color: 0x38bdf8,
  });
  const threatMeter = createMeter(scene, {
    x: 20,
    y: 64 + meterSpacing * 3,
    width: 240,
    label: 'Threat',
    color: 0xf87171,
  });

  rightPanel.body.add([
    tensionMeter.container,
    overgrowthMeter.container,
    campMeter.container,
    threatMeter.container,
  ]);

  hud.add([
    topBar,
    leftPanel.container,
    packPanel.container,
    rightPanel.container,
    logPanel.container,
    feedPanel.container,
  ]);

  let interactionLocked = false;

  const updateFeedPanel = (stateSnapshot) => {
    const maxScraps = stateSnapshot.foodScraps;
    const maxFatty = stateSnapshot.foodFatty;
    const canInteract = !interactionLocked;
    const allocations = Object.values(panelState.allocations);
    const sumAllocated = (key) => allocations.reduce((sum, alloc) => sum + (alloc[key] || 0), 0);
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

    scrapsText.setText(`Scraps: ${allocatedScraps} / ${maxScraps}`);
    fattyText.setText(`Fatty: ${allocatedFatty} / ${maxFatty}`);

    feedRows.forEach((row) => {
      const alloc = panelState.allocations[row.hyenaId];
      if (!alloc) {
        return;
      }
      row.scrapsValue.setText(`Scraps: ${alloc.scraps}`);
      row.fattyValue.setText(`Fatty: ${alloc.fatty}`);
      row.scrapsMinus.setEnabled(canInteract && alloc.scraps > 0);
      row.scrapsPlus.setEnabled(canInteract && allocatedScraps < maxScraps);
      row.fattyMinus.setEnabled(canInteract && alloc.fatty > 0);
      row.fattyPlus.setEnabled(canInteract && allocatedFatty < maxFatty);
    });

    confirmButton.setEnabled(
      canInteract &&
        (allocatedScraps > 0 || allocatedFatty > 0) &&
        stateSnapshot.dayActionsRemaining > 0
    );
    cancelButton.setEnabled(canInteract);
  };

  const updateTopBar = (stateSnapshot) => {
    dayText.setText(`Day ${stateSnapshot.dayNumber}`);
    phaseText.setText(stateSnapshot.phase);
    const phaseColor = stateSnapshot.phase === 'DAY' ? 0x38bdf8 : 0xf97316;
    phaseBadge.setFillStyle(phaseColor, 0.25);
    phaseBadge.setStrokeStyle(1, phaseColor, 1);
    statusText.setText(
      stateSnapshot.phase === 'DAY'
        ? `Actions Remaining: ${stateSnapshot.dayActionsRemaining}`
        : `Pack Stamina: ${stateSnapshot.packStamina} | Power: ${stateSnapshot.packPower}`
    );
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
    packSummaryText.setText(
      stateSnapshot.phase === 'NIGHT'
        ? `Tonight: ${stateSnapshot.packStamina} Stamina | ${stateSnapshot.packPower} Power`
        : 'Tonight’s contributions:'
    );

    stateSnapshot.pack.forEach((hyena) => {
      const card = packCards.get(hyena.id);
      if (!card) {
        return;
      }
      const hungerRatio = Math.max(0, Math.min(100, hyena.hunger)) / 100;
      card.hungerFill.setSize(120 * hungerRatio, 10);
      card.nameText.setText(hyena.name);
      card.roleText.setText(hyena.role);
      card.temperamentText.setText(hyena.temperament);
      const contribution = getHyenaContribution(hyena);
      card.contributionText.setText(
        `Tonight: +${contribution.stamina} STA / +${contribution.power} POW`
      );
    });
  };

  const updateLog = (stateSnapshot) => {
    const entries = stateSnapshot.eventLog || [];
    const latest = entries.slice(-LOG_LINES).map((entry) => `• ${entry}`);
    logText.setText(latest.length > 0 ? latest.join('\n') : 'No recent events.');
  };

  return {
    update: (stateSnapshot, context) => {
      updateTopBar(stateSnapshot);
      updateButtons(stateSnapshot, context);
      updateMeters(stateSnapshot);
      updatePackPanel(stateSnapshot);
      updateLog(stateSnapshot);
    },
    toggleFeedPanel: (show) => {
      feedPanel.container.setVisible(show);
    },
    hideFeedPanel: () => {
      feedPanel.container.setVisible(false);
    },
    isFeedPanelVisible: () => feedPanel.container.visible,
    setInteractionLocked: (locked) => {
      interactionLocked = locked;
    },
    playFeedAnimations: (feedPlan) => {
      if (!Array.isArray(feedPlan) || feedPlan.length === 0) {
        return;
      }
      // Simple tweened token to sell the feeding action.
      const feedOrigin = feedPanel.container.getBounds();
      feedPlan.forEach((entry) => {
        const total = (entry.scraps || 0) + (entry.fatty || 0);
        if (total <= 0) {
          return;
        }
        const card = packCards.get(entry.id);
        if (!card) {
          return;
        }
        const target = card.card.getBounds();
        const token = scene.add
          .circle(feedOrigin.centerX, feedOrigin.centerY, 6, 0xfacc15, 0.9)
          .setScrollFactor(0)
          .setDepth(20);
        scene.tweens.add({
          targets: token,
          x: target.centerX,
          y: target.centerY,
          scale: 0.2,
          alpha: 0,
          duration: 450,
          ease: 'Cubic.easeIn',
          onComplete: () => token.destroy(),
        });
      });
    },
    flashNightStats: () => {
      if (statusText.alpha <= 0) {
        return;
      }
      statusText.setTint(0xfacc15);
      scene.tweens.add({
        targets: statusText,
        scale: 1.08,
        duration: 120,
        yoyo: true,
        repeat: 2,
        ease: 'Sine.easeInOut',
        onComplete: () => statusText.clearTint(),
      });
    },
  };
};
