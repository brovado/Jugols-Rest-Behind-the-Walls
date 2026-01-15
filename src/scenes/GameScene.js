import {
  createInitialState,
  startDay,
  startNight,
  endNight,
  collectLocation,
  feedHyenas,
  stabilizeCamp,
  clampMeter,
  spawnPoisForDay,
  spawnPoisForNight,
  resolvePoi,
  addEvent,
  addNarrativeEvent,
  getDominantCampFaction,
  saveGameState,
  loadGameState,
} from '../state/gameState.js';
import { applyFactionInfluence } from '../state/factionSystem.js';
import { getDomUI } from '../ui/domUI.js';
import { initDomHud } from '../ui/domHud.js';
import { setPanelActive } from '../ui/panelDock.js';
import { moveToward } from '../utils/pathing.js';
import { getAmbientLine } from '../world/ambient.js';
import {
  applyBlessingHousingReward,
  createBlessingEntry,
  formatBlessingEffect,
  getBlessingActionCostModifier,
} from '../world/blessings.js';
import { getDistrictConfig } from '../world/districts.js';
import { GOD_BY_ID } from '../world/gods.js';
import {
  applyNarrativeEventEffects,
  getNarrativeEvent,
  getNarrativeSourceLabel,
} from '../world/events.js';

const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 1200;
const PLAYER_SPEED = 220;
const CLICK_RADIUS = 10;
const INTERACT_RADIUS = 80;

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.state = null;
    this.player = null;
    this.targetMarker = null;
    this.targetPoint = null;
    this.domHud = null;
    this.phaseOverlay = null;
    this.phaseBanner = null;
    this.victoryOverlay = null;
    this.gameOverOverlay = null;
    this.narrativeOverlay = null;
    this.narrativeText = null;
    this.inputLocked = false;
    this.domUI = null;
    this.autoMoveEnabled = true;
    this.lastPosition = null;
    this.poiMarkers = new Map();
    this.poiLayer = null;
    this.poiPulseTweens = new Map();
    this.backgroundLayer = null;
    this.gatewayLayer = null;
    this.gatewayZones = [];
    this.currentDistrict = null;
    this.isTransitioning = false;
  }

  create(data = {}) {
    if (data.loadSave) {
      this.state = loadGameState();
    }
    if (!this.state) {
      this.state = createInitialState();
      startDay(this.state, { advanceDay: false });
    } else if (data.loadSave) {
      addEvent(this.state, 'The watch resumes from the last report.');
    }
    this.currentDistrict = getDistrictConfig(this.state.currentDistrictId);
    this.state.currentDistrictId = this.currentDistrict.id;
    if (!this.state.eventLog?.length) {
      addEvent(this.state, `Day 1 begins in the ${this.currentDistrict.displayName}.`);
    }
    if (this.state.phase === 'NIGHT' && this.getDistrictPois().length === 0) {
      spawnPoisForNight(this.state, this.currentDistrict);
    }

    this.setupWorld();
    this.setupPlayer();
    this.setupMarkers();
    this.setupInput();
    this.setupDomUI();
    this.setupDomHud();
    this.setupOverlays();
    this.setupPois();

    this.handleNarrativePhaseStart();
    this.updateHud();
    this.cameras.main.fadeIn(500, 0, 0, 0);

    this.inputLocked = false;
    if (this.domHud) {
      this.domHud.setInteractionLocked(false);
    }
  }

  setupWorld() {
    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.updateDistrictBackground(this.currentDistrict);
    this.createLocations(this.currentDistrict?.dayLocations);
  }

  setupPlayer() {
    if (this.textures.exists('player')) {
      this.player = this.physics.add.sprite(400, 500, 'player');
      this.player.setScale(0.5);
    } else {
      this.player = this.physics.add
        .sprite(400, 500, null)
        .setDisplaySize(32, 32);
      this.player.setTint(0xfbbf24);
    }
    this.player.setCollideWorldBounds(true);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    this.cursors = this.input.keyboard.addKeys({
      up: 'W',
      down: 'S',
      left: 'A',
      right: 'D',
    });

    this.setupGateways(this.currentDistrict?.gateways);
  }

  setupMarkers() {
    this.targetMarker = this.add
      .circle(0, 0, CLICK_RADIUS, 0x38bdf8, 0.9)
      .setVisible(false);
  }

  setupPois() {
    this.poiLayer = this.add.container(0, 0);
    this.syncPoiMarkers(true);
  }

  setupInput() {
    this.input.on('pointerdown', (pointer) => {
      if (this.state.victory || this.state.gameOver) {
        return;
      }
      if (this.inputLocked) {
        return;
      }
      if (pointer.event?.cancelBubble || pointer.event?.defaultPrevented) {
        return;
      }
      if (!this.autoMoveEnabled) {
        return;
      }
      const worldPoint = pointer.positionToCamera(this.cameras.main);
      this.targetPoint = { x: worldPoint.x, y: worldPoint.y };
      this.targetMarker.setPosition(worldPoint.x, worldPoint.y).setVisible(true);
      this.appendLog(`Target set at (${worldPoint.x.toFixed(0)}, ${worldPoint.y.toFixed(0)}).`);
    });
  }

  setupDomUI() {
    this.domUI = getDomUI();
    if (!this.domUI) {
      return;
    }
    this.domUI.setActionHandlers({
      onAutoMoveToggle: (enabled) => {
        this.autoMoveEnabled = enabled;
        this.appendLog(`Auto-move ${enabled ? 'enabled' : 'disabled'}.`);
        if (!enabled) {
          this.resetTarget();
        }
      },
      onResetTarget: () => this.resetTarget(),
      onCenterCamera: () => this.centerCamera(),
    });
    this.domUI.setAutoMove(this.autoMoveEnabled);
    this.appendLog('Entered Jugol’s Rest. Click to move.');
  }

  setupDomHud() {
    this.domHud = initDomHud(this.state, {
      onCollectButcher: () => this.handleCollect('butcher'),
      onCollectTavern: () => this.handleCollect('tavern'),
      onCollectMarket: () => this.handleCollect('market'),
      onFeedPack: () => this.toggleFeedPanel(),
      onStabilizeCamp: () => this.handleStabilizeCamp(),
      onStartNight: () => this.handleStartNight(),
      onClearOvergrowth: () => this.handleClearOvergrowth(),
      onGuardRoute: () => this.handleGuardRoute(),
      onSuppressThreat: () => this.handleSuppressThreat(),
      onSecureLot: () => this.handleSecureLot(),
      onPrayAtShrine: () => this.handlePray(),
      onEndNight: () => this.handleEndNight(),
      onConfirmFeed: (feedPlan) => this.handleFeed(feedPlan),
    });
  }

  setupOverlays() {
    this.phaseOverlay = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x020617, 0)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(5);

    this.phaseBanner = this.add
      .text(this.scale.width / 2, this.scale.height / 2 - 120, '', {
        fontSize: '48px',
        color: '#f8fafc',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(60)
      .setAlpha(0);

    if (this.state.phase === 'NIGHT') {
      this.phaseOverlay.setAlpha(0.45);
    }

    this.victoryOverlay = this.add.container(0, 0).setScrollFactor(0).setVisible(false).setDepth(80);
    const victoryBg = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x0f172a, 0.8).setOrigin(0, 0);
    const victoryText = this.add
      .text(this.scale.width / 2, this.scale.height / 2, 'Victory!\nPopulation Target Reached', {
        fontSize: '36px',
        color: '#f8fafc',
        align: 'center',
      })
      .setOrigin(0.5);
    this.victoryOverlay.add([victoryBg, victoryText]);

    this.gameOverOverlay = this.add.container(0, 0).setScrollFactor(0).setVisible(false).setDepth(80);
    const overBg = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x111827, 0.85).setOrigin(0, 0);
    const overText = this.add
      .text(this.scale.width / 2, this.scale.height / 2, 'Collapse...\nBehind the Walls Falls', {
        fontSize: '36px',
        color: '#f87171',
        align: 'center',
      })
      .setOrigin(0.5);
    this.gameOverOverlay.add([overBg, overText]);

    this.narrativeOverlay = this.add.container(0, 0).setScrollFactor(0).setVisible(false).setDepth(90);
    const narrativeBg = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x0f172a, 0.8).setOrigin(0, 0);
    const narrativeCard = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, 640, 260, 0x111827, 0.95);
    narrativeCard.setStrokeStyle(2, 0x38bdf8, 0.6);
    this.narrativeText = this.add
      .text(this.scale.width / 2, this.scale.height / 2 - 30, '', {
        fontSize: '18px',
        color: '#f8fafc',
        align: 'center',
        wordWrap: { width: 560 },
        padding: { x: 12, y: 12 },
      })
      .setOrigin(0.5);
    const continueButton = this.add
      .rectangle(this.scale.width / 2, this.scale.height / 2 + 90, 160, 44, 0x38bdf8, 0.9)
      .setInteractive({ useHandCursor: true });
    const continueText = this.add
      .text(this.scale.width / 2, this.scale.height / 2 + 90, 'Continue', {
        fontSize: '16px',
        color: '#0f172a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    continueButton.on('pointerdown', () => this.hideNarrativeOverlay());
    this.narrativeOverlay.add([narrativeBg, narrativeCard, this.narrativeText, continueButton, continueText]);
  }

  createLocations(dayLocations) {
    if (Array.isArray(this.locations)) {
      this.locations.forEach((loc) => {
        loc.marker?.destroy();
        loc.text?.destroy();
      });
    }

    const locationsConfig = dayLocations || {};
    this.locations = [
      {
        key: 'butcher',
        label: 'Butcher',
        color: 0xf87171,
        ...locationsConfig.butcher,
      },
      {
        key: 'tavern',
        label: 'Tavern',
        color: 0xfacc15,
        ...locationsConfig.tavern,
      },
      {
        key: 'market',
        label: 'Market Stall',
        color: 0x4ade80,
        ...locationsConfig.market,
      },
    ];

    this.locations.forEach((loc) => {
      if (typeof loc.x !== 'number' || typeof loc.y !== 'number') {
        return;
      }
      loc.marker = this.add.circle(loc.x, loc.y, 18, loc.color, 0.9);
      loc.text = this.add.text(loc.x, loc.y - 32, loc.label, {
        fontSize: '14px',
        color: '#f8fafc',
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        padding: { x: 4, y: 2 },
      }).setOrigin(0.5);
    });
  }

  updateDistrictBackground(districtConfig) {
    if (this.backgroundLayer) {
      this.backgroundLayer.destroy();
    }
    this.backgroundLayer = this.add.container(0, 0).setDepth(-20);
    const background = districtConfig?.background || {};
    const imageKey = background.imageKey;
    if (imageKey && this.textures.exists(imageKey)) {
      const bg = this.add.image(0, 0, imageKey).setOrigin(0, 0);
      bg.setDisplaySize(WORLD_WIDTH, WORLD_HEIGHT);
      if (background.tint) {
        bg.setTint(background.tint);
      }
      this.backgroundLayer.add(bg);
    } else {
      const fill = background.color ?? 0x1f2937;
      const rect = this.add.rectangle(0, 0, WORLD_WIDTH, WORLD_HEIGHT, fill);
      rect.setOrigin(0, 0);
      this.backgroundLayer.add(rect);
    }
  }

  setupGateways(gateways) {
    this.clearGateways();
    if (!Array.isArray(gateways)) {
      return;
    }

    if (!this.gatewayLayer) {
      this.gatewayLayer = this.add.container(0, 0).setDepth(20);
    } else {
      this.gatewayLayer.removeAll(true);
    }

    gateways.forEach((gateway) => {
      const rect = this.add.rectangle(gateway.x, gateway.y, gateway.w, gateway.h, 0x38bdf8, 0.08);
      rect.setOrigin(0, 0);
      rect.setStrokeStyle(2, 0x38bdf8, 0.6);
      const label = this.add.text(
        gateway.x + gateway.w / 2,
        gateway.y - 12,
        gateway.label,
        {
          fontSize: '12px',
          color: '#e2e8f0',
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          padding: { x: 6, y: 2 },
        }
      ).setOrigin(0.5, 1);
      this.gatewayLayer.add([rect, label]);

      const zone = this.add.zone(
        gateway.x + gateway.w / 2,
        gateway.y + gateway.h / 2,
        gateway.w,
        gateway.h
      );
      this.physics.add.existing(zone, true);
      const collider = this.physics.add.overlap(this.player, zone, () =>
        this.handleGatewayOverlap(gateway)
      );
      this.gatewayZones.push({ zone, collider });
    });
  }

  clearGateways() {
    this.gatewayZones.forEach((entry) => {
      entry.collider?.destroy();
      entry.zone?.destroy();
    });
    this.gatewayZones = [];
  }

  update(time, delta) {
    if (this.state.victory || this.state.gameOver) {
      return;
    }

    if (!this.inputLocked) {
      this.handleMovement(delta);
    }
    this.syncPoiMarkers();
    this.updateHud();
    this.updateStatus(delta);
  }

  handleMovement(delta) {
    const speed = PLAYER_SPEED;
    const deltaSeconds = delta / 1000;
    let movedWithKeys = false;

    if (this.cursors.left.isDown) {
      this.player.x -= speed * deltaSeconds;
      movedWithKeys = true;
    }
    if (this.cursors.right.isDown) {
      this.player.x += speed * deltaSeconds;
      movedWithKeys = true;
    }
    if (this.cursors.up.isDown) {
      this.player.y -= speed * deltaSeconds;
      movedWithKeys = true;
    }
    if (this.cursors.down.isDown) {
      this.player.y += speed * deltaSeconds;
      movedWithKeys = true;
    }

    if (movedWithKeys) {
      this.targetPoint = null;
      this.targetMarker.setVisible(false);
    } else if (this.targetPoint) {
      const next = moveToward(this.player, this.targetPoint, speed, deltaSeconds);
      this.player.setPosition(next.x, next.y);
      if (next.arrived) {
        this.targetPoint = null;
        this.targetMarker.setVisible(false);
        this.appendLog('Reached target.');
      }
    }

    this.player.x = Phaser.Math.Clamp(this.player.x, 0, WORLD_WIDTH);
    this.player.y = Phaser.Math.Clamp(this.player.y, 0, WORLD_HEIGHT);
  }

  updateHud() {
    const activePois = this.getActivePois();
    const shrinePois = activePois.filter((poi) => poi.type === 'SHRINE');
    const patrolPois = activePois.filter((poi) => poi.type !== 'SHRINE');
    const nearest = this.getNearestPoi(patrolPois);
    const nearestPoi = nearest?.poi || null;
    const nearestDistance = nearest?.distance ?? null;
    const nearestInRange =
      nearestPoi && typeof nearestDistance === 'number'
        ? nearestDistance <= (nearestPoi.radius || INTERACT_RADIUS)
        : false;
    const nearestShrineResult = this.getNearestPoi(shrinePois);
    const nearestShrine = nearestShrineResult?.poi || null;
    const nearestShrineDistance = nearestShrineResult?.distance ?? null;
    const nearestShrineInRange =
      nearestShrine && typeof nearestShrineDistance === 'number'
        ? nearestShrineDistance <= (nearestShrine.radius || INTERACT_RADIUS)
        : false;
    const shrineGod = nearestShrine ? GOD_BY_ID[nearestShrine.godId] : null;
    const context = {
      nearButcher: this.isNearLocation('butcher'),
      nearTavern: this.isNearLocation('tavern'),
      nearMarket: this.isNearLocation('market'),
      activePois: patrolPois.map((poi) => ({
        ...poi,
        distance: Phaser.Math.Distance.Between(this.player.x, this.player.y, poi.x, poi.y),
      })),
      nearestPoi,
      nearestPoiDistance: nearestDistance,
      nearestPoiInRange: nearestInRange,
      nearestShrine,
      nearestShrineDistance,
      nearestShrineInRange,
      shrineGod,
    };
    if (this.domHud) {
      this.domHud.update(this.state, context);
    }

    setPanelActive(
      'actions',
      this.state.phase === 'DAY'
        ? this.state.dayActionsRemaining > 0
        : this.state.packStamina > 0
    );

    if (this.state.victory) {
      this.victoryOverlay.setVisible(true);
    }
    if (this.state.gameOver) {
      this.gameOverOverlay.setVisible(true);
    }
  }

  isNearLocation(key) {
    const loc = this.locations.find((location) => location.key === key);
    if (!loc || typeof loc.x !== 'number' || typeof loc.y !== 'number') {
      return false;
    }
    return Phaser.Math.Distance.Between(this.player.x, this.player.y, loc.x, loc.y) <= INTERACT_RADIUS;
  }

  handleGatewayOverlap(gateway) {
    if (this.isTransitioning || this.inputLocked) {
      return;
    }
    if (!gateway || gateway.toDistrictId === this.state.currentDistrictId) {
      return;
    }
    this.transitionToDistrict(gateway);
  }

  transitionToDistrict(gateway) {
    if (!gateway) {
      return;
    }
    const nextDistrict = getDistrictConfig(gateway.toDistrictId);
    this.isTransitioning = true;
    this.inputLocked = true;
    if (this.domHud) {
      this.domHud.setInteractionLocked(true);
    }
    this.resetTarget();
    this.appendLog(`Approaching ${nextDistrict.displayName}...`);
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.applyDistrictTransition(gateway, nextDistrict);
      this.cameras.main.fadeIn(350, 0, 0, 0);
      this.cameras.main.once('camerafadeincomplete', () => {
        this.isTransitioning = false;
        this.inputLocked = false;
        if (this.domHud) {
          this.domHud.setInteractionLocked(false);
        }
      });
    });
  }

  applyDistrictTransition(gateway, districtConfig) {
    this.state.currentDistrictId = districtConfig.id;
    this.currentDistrict = districtConfig;
    this.updateDistrictBackground(districtConfig);
    this.createLocations(districtConfig.dayLocations);
    this.setupGateways(districtConfig.gateways);
    this.player.setPosition(gateway.spawnX, gateway.spawnY);
    this.lastPosition = { x: gateway.spawnX, y: gateway.spawnY };

    if (this.state.phase === 'NIGHT' && this.getDistrictPois().length === 0) {
      spawnPoisForNight(this.state, districtConfig);
    }
    addEvent(this.state, `Entered ${districtConfig.displayName}.`);
    this.syncPoiMarkers(true);
    this.updateHud();
  }

  playPhaseTransition(fromPhase, toPhase) {
    if (fromPhase === toPhase) {
      return;
    }
    const targetAlpha = toPhase === 'NIGHT' ? 0.45 : 0;
    this.tweens.add({
      targets: this.phaseOverlay,
      alpha: targetAlpha,
      duration: 500,
      ease: 'Quad.easeOut',
    });

    const bannerText = toPhase === 'NIGHT' ? 'NIGHTFALL' : 'DAWN';
    this.phaseBanner.setText(bannerText);
    this.phaseBanner.setAlpha(0);
    this.tweens.add({
      targets: this.phaseBanner,
      alpha: 1,
      duration: 250,
      ease: 'Sine.easeOut',
      yoyo: true,
      hold: 600,
    });
  }

  handleCollect(locationKey) {
    if (collectLocation(this.state, locationKey)) {
      const labels = {
        butcher: 'Collected stores from the Butcher.',
        tavern: 'Collected kegs from the Tavern.',
        market: 'Collected supplies from the Market.',
      };
      addEvent(this.state, labels[locationKey] || 'Collected supplies.');
      applyFactionInfluence(this.state, 'collect', { location: locationKey });
      if (this.domHud) {
        this.domHud.hideFeedPanel();
      }
      this.updateHud();
    }
  }

  handleFeed(feedPlan) {
    if (feedHyenas(this.state, feedPlan)) {
      feedPlan.forEach((entry) => {
        const total = (entry.scraps || 0) + (entry.fatty || 0);
        if (total <= 0) {
          return;
        }
        const hyena = this.state.pack.find((member) => member.id === entry.id);
        const name = hyena ? hyena.name : 'Hyena';
        addEvent(
          this.state,
          `Fed ${name} (${entry.scraps || 0} scraps, ${entry.fatty || 0} fatty).`
        );
      });
      if (this.domHud) {
        this.domHud.hideFeedPanel();
        this.domHud.playFeedAnimations(feedPlan);
      }
      applyFactionInfluence(this.state, 'feed');
      this.updateHud();
    }
  }

  handleStabilizeCamp() {
    const result = stabilizeCamp(this.state);
    if (result) {
      addEvent(this.state, 'Stabilized the camp with fresh supplies.');
      if (result.moved > 0) {
        addEvent(this.state, `Stabilized camp: Moved ${result.moved} into housing.`);
      }
      applyFactionInfluence(this.state, 'stabilize_camp');
      this.updateHud();
    }
  }

  handleStartNight() {
    if (this.state.phase !== 'DAY') {
      return;
    }
    const previousPhase = this.state.phase;
    startNight(this.state);
    spawnPoisForNight(this.state, this.currentDistrict);
    addEvent(this.state, 'Night falls over Jugol’s Rest.');
    applyFactionInfluence(this.state, 'start_night');
    saveGameState(this.state);
    if (this.domHud) {
      this.domHud.hideFeedPanel();
    }
    this.playPhaseTransition(previousPhase, this.state.phase);
    this.syncPoiMarkers(true);
    this.handleNarrativePhaseStart();
    this.updateHud();
  }

  handleClearOvergrowth() {
    this.handlePoiAction('OVERGROWTH');
  }

  handleGuardRoute() {
    this.handlePoiAction('ROUTE');
  }

  handleSuppressThreat() {
    this.handlePoiAction('RUCKUS');
  }

  handleSecureLot() {
    this.handlePoiAction('LOT');
  }

  handlePray() {
    const shrinePois = this.getActivePois().filter((poi) => poi.type === 'SHRINE');
    const nearest = this.getNearestPoi(shrinePois);
    if (!nearest) {
      return;
    }
    const { poi, distance } = nearest;
    if (distance > (poi.radius || INTERACT_RADIUS)) {
      return;
    }
    if (poi.prayedToday) {
      return;
    }
    const god = GOD_BY_ID[poi.godId];
    if (!god) {
      return;
    }
    const isNewDiscovery = !this.state.discoveredShrines?.[poi.godId];
    poi.prayedToday = true;
    poi.discovered = true;
    if (!this.state.discoveredShrines) {
      this.state.discoveredShrines = {};
    }
    this.state.discoveredShrines[poi.godId] = true;

    const blessing = createBlessingEntry(this.state, god);
    if (!Array.isArray(this.state.activeBlessings)) {
      this.state.activeBlessings = [];
    }
    this.state.activeBlessings.push(blessing);

    if (isNewDiscovery) {
      addEvent(this.state, `Shrine discovered: ${god.name}.`);
    }
    addEvent(
      this.state,
      `Blessing received: ${god.name} — ${formatBlessingEffect(blessing)}.`
    );

    const resolved = resolvePoi(this.state, poi.id);
    if (resolved) {
      this.animatePoiResolution(resolved.id);
    }
    saveGameState(this.state);
    this.updateHud();
  }

  handleEndNight() {
    if (this.state.phase !== 'NIGHT') {
      return;
    }
    const previousPhase = this.state.phase;
    endNight(this.state);
    addEvent(this.state, 'Dawn breaks, the watch rotates.');
    spawnPoisForDay(this.state);
    applyFactionInfluence(this.state, 'end_night');
    saveGameState(this.state);
    this.playPhaseTransition(previousPhase, this.state.phase);
    this.syncPoiMarkers(true);
    this.handleNarrativePhaseStart();
    this.updateHud();
  }

  toggleFeedPanel() {
    if (this.state.phase !== 'DAY') {
      return;
    }
    if (this.domHud) {
      this.domHud.toggleFeedPanel(!this.domHud.isFeedPanelVisible());
    }
  }

  resetTarget() {
    if (this.targetPoint) {
      this.targetPoint = null;
      this.targetMarker.setVisible(false);
      this.appendLog('Target cleared.');
    }
  }

  centerCamera() {
    if (this.player) {
      this.cameras.main.centerOn(this.player.x, this.player.y);
      this.appendLog('Camera centered on player.');
    }
  }

  updateStatus(delta) {
    if (!this.domUI || !this.player) {
      return;
    }

    if (!this.lastPosition) {
      this.lastPosition = { x: this.player.x, y: this.player.y };
    }

    const deltaSeconds = delta / 1000;
    const velocity = deltaSeconds > 0
      ? {
        x: (this.player.x - this.lastPosition.x) / deltaSeconds,
        y: (this.player.y - this.lastPosition.y) / deltaSeconds,
      }
      : { x: 0, y: 0 };

    const distance = this.targetPoint
      ? Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        this.targetPoint.x,
        this.targetPoint.y
      )
      : null;

    this.domUI.updateStatus({
      position: { x: this.player.x, y: this.player.y },
      target: this.targetPoint,
      distance,
      velocity,
    });

    this.lastPosition = { x: this.player.x, y: this.player.y };
  }

  appendLog(message) {
    if (this.domUI?.appendLog) {
      this.domUI.appendLog(message);
    }
  }

  handleNarrativePhaseStart() {
    this.maybeAddAmbientLine();
    this.maybeTriggerNarrativeEvent();
    saveGameState(this.state);
  }

  maybeAddAmbientLine() {
    const key = `${this.state.dayNumber}-${this.state.phase}`;
    if (this.state.lastAmbientLineKey === key) {
      return;
    }
    if (Math.random() > 0.6) {
      return;
    }
    const dominantFaction = getDominantCampFaction(this.state);
    const context = {
      currentDistrictId: this.state.currentDistrictId,
      dominantFaction: dominantFaction?.id || null,
      campPop: this.state.campPop > 0,
      phase: this.state.phase,
      ambientSource: 'City',
    };
    const line = getAmbientLine(context);
    if (line) {
      addNarrativeEvent(this.state, context.ambientSource, line);
      this.state.lastAmbientLineKey = key;
    }
  }

  maybeTriggerNarrativeEvent() {
    const event = getNarrativeEvent(this.state);
    if (!event) {
      return;
    }
    this.state.lastNarrativeEventDay = this.state.dayNumber;
    applyNarrativeEventEffects(this.state, event);
    const sourceLabel = getNarrativeSourceLabel(event);
    addNarrativeEvent(this.state, sourceLabel, event.text);
    this.showNarrativeOverlay(event.text);
  }

  showNarrativeOverlay(text) {
    if (!this.narrativeOverlay || !this.narrativeText) {
      return;
    }
    this.narrativeText.setText(text);
    this.narrativeOverlay.setVisible(true);
    this.inputLocked = true;
    if (this.domHud) {
      this.domHud.setInteractionLocked(true);
    }
  }

  hideNarrativeOverlay() {
    if (!this.narrativeOverlay) {
      return;
    }
    this.narrativeOverlay.setVisible(false);
    this.inputLocked = false;
    if (this.domHud) {
      this.domHud.setInteractionLocked(false);
    }
  }

  getActivePois() {
    const pois = this.getDistrictPois();
    return pois.filter((poi) => !poi.resolved);
  }

  getDistrictPois() {
    const activePoisByDistrict = this.state.activePoisByDistrict;
    if (!activePoisByDistrict) {
      return [];
    }
    const currentPois = activePoisByDistrict[this.state.currentDistrictId];
    return Array.isArray(currentPois) ? currentPois : [];
  }

  getNearestPoi(activePois) {
    if (!Array.isArray(activePois) || activePois.length === 0) {
      return null;
    }
    return activePois.reduce((nearest, poi) => {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, poi.x, poi.y);
      if (!nearest || distance < nearest.distance) {
        return { poi, distance };
      }
      return nearest;
    }, null);
  }

  getPoiActionCost(type, poi) {
    const modifier = getBlessingActionCostModifier(this.state);
    switch (type) {
      case 'OVERGROWTH':
        return Math.max(1, 2 + (poi?.severity || 1) + modifier);
      case 'ROUTE':
        return Math.max(1, 2 + modifier);
      case 'RUCKUS':
        return Math.max(1, 3 + modifier);
      case 'LOT':
        return Math.max(1, 2 + modifier);
      default:
        return Math.max(1, 1 + modifier);
    }
  }

  handlePoiAction(type) {
    if (this.state.phase !== 'NIGHT') {
      return;
    }
    const activePois = this.getActivePois();
    const nearest = this.getNearestPoi(activePois);
    if (!nearest || nearest.poi.type !== type) {
      return;
    }
    const { poi, distance } = nearest;
    if (distance > (poi.radius || INTERACT_RADIUS)) {
      return;
    }

    if (type === 'OVERGROWTH') {
      const cost = this.getPoiActionCost(type, poi);
      if (this.state.packStamina < cost) {
        return;
      }
      this.state.packStamina -= cost;
      this.state.overgrowth = clampMeter(
        this.state.overgrowth - (15 + poi.severity * 5)
      );
      const housingReward = applyBlessingHousingReward(this.state, 1);
      this.state.housingCapacity += housingReward;
      this.state.clearedOvergrowthTonight = true;
      addEvent(this.state, `Cleared overgrowth: Housing capacity +${housingReward}.`);
      applyFactionInfluence(this.state, 'clear_overgrowth', { poiSeverity: poi.severity });
    }

    if (type === 'ROUTE') {
      const cost = this.getPoiActionCost(type, poi);
      if (this.state.packStamina < cost) {
        return;
      }
      this.state.packStamina -= cost;
      this.state.routeGuardedTonight = true;
      addEvent(this.state, 'Patrolled the route through the ruins.');
      applyFactionInfluence(this.state, 'guard_route', { poiSeverity: poi.severity });
    }

    if (type === 'RUCKUS') {
      const cost = this.getPoiActionCost(type, poi);
      if (this.state.packStamina < cost || this.state.packPower < 2) {
        return;
      }
      this.state.packStamina -= cost;
      this.state.tension = clampMeter(
        this.state.tension - (10 + poi.severity * 5)
      );
      this.state.threatActive = false;
      addEvent(this.state, 'Suppressed a ruckus: tension eased.');
      applyFactionInfluence(this.state, 'suppress_threat', { poiSeverity: poi.severity });
    }

    if (type === 'LOT') {
      const cost = this.getPoiActionCost(type, poi);
      if (this.state.packStamina < cost) {
        return;
      }
      this.state.packStamina -= cost;
      const housingReward = applyBlessingHousingReward(this.state, 2);
      this.state.housingCapacity += housingReward;
      this.state.campPressure = clampMeter(this.state.campPressure - 10);
      addEvent(this.state, `Secured a lot: Housing capacity +${housingReward}.`);
      applyFactionInfluence(this.state, 'secure_lot', { poiSeverity: poi.severity });
    }

    const resolved = resolvePoi(this.state, poi.id);
    if (resolved) {
      this.animatePoiResolution(resolved.id);
    }
    if (this.domHud) {
      this.domHud.flashNightStats();
    }
    this.updateHud();
  }

  syncPoiMarkers(force = false) {
    if (!this.poiLayer) {
      return;
    }
    const activePois = this.getDistrictPois();
    const activeIds = new Set(activePois.map((poi) => poi.id));

    this.poiMarkers.forEach((marker, id) => {
      if (!activeIds.has(id)) {
        const tween = this.poiPulseTweens.get(id);
        if (tween) {
          tween.stop();
          this.poiPulseTweens.delete(id);
        }
        marker.container.destroy();
        this.poiMarkers.delete(id);
      }
    });

    activePois.forEach((poi) => {
      if (!this.poiMarkers.has(poi.id)) {
        const marker = this.createPoiMarker(poi);
        this.poiMarkers.set(poi.id, marker);
      } else if (force) {
        const marker = this.poiMarkers.get(poi.id);
        marker.container.setPosition(poi.x, poi.y);
      }

      const marker = this.poiMarkers.get(poi.id);
      if (poi.resolved && marker && !marker.resolving) {
        marker.resolving = true;
        this.animatePoiResolution(poi.id);
      }
    });
  }

  createPoiMarker(poi) {
    const { color, label } = this.getPoiStyle(poi.type);
    const container = this.add.container(poi.x, poi.y);
    const core = this.add.circle(0, 0, 10, color, 0.9);
    const ring = this.add.circle(0, 0, poi.radius || 60, color, 0.1);
    ring.setStrokeStyle(2, color, 0.8);

    const labelText = poi.type === 'SHRINE' ? label : `${label} ${poi.severity}`;
    const text = this.add
      .text(0, -(poi.radius || 60) - 14, labelText, {
        fontSize: '12px',
        color: '#f8fafc',
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5);

    container.add([ring, core, text]);
    this.poiLayer.add(container);

    const tween = this.tweens.add({
      targets: ring,
      scale: 1.4,
      alpha: 0,
      duration: 1200,
      repeat: -1,
      yoyo: false,
      ease: 'Sine.easeOut',
    });
    this.poiPulseTweens.set(poi.id, tween);

    return { container, ring, core, text, resolving: false };
  }

  animatePoiResolution(id) {
    const marker = this.poiMarkers.get(id);
    if (!marker) {
      return;
    }
    const tween = this.poiPulseTweens.get(id);
    if (tween) {
      tween.stop();
      this.poiPulseTweens.delete(id);
    }
    this.tweens.add({
      targets: marker.container,
      alpha: 0,
      duration: 500,
      ease: 'Sine.easeIn',
      onComplete: () => {
        marker.container.destroy();
        this.poiMarkers.delete(id);
      },
    });
  }

  getPoiStyle(type) {
    switch (type) {
      case 'OVERGROWTH':
        return { color: 0x4ade80, label: 'O' };
      case 'RUCKUS':
        return { color: 0xf97316, label: 'RK' };
      case 'ROUTE':
        return { color: 0x38bdf8, label: 'RT' };
      case 'LOT':
        return { color: 0xa855f7, label: 'L' };
      case 'SHRINE':
        return { color: 0xfacc15, label: 'Shrine' };
      default:
        return { color: 0x94a3b8, label: '?' };
    }
  }
}
