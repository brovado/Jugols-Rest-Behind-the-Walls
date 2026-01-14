import {
  createInitialState,
  startDay,
  startNight,
  endNight,
  collectLocation,
  feedPack,
  stabilizeCamp,
  clearOvergrowth,
  guardRoute,
  suppressThreat,
} from '../state/gameState.js';
import { createHud } from '../ui/hud.js';
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
    this.hud = null;
    this.nightOverlay = null;
    this.victoryOverlay = null;
    this.gameOverOverlay = null;
  }

  create() {
    this.state = createInitialState();
    startDay(this.state, { advanceDay: false });

    this.setupWorld();
    this.setupPlayer();
    this.setupMarkers();
    this.setupInput();
    this.setupHud();
    this.setupOverlays();

    this.updateHud();
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
      if (pointer.event?.cancelBubble || pointer.event?.defaultPrevented) {
        return;
      }
      const worldPoint = pointer.positionToCamera(this.cameras.main);
      this.targetPoint = { x: worldPoint.x, y: worldPoint.y };
      this.targetMarker.setPosition(worldPoint.x, worldPoint.y).setVisible(true);
    });
  }

  setupHud() {
    this.hud = createHud(this, this.state, {
      onCollectButcher: () => this.handleCollect('butcher'),
      onCollectTavern: () => this.handleCollect('tavern'),
      onCollectMarket: () => this.handleCollect('market'),
      onFeedPack: () => this.toggleFeedPanel(),
      onConfirmFeed: (scraps, fatty) => this.handleFeed(scraps, fatty),
      onStabilizeCamp: () => this.handleStabilizeCamp(),
      onStartNight: () => this.handleStartNight(),
      onClearOvergrowth: () => this.handleClearOvergrowth(),
      onGuardRoute: () => this.handleGuardRoute(),
      onSuppressThreat: () => this.handleSuppressThreat(),
      onEndNight: () => this.handleEndNight(),
    });
  }

  setupOverlays() {
    this.nightOverlay = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x020617, 0.5)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setVisible(false);

    this.victoryOverlay = this.add.container(0, 0).setScrollFactor(0).setVisible(false);
    const victoryBg = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x0f172a, 0.8).setOrigin(0, 0);
    const victoryText = this.add
      .text(this.scale.width / 2, this.scale.height / 2, 'Victory!\nJugol’s Rest Stabilized', {
        fontSize: '36px',
        color: '#f8fafc',
        align: 'center',
      })
      .setOrigin(0.5);
    this.victoryOverlay.add([victoryBg, victoryText]);

    this.gameOverOverlay = this.add.container(0, 0).setScrollFactor(0).setVisible(false);
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

    this.handleMovement(delta);
    this.updateHud();
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
    this.hud.update(this.state, context);
    this.nightOverlay.setVisible(this.state.phase === 'NIGHT');

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

  handleCollect(locationKey) {
    if (collectLocation(this.state, locationKey)) {
      this.hud.hideFeedPanel();
      this.updateHud();
    }
  }

  handleFeed(scraps, fatty) {
    if (feedPack(this.state, scraps, fatty)) {
      this.hud.hideFeedPanel();
      this.updateHud();
    }
  }

  handleStabilizeCamp() {
    if (stabilizeCamp(this.state)) {
      this.updateHud();
    }
  }

  handleStartNight() {
    if (this.state.phase !== 'DAY') {
      return;
    }
    startNight(this.state);
    this.hud.hideFeedPanel();
    this.updateHud();
  }

  handleClearOvergrowth() {
    if (clearOvergrowth(this.state)) {
      this.updateHud();
    }
  }

  handleGuardRoute() {
    if (guardRoute(this.state)) {
      this.updateHud();
    }
  }

  handleSuppressThreat() {
    if (suppressThreat(this.state)) {
      this.updateHud();
    }
  }

  handleEndNight() {
    if (this.state.phase !== 'NIGHT') {
      return;
    }
    endNight(this.state);
    this.updateHud();
  }

  toggleFeedPanel() {
    if (this.state.phase !== 'DAY') {
      return;
    }
    this.hud.toggleFeedPanel(!this.hud.isFeedPanelVisible());
  }
}
