import {
  createInitialState,
  startDay,
  startNight,
  endNight,
  collectLocation,
  feedHyenas,
  stabilizeCamp,
  clearOvergrowth,
  guardRoute,
  suppressThreat,
  addEvent,
  saveGameState,
  loadGameState,
} from '../state/gameState.js';
import { getDomUI } from '../ui/domUI.js';
import { initDomHud } from '../ui/domHud.js';
import { setPanelActive } from '../ui/panelDock.js';
import { moveToward } from '../utils/pathing.js';

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
    this.inputLocked = false;
    this.domUI = null;
    this.autoMoveEnabled = true;
    this.lastPosition = null;
  }

  create(data = {}) {
    if (data.loadSave) {
      this.state = loadGameState();
    }
    if (!this.state) {
      this.state = createInitialState();
      startDay(this.state, { advanceDay: false });
      addEvent(this.state, 'Day 1 begins in the Heart District.');
    } else if (data.loadSave) {
      addEvent(this.state, 'The watch resumes from the last report.');
    }

    this.setupWorld();
    this.setupPlayer();
    this.setupMarkers();
    this.setupInput();
    this.setupDomUI();
    this.setupDomHud();
    this.setupOverlays();

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

    if (this.textures.exists('city')) {
      const bg = this.add.image(0, 0, 'city').setOrigin(0, 0);
      bg.setDisplaySize(WORLD_WIDTH, WORLD_HEIGHT);
    } else {
      this.add.rectangle(0, 0, WORLD_WIDTH, WORLD_HEIGHT, 0x1f2937).setOrigin(0, 0);
    }

    this.createLocations();
    this.createZones();
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
  }

  setupMarkers() {
    this.targetMarker = this.add
      .circle(0, 0, CLICK_RADIUS, 0x38bdf8, 0.9)
      .setVisible(false);
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
      .text(this.scale.width / 2, this.scale.height / 2, 'Victory!\nJugol’s Rest Stabilized', {
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
  }

  createLocations() {
    this.locations = [
      { key: 'butcher', label: 'Butcher', x: 350, y: 260, color: 0xf87171 },
      { key: 'tavern', label: 'Tavern', x: 880, y: 320, color: 0xfacc15 },
      { key: 'market', label: 'Market Stall', x: 620, y: 720, color: 0x4ade80 },
    ];

    this.locations.forEach((loc) => {
      loc.marker = this.add.circle(loc.x, loc.y, 18, loc.color, 0.9);
      loc.text = this.add.text(loc.x, loc.y - 32, loc.label, {
        fontSize: '14px',
        color: '#f8fafc',
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        padding: { x: 4, y: 2 },
      }).setOrigin(0.5);
    });
  }

  createZones() {
    this.zones = {
      overgrowth: new Phaser.Geom.Rectangle(1200, 200, 260, 200),
      route: new Phaser.Geom.Rectangle(1300, 550, 260, 200),
      threat: new Phaser.Geom.Rectangle(1050, 850, 260, 200),
    };

    this.zoneGraphics = this.add.graphics();
    this.drawZones();
  }

  drawZones() {
    this.zoneGraphics.clear();
    this.zoneGraphics.lineStyle(3, 0x4ade80, 0.8);
    this.zoneGraphics.strokeRectShape(this.zones.overgrowth);
    this.zoneGraphics.lineStyle(3, 0x38bdf8, 0.8);
    this.zoneGraphics.strokeRectShape(this.zones.route);
    this.zoneGraphics.lineStyle(3, 0xf97316, 0.8);
    this.zoneGraphics.strokeRectShape(this.zones.threat);

    this.add.text(this.zones.overgrowth.x + 10, this.zones.overgrowth.y - 24, 'Overgrowth Zone', {
      fontSize: '14px',
      color: '#bbf7d0',
    });
    this.add.text(this.zones.route.x + 10, this.zones.route.y - 24, 'Route Zone', {
      fontSize: '14px',
      color: '#bae6fd',
    });
    this.add.text(this.zones.threat.x + 10, this.zones.threat.y - 24, 'Threat Zone', {
      fontSize: '14px',
      color: '#fed7aa',
    });
  }

  update(time, delta) {
    if (this.state.victory || this.state.gameOver) {
      return;
    }

    if (!this.inputLocked) {
      this.handleMovement(delta);
    }
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
    const context = {
      nearButcher: this.isNearLocation('butcher'),
      nearTavern: this.isNearLocation('tavern'),
      nearMarket: this.isNearLocation('market'),
      inOvergrowthZone: this.isInZone('overgrowth'),
      inRouteZone: this.isInZone('route'),
      inThreatZone: this.isInZone('threat'),
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
    if (!loc) {
      return false;
    }
    return Phaser.Math.Distance.Between(this.player.x, this.player.y, loc.x, loc.y) <= INTERACT_RADIUS;
  }

  isInZone(zoneKey) {
    const zone = this.zones[zoneKey];
    if (!zone) {
      return false;
    }
    return zone.contains(this.player.x, this.player.y);
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
      this.updateHud();
    }
  }

  handleStabilizeCamp() {
    if (stabilizeCamp(this.state)) {
      addEvent(this.state, 'Stabilized the camp with fresh supplies.');
      this.updateHud();
    }
  }

  handleStartNight() {
    if (this.state.phase !== 'DAY') {
      return;
    }
    const previousPhase = this.state.phase;
    startNight(this.state);
    addEvent(this.state, 'Night falls over Jugol’s Rest.');
    saveGameState(this.state);
    if (this.domHud) {
      this.domHud.hideFeedPanel();
    }
    this.playPhaseTransition(previousPhase, this.state.phase);
    this.updateHud();
  }

  handleClearOvergrowth() {
    if (clearOvergrowth(this.state)) {
      addEvent(this.state, 'Carved back the overgrowth.');
      if (this.domHud) {
        this.domHud.flashNightStats();
      }
      this.updateHud();
    }
  }

  handleGuardRoute() {
    if (guardRoute(this.state)) {
      addEvent(this.state, 'Guarded the route through the ruins.');
      if (this.domHud) {
        this.domHud.flashNightStats();
      }
      this.updateHud();
    }
  }

  handleSuppressThreat() {
    if (suppressThreat(this.state)) {
      addEvent(this.state, 'Suppressed the lurking threat.');
      if (this.domHud) {
        this.domHud.flashNightStats();
      }
      this.updateHud();
    }
  }

  handleEndNight() {
    if (this.state.phase !== 'NIGHT') {
      return;
    }
    const previousPhase = this.state.phase;
    endNight(this.state);
    addEvent(this.state, 'Dawn breaks, the watch rotates.');
    saveGameState(this.state);
    this.playPhaseTransition(previousPhase, this.state.phase);
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
}
