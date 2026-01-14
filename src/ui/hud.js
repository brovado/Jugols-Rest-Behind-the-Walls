const createButton = (scene, x, y, label, onClick) => {
  const container = scene.add.container(x, y);
  const background = scene.add
    .rectangle(0, 0, 180, 32, 0x1e293b, 0.9)
    .setOrigin(0, 0.5)
    .setStrokeStyle(1, 0x64748b);
  const text = scene.add
    .text(10, 0, label, { fontSize: '14px', color: '#e2e8f0' })
    .setOrigin(0, 0.5);

  container.add([background, text]);
  container.setSize(180, 32);
  container.setInteractive(new Phaser.Geom.Rectangle(0, -16, 180, 32), Phaser.Geom.Rectangle.Contains);
  container.on('pointerdown', () => {
    if (container.input && container.input.enabled) {
      onClick();
    }
  });

  container.setEnabled = (enabled) => {
    container.input.enabled = enabled;
    background.setFillStyle(0x1e293b, enabled ? 0.9 : 0.4);
    text.setColor(enabled ? '#e2e8f0' : '#64748b');
  };

  container.setLabel = (nextLabel) => {
    text.setText(nextLabel);
  };

  return container;
};

export const createHud = (scene, state, callbacks) => {
  const hud = scene.add.container(16, 16).setScrollFactor(0);

  const infoText = scene.add.text(0, 0, '', {
    fontSize: '14px',
    color: '#f8fafc',
    lineSpacing: 6,
  });

  const dayButtons = {
    butcher: createButton(scene, 0, 190, 'Collect: Butcher', callbacks.onCollectButcher),
    tavern: createButton(scene, 0, 230, 'Collect: Tavern', callbacks.onCollectTavern),
    market: createButton(scene, 0, 270, 'Collect: Market', callbacks.onCollectMarket),
    feed: createButton(scene, 0, 310, 'Feed Pack', callbacks.onFeedPack),
    stabilize: createButton(scene, 0, 350, 'Stabilize Camp', callbacks.onStabilizeCamp),
    startNight: createButton(scene, 0, 390, 'Start Night', callbacks.onStartNight),
  };

  const nightButtons = {
    clear: createButton(scene, 0, 190, 'Clear Overgrowth', callbacks.onClearOvergrowth),
    guard: createButton(scene, 0, 230, 'Guard Route', callbacks.onGuardRoute),
    suppress: createButton(scene, 0, 270, 'Suppress Threat', callbacks.onSuppressThreat),
    endNight: createButton(scene, 0, 310, 'End Night', callbacks.onEndNight),
  };

  const feedPanel = scene.add.container(210, 190).setVisible(false);
  const panelBg = scene.add
    .rectangle(0, 0, 200, 210, 0x0f172a, 0.9)
    .setOrigin(0, 0)
    .setStrokeStyle(1, 0x38bdf8);
  const panelTitle = scene.add.text(12, 12, 'Feed Pack', {
    fontSize: '14px',
    color: '#e2e8f0',
  });
  const scrapsText = scene.add.text(12, 48, 'Scraps: 0', {
    fontSize: '14px',
    color: '#e2e8f0',
  });
  const fattyText = scene.add.text(12, 78, 'Fatty: 0', {
    fontSize: '14px',
    color: '#e2e8f0',
  });

  const panelState = { scraps: 0, fatty: 0 };

  const makeAdjustButton = (x, y, label, onClick) => {
    const btn = createButton(scene, x, y, label, onClick);
    btn.setScale(0.8);
    return btn;
  };

  const scrapsMinus = makeAdjustButton(12, 110, '- Scraps', () => {
    panelState.scraps = Math.max(0, panelState.scraps - 1);
  });
  const scrapsPlus = makeAdjustButton(100, 110, '+ Scraps', () => {
    panelState.scraps += 1;
  });
  const fattyMinus = makeAdjustButton(12, 140, '- Fatty', () => {
    panelState.fatty = Math.max(0, panelState.fatty - 1);
  });
  const fattyPlus = makeAdjustButton(100, 140, '+ Fatty', () => {
    panelState.fatty += 1;
  });

  const confirmButton = makeAdjustButton(12, 172, 'Confirm', () => {
    callbacks.onConfirmFeed(panelState.scraps, panelState.fatty);
    panelState.scraps = 0;
    panelState.fatty = 0;
  });
  const cancelButton = makeAdjustButton(100, 172, 'Cancel', () => {
    panelState.scraps = 0;
    panelState.fatty = 0;
    feedPanel.setVisible(false);
  });

  feedPanel.add([
    panelBg,
    panelTitle,
    scrapsText,
    fattyText,
    scrapsMinus,
    scrapsPlus,
    fattyMinus,
    fattyPlus,
    confirmButton,
    cancelButton,
  ]);

  hud.add([
    infoText,
    ...Object.values(dayButtons),
    ...Object.values(nightButtons),
    feedPanel,
  ]);

  const updateFeedPanel = (stateSnapshot) => {
    const maxScraps = stateSnapshot.foodScraps;
    const maxFatty = stateSnapshot.foodFatty;
    panelState.scraps = Math.min(panelState.scraps, maxScraps);
    panelState.fatty = Math.min(panelState.fatty, maxFatty);
    scrapsText.setText(`Scraps: ${panelState.scraps} / ${maxScraps}`);
    fattyText.setText(`Fatty: ${panelState.fatty} / ${maxFatty}`);
  };

  const updateInfoText = (stateSnapshot) => {
    const lines = [
      `Day ${stateSnapshot.dayNumber} — ${stateSnapshot.phase}`,
      stateSnapshot.phase === 'DAY'
        ? `Day Actions: ${stateSnapshot.dayActionsRemaining}`
        : `Night Stamina: ${stateSnapshot.hyenaStamina}`,
      `Food: ${stateSnapshot.foodScraps} Scraps | ${stateSnapshot.foodFatty} Fatty`,
      `Fed: ${stateSnapshot.packFedScraps} Scraps | ${stateSnapshot.packFedFatty} Fatty`,
      `Hyena Power: ${stateSnapshot.hyenaPower}`,
      `Tension: ${stateSnapshot.tension} | Overgrowth: ${stateSnapshot.overgrowth}`,
      `Threat: ${stateSnapshot.threatActive ? 'Active' : 'Dormant'}`,
      `Camp: ${stateSnapshot.campActive ? `Active (${stateSnapshot.campPressure})` : 'None'}`,
      `Stable Days: ${stateSnapshot.consecutiveStableDays} | Collapse Days: ${stateSnapshot.collapseDays}`,
    ];
    infoText.setText(lines.join('\n'));
  };

  const updateButtons = (stateSnapshot, context) => {
    const isDay = stateSnapshot.phase === 'DAY';
    const isNight = stateSnapshot.phase === 'NIGHT';

    Object.values(dayButtons).forEach((button) => button.setVisible(isDay));
    Object.values(nightButtons).forEach((button) => button.setVisible(isNight));

    if (isDay) {
      dayButtons.butcher.setEnabled(
        stateSnapshot.dayActionsRemaining > 0 && context.nearButcher && !stateSnapshot.locationCollected.butcher
      );
      dayButtons.tavern.setEnabled(
        stateSnapshot.dayActionsRemaining > 0 && context.nearTavern && !stateSnapshot.locationCollected.tavern
      );
      dayButtons.market.setEnabled(
        stateSnapshot.dayActionsRemaining > 0 && context.nearMarket && !stateSnapshot.locationCollected.market
      );
      dayButtons.feed.setEnabled(stateSnapshot.dayActionsRemaining > 0);
      dayButtons.stabilize.setEnabled(
        stateSnapshot.dayActionsRemaining > 0 && stateSnapshot.campActive && stateSnapshot.foodScraps >= 2
      );
      dayButtons.startNight.setEnabled(true);
    }

    if (isNight) {
      nightButtons.clear.setEnabled(context.inOvergrowthZone && stateSnapshot.hyenaStamina >= 2);
      nightButtons.guard.setEnabled(context.inRouteZone && stateSnapshot.hyenaStamina >= 2);
      nightButtons.suppress.setEnabled(
        context.inThreatZone && stateSnapshot.threatActive && stateSnapshot.hyenaStamina >= 3 && stateSnapshot.hyenaPower >= 2
      );
      nightButtons.endNight.setEnabled(true);
    }

    updateFeedPanel(stateSnapshot);
  };

  return {
    update: (stateSnapshot, context) => {
      updateInfoText(stateSnapshot);
      updateButtons(stateSnapshot, context);
    },
    toggleFeedPanel: (show) => {
      feedPanel.setVisible(show);
    },
    hideFeedPanel: () => {
      feedPanel.setVisible(false);
    },
    isFeedPanelVisible: () => feedPanel.visible,
  };
};
