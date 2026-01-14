import { createButton, createPanel, createMeter } from './components.js';

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
      label: 'Feed Pack',
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
    y: 120,
    width: 220,
    height: 220,
    title: 'Feed Pack',
  });
  feedPanel.container.setVisible(false);

  const scrapsText = scene.add.text(16, 56, 'Scraps: 0', {
    fontSize: '13px',
    color: '#e2e8f0',
  });
  const fattyText = scene.add.text(16, 82, 'Fatty: 0', {
    fontSize: '13px',
    color: '#e2e8f0',
  });
  feedPanel.body.add([scrapsText, fattyText]);

  const panelState = { scraps: 0, fatty: 0 };

  const makeAdjustButton = (x, y, label, onClick) => {
    const btn = createButton(scene, {
      x,
      y,
      width: 90,
      height: 30,
      label,
      onClick,
    });
    return btn;
  };

  const scrapsMinus = makeAdjustButton(16, 112, '- Scraps', () => {
    panelState.scraps = Math.max(0, panelState.scraps - 1);
  });
  const scrapsPlus = makeAdjustButton(112, 112, '+ Scraps', () => {
    panelState.scraps += 1;
  });
  const fattyMinus = makeAdjustButton(16, 146, '- Fatty', () => {
    panelState.fatty = Math.max(0, panelState.fatty - 1);
  });
  const fattyPlus = makeAdjustButton(112, 146, '+ Fatty', () => {
    panelState.fatty += 1;
  });

  const confirmButton = makeAdjustButton(16, 180, 'Confirm', () => {
    callbacks.onConfirmFeed(panelState.scraps, panelState.fatty);
    panelState.scraps = 0;
    panelState.fatty = 0;
  });
  const cancelButton = makeAdjustButton(112, 180, 'Cancel', () => {
    panelState.scraps = 0;
    panelState.fatty = 0;
    feedPanel.container.setVisible(false);
  });

  feedPanel.body.add([
    scrapsMinus,
    scrapsPlus,
    fattyMinus,
    fattyPlus,
    confirmButton,
    cancelButton,
  ]);

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
    rightPanel.container,
    logPanel.container,
    feedPanel.container,
  ]);

  let interactionLocked = false;

  const updateFeedPanel = (stateSnapshot) => {
    const maxScraps = stateSnapshot.foodScraps;
    const maxFatty = stateSnapshot.foodFatty;
    panelState.scraps = Math.min(panelState.scraps, maxScraps);
    panelState.fatty = Math.min(panelState.fatty, maxFatty);
    scrapsText.setText(`Scraps: ${panelState.scraps} / ${maxScraps}`);
    fattyText.setText(`Fatty: ${panelState.fatty} / ${maxFatty}`);
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
        : `Night Stamina: ${stateSnapshot.hyenaStamina} | Power: ${stateSnapshot.hyenaPower}`
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
      dayButtons.feed.setEnabled(!interactionLocked && stateSnapshot.dayActionsRemaining > 0);
      dayButtons.stabilize.setEnabled(
        !interactionLocked &&
          stateSnapshot.dayActionsRemaining > 0 &&
          stateSnapshot.campActive &&
          stateSnapshot.foodScraps >= 2
      );
      dayButtons.startNight.setEnabled(!interactionLocked);
    }

    if (isNight) {
      nightButtons.clear.setEnabled(
        !interactionLocked &&
          context.inOvergrowthZone &&
          stateSnapshot.hyenaStamina >= 2
      );
      nightButtons.guard.setEnabled(
        !interactionLocked &&
          context.inRouteZone &&
          stateSnapshot.hyenaStamina >= 2
      );
      nightButtons.suppress.setEnabled(
        !interactionLocked &&
          context.inThreatZone &&
          stateSnapshot.threatActive &&
          stateSnapshot.hyenaStamina >= 3 &&
          stateSnapshot.hyenaPower >= 2
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
  };
};
