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
  getActivePack,
  getHyenaContribution,
  syncActivePack,
  packRules,
  saveGameState,
  loadGameState,
} from '../state/gameState.js';
import { applyFactionInfluence } from '../state/factionSystem.js';
import { getDomUI } from '../ui/domUI.js';
import { initDomHud } from '../ui/domHud.js';
import { moveToward } from '../utils/pathing.js';
import { getAmbientLine } from '../world/ambient.js';
import {
  applyBlessingHousingReward,
  createBlessingEntry,
  formatBlessingEffect,
  getBlessingActionCostModifier,
} from '../world/blessings.js';
import { FACTION_BY_ID } from '../data/factions.js';
import { getDistrictConfig } from '../world/districts.js';
import { GOD_BY_ID } from '../world/gods.js';
import {
  getContactById,
  getContactsByDistrict,
  getContactVoiceLine,
} from '../world/contacts.js';
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
const WARDEN_FLAG_BY_ID = {
  warden_pack: 'packWardenSeen',
  warden_city: 'cityWardenSeen',
  warden_time: 'timeWardenSeen',
};

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
    this.map = null;
    this.mapLayers = {};
    this.mapSpawn = null;
    this.worldBounds = { width: WORLD_WIDTH, height: WORLD_HEIGHT };
    this.gatewayLayer = null;
    this.gatewayZones = [];
    this.currentDistrict = null;
    this.isTransitioning = false;
    this.structureMarkers = [];
    this.campNpcMarkers = [];
    this.campWardenById = new Map();
    this.currentInteractable = null;
    this.interactKey = null;
    this.stableOverlay = null;
    this.stableContent = null;
    this.stableViewOpen = false;
    this.stableSelectionId = null;
    this.stableFeedAllocations = {};
    this.draftOverlay = null;
    this.draftContent = null;
    this.draftOverlayOpen = false;
    this.wardenLineCooldownUntil = 0;
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
    this.refreshDraftOverlay();
    this.cameras.main.fadeIn(500, 0, 0, 0);

    this.inputLocked = false;
    if (this.domHud) {
      this.domHud.setInteractionLocked(false);
    }
  }

  setupWorld() {
    this.setupTilemap();
    this.cameras.main.setBounds(0, 0, this.worldBounds.width, this.worldBounds.height);
    this.physics.world.setBounds(0, 0, this.worldBounds.width, this.worldBounds.height);
    this.updateDistrictBackground(this.currentDistrict);
    this.createLocations(this.currentDistrict?.dayLocations);
    this.createStructures(this.currentDistrict?.campStructures);
    this.createCampNpcs(this.currentDistrict?.campNpcs);
  }

  setupTilemap() {
    this.map = null;
    this.mapLayers = {};
    this.mapSpawn = null;
    this.worldBounds = { width: WORLD_WIDTH, height: WORLD_HEIGHT };
    const mapKey =
      this.currentDistrict?.id === 'camp'
        ? 'camp'
        : this.currentDistrict?.id === 'heart'
          ? 'heart_district'
          : null;
    if (!mapKey || !this.cache.tilemap.exists(mapKey)) {
      return;
    }

    const mapData = this.cache.tilemap.get(mapKey)?.data;
    if (!mapData || !Array.isArray(mapData.tilesets)) {
      return;
    }
    mapData.tilesets.forEach((tileset, idx) => {
      const imageLabel = tileset?.image ? tileset.image : '(no image field)';
      console.log(
        `Tilemap tileset ${idx}: ${imageLabel} (name: ${tileset?.name ?? 'unknown'}, firstgid: ${tileset?.firstgid ?? 'unknown'})`,
      );
    });
    if (mapData.tilesets.some((tileset) => tileset?.source)) {
      console.log('External tilesets unsupported. Embed tileset in Tiled and re-export JSON.');
      return;
    }

    const map = this.make.tilemap({ key: mapKey });
    const tileset = map.addTilesetImage('tile6', 'roguelikeSheet');
    if (!tileset) {
      return;
    }

    const groundLayer = map.createLayer('Ground', tileset, 0, 0);
    const wallsLayer = map.createLayer('Walls', tileset, 0, 0);
    const overlayLayer = map.createLayer('Overlays', tileset, 0, 0);

    if (groundLayer) {
      groundLayer.setDepth(0);
    }
    if (wallsLayer) {
      wallsLayer.setDepth(5);
      wallsLayer.setCollisionByExclusion([-1]);
    }
    if (overlayLayer) {
      overlayLayer.setDepth(15);
    }

    this.map = map;
    this.mapLayers = { ground: groundLayer, walls: wallsLayer, overlays: overlayLayer };
    this.worldBounds = { width: map.widthInPixels, height: map.heightInPixels };
    const spawn = this.getPlayerSpawnFromMap(map);
    if (!spawn) {
      console.warn('Player spawn point not found in camp tilemap.');
    }
    this.mapSpawn = spawn;
  }

  getPlayerSpawnFromMap(map) {
    const spawnLayer = map.getObjectLayer('spawn');
    if (!spawnLayer?.objects?.length) {
      return null;
    }

    const playerSpawn = spawnLayer.objects.find((obj) => {
      const isSpawnClass = obj.class === 'spawn' || obj.type === 'spawn';
      if (!isSpawnClass) {
        return false;
      }
      if (Array.isArray(obj.properties)) {
        const roleProp = obj.properties.find((prop) => prop.name === 'role');
        return roleProp?.value === 'player';
      }
      return obj.properties?.role === 'player';
    });

    if (!playerSpawn) {
      return null;
    }

    return { x: playerSpawn.x, y: playerSpawn.y };
  }

  setupPlayer() {
    const spawn = this.mapSpawn ||
      this.currentDistrict?.spawn || {
        x: this.worldBounds.width / 2,
        y: this.worldBounds.height / 2,
      };
    if (this.textures.exists('player')) {
      this.player = this.physics.add.sprite(spawn.x, spawn.y, 'player', 0);
      if (this.player.body) {
        this.player.body.setSize(10, 10);
        this.player.body.setOffset(3, 6);
      }
    } else {
      this.player = this.physics.add
        .sprite(spawn.x, spawn.y, null)
        .setDisplaySize(32, 32);
      this.player.setTint(0xfbbf24);
    }
    this.player.setOrigin(0, 1);
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);
    if (this.mapLayers.walls) {
      this.physics.add.collider(this.player, this.mapLayers.walls);
    }
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
    this.interactKey = this.input.keyboard.addKey('F');
    this.interactKey.on('down', () => {
      this.handleInteract();
    });
    this.escapeKey = this.input.keyboard.addKey('ESC');
    this.escapeKey.on('down', () => {
      if (this.draftOverlayOpen) {
        return;
      }
      if (this.stableViewOpen) {
        this.closeStableView();
      }
    });
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
      onConfirmFeed: () => {},
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

    this.stableOverlay = this.add.container(0, 0).setScrollFactor(0).setVisible(false).setDepth(85);
    const stableBg = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x0f172a, 0.78)
      .setOrigin(0, 0);
    this.stableContent = this.add.container(0, 0);
    this.stableOverlay.add([stableBg, this.stableContent]);

    this.draftOverlay = this.add.container(0, 0).setScrollFactor(0).setVisible(false).setDepth(88);
    const draftBg = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x0f172a, 0.85)
      .setOrigin(0, 0);
    this.draftContent = this.add.container(0, 0).setScrollFactor(0);
    this.draftOverlay.add([draftBg, this.draftContent]);
  }

  createLocations(dayLocations) {
    if (Array.isArray(this.locations)) {
      this.locations.forEach((loc) => {
        loc.marker?.destroy();
        loc.text?.destroy();
      });
    }
    const locationsConfig = dayLocations || {};
    const contacts = getContactsByDistrict(this.currentDistrict?.id).map((contact) => {
      const location = locationsConfig[contact.legacySlot] || {};
      const faction = FACTION_BY_ID[contact.factionId];
      const color = faction?.color ? parseInt(faction.color.replace('#', ''), 16) : 0x38bdf8;
      return {
        key: contact.id,
        contactId: contact.id,
        label: contact.name,
        color,
        contact,
        faction,
        ...location,
      };
    });
    this.locations = contacts;

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

  createStructures(structures) {
    if (Array.isArray(this.structureMarkers)) {
      this.structureMarkers.forEach((entry) => {
        entry.marker?.destroy();
        entry.text?.destroy();
      });
    }
    this.structureMarkers = [];
    if (!Array.isArray(structures)) {
      return;
    }

    structures.forEach((structure) => {
      if (typeof structure.x !== 'number' || typeof structure.y !== 'number') {
        return;
      }
      const color = structure.color ?? 0x38bdf8;
      const marker = this.add.rectangle(structure.x, structure.y, 44, 44, color, 0.3);
      marker.setStrokeStyle(2, color, 0.8);
      const text = this.add.text(structure.x, structure.y - 32, structure.label, {
        fontSize: '14px',
        color: '#f8fafc',
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        padding: { x: 4, y: 2 },
      }).setOrigin(0.5);
      this.structureMarkers.push({
        ...structure,
        marker,
        text,
        radius: structure.radius || INTERACT_RADIUS,
      });
    });
  }

  createCampNpcs(npcs) {
    if (Array.isArray(this.campNpcMarkers)) {
      this.campNpcMarkers.forEach((entry) => {
        entry.marker?.destroy();
        entry.text?.destroy();
      });
    }
    this.campNpcMarkers = [];
    this.campWardenById = new Map();
    if (!Array.isArray(npcs)) {
      return;
    }

    npcs.forEach((npc) => {
      if (typeof npc.x !== 'number' || typeof npc.y !== 'number') {
        return;
      }
      const marker = this.add.rectangle(npc.x, npc.y, 26, 34, npc.color ?? 0x94a3b8, 0.8);
      marker.setStrokeStyle(2, npc.color ?? 0x38bdf8, 0.6);
      const text = this.add.text(npc.x, npc.y - 28, npc.label || 'Warden', {
        fontSize: '12px',
        color: '#e2e8f0',
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        padding: { x: 4, y: 2 },
      }).setOrigin(0.5);
      const entry = { ...npc, marker, text };
      this.campNpcMarkers.push(entry);
      if (npc.id) {
        this.campWardenById.set(npc.id, entry);
      }
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
      bg.setDisplaySize(this.worldBounds.width, this.worldBounds.height);
      if (background.tint) {
        bg.setTint(background.tint);
      }
      this.backgroundLayer.add(bg);
    } else {
      const fill = background.color ?? 0x1f2937;
      const rect = this.add.rectangle(0, 0, this.worldBounds.width, this.worldBounds.height, fill);
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
    let nextX = this.player.x;
    let nextY = this.player.y;

    if (this.cursors.left.isDown) {
      nextX -= speed * deltaSeconds;
      movedWithKeys = true;
    }
    if (this.cursors.right.isDown) {
      nextX += speed * deltaSeconds;
      movedWithKeys = true;
    }
    if (this.cursors.up.isDown) {
      nextY -= speed * deltaSeconds;
      movedWithKeys = true;
    }
    if (this.cursors.down.isDown) {
      nextY += speed * deltaSeconds;
      movedWithKeys = true;
    }

    if (movedWithKeys) {
      this.targetPoint = null;
      this.targetMarker.setVisible(false);
    } else if (this.targetPoint) {
      const next = moveToward(this.player, this.targetPoint, speed, deltaSeconds);
      nextX = next.x;
      nextY = next.y;
      if (next.arrived) {
        this.targetPoint = null;
        this.targetMarker.setVisible(false);
        this.appendLog('Reached target.');
      }
    }

    const constrained = this.constrainToWalls(nextX, nextY);
    const bounded = this.clampToWorld(constrained.x, constrained.y);
    this.player.setPosition(bounded.x, bounded.y);
  }

  clampToWorld(x, y) {
    return {
      x: Phaser.Math.Clamp(x, 0, this.worldBounds.width),
      y: Phaser.Math.Clamp(y, 0, this.worldBounds.height),
    };
  }

  constrainToWalls(nextX, nextY) {
    const wallsLayer = this.mapLayers.walls;
    if (!wallsLayer) {
      return { x: nextX, y: nextY };
    }

    let resolvedX = nextX;
    let resolvedY = nextY;

    if (this.isPositionBlocked(resolvedX, this.player.y, wallsLayer)) {
      resolvedX = this.player.x;
    }
    if (this.isPositionBlocked(resolvedX, resolvedY, wallsLayer)) {
      resolvedY = this.player.y;
    }

    return { x: resolvedX, y: resolvedY };
  }

  isPositionBlocked(x, y, wallsLayer) {
    const body = this.player.body;
    const halfWidth = body?.width ? body.width / 2 : this.player.displayWidth / 2;
    const halfHeight = body?.height ? body.height / 2 : this.player.displayHeight / 2;
    const points = [
      { x: x - halfWidth, y: y - halfHeight },
      { x: x + halfWidth, y: y - halfHeight },
      { x: x - halfWidth, y: y + halfHeight },
      { x: x + halfWidth, y: y + halfHeight },
    ];

    return points.some((point) => {
      const tile = wallsLayer.getTileAtWorldXY(point.x, point.y);
      return tile && tile.collides;
    });
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
      nearbyContact: this.getNearbyContact(),
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
    const interaction = this.getNearestInteractable(context);
    this.currentInteractable = interaction?.interactable || null;
    context.interactionPrompt = interaction
      ? {
        text: interaction.text,
        reason: interaction.reason,
        enabled: interaction.canInteract,
      }
      : null;
    if (this.domHud) {
      this.domHud.update(this.state, context);
    }

    if (this.state.victory) {
      this.victoryOverlay.setVisible(true);
    }
    if (this.state.gameOver) {
      this.gameOverOverlay.setVisible(true);
    }
  }

  getNearbyContact() {
    if (!Array.isArray(this.locations)) {
      return null;
    }
    const nearby = this.locations
      .map((location) => ({
        location,
        distance:
          typeof location.x === 'number' && typeof location.y === 'number'
            ? Phaser.Math.Distance.Between(
              this.player.x,
              this.player.y,
              location.x,
              location.y
            )
            : Infinity,
      }))
      .filter((entry) => entry.distance <= INTERACT_RADIUS);
    if (nearby.length === 0) {
      return null;
    }
    nearby.sort((a, b) => a.distance - b.distance);
    const loc = nearby[0]?.location;
    return loc?.contactId ? loc : null;
  }

  getOnboardingFlags() {
    if (!this.state.onboardingFlags || typeof this.state.onboardingFlags !== 'object') {
      this.state.onboardingFlags = {
        packWardenSeen: false,
        cityWardenSeen: false,
        timeWardenSeen: false,
      };
    }
    return this.state.onboardingFlags;
  }

  getWardenTriggerDistance(wardenId, structureId) {
    const distances = [];
    const warden = this.campWardenById?.get(wardenId);
    if (warden && typeof warden.x === 'number' && typeof warden.y === 'number') {
      const distance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        warden.x,
        warden.y
      );
      if (distance <= INTERACT_RADIUS) {
        distances.push(distance);
      }
    }
    if (structureId && Array.isArray(this.structureMarkers)) {
      const structure = this.structureMarkers.find((entry) => entry.id === structureId);
      if (structure && typeof structure.x === 'number' && typeof structure.y === 'number') {
        const distance = Phaser.Math.Distance.Between(
          this.player.x,
          this.player.y,
          structure.x,
          structure.y
        );
        if (distance <= (structure.radius || INTERACT_RADIUS)) {
          distances.push(distance);
        }
      }
    }
    if (distances.length === 0) {
      return null;
    }
    return Math.min(...distances);
  }

  getWardenLine(warden) {
    if (!warden) {
      return '';
    }
    if (warden.id === 'warden_city' && this.state.campPop > 0 && warden.campLine) {
      return warden.campLine;
    }
    return warden.introLine || '';
  }

  triggerWardenLine(wardenId) {
    const flagKey = WARDEN_FLAG_BY_ID[wardenId];
    if (!flagKey) {
      return false;
    }
    const flags = this.getOnboardingFlags();
    if (flags[flagKey]) {
      return false;
    }
    const warden = this.campWardenById?.get(wardenId);
    const line = this.getWardenLine(warden);
    if (!line) {
      return false;
    }
    this.domHud?.showWardenLine(line, 2500);
    this.wardenLineCooldownUntil = window.performance.now() + 2600;
    flags[flagKey] = true;
    saveGameState(this.state);
    return true;
  }

  getNearestInteractable(context) {
    if (!this.player) {
      return null;
    }
    const candidates = [];
    const addCandidate = (candidate) => {
      if (!candidate) {
        return;
      }
      candidates.push({
        priority: candidate.priority ?? 1,
        ...candidate,
      });
    };

    if (this.currentDistrict?.id === 'camp') {
      const flags = this.getOnboardingFlags();
      const addWardenCandidate = (wardenId, structureId) => {
        const flagKey = WARDEN_FLAG_BY_ID[wardenId];
        if (!flagKey || flags[flagKey]) {
          return;
        }
        const distance = this.getWardenTriggerDistance(wardenId, structureId);
        if (distance === null) {
          return;
        }
        const warden = this.campWardenById?.get(wardenId);
        const label = warden?.label || 'Warden';
        addCandidate({
          distance,
          text: `[F] Speak with ${label}`,
          reason: '',
          canInteract: true,
          priority: 0,
          interactable: {
            onInteract: () => this.triggerWardenLine(wardenId),
            canInteract: true,
          },
        });
      };

      addWardenCandidate('warden_pack', 'stable');
      addWardenCandidate('warden_time', 'house');
      addWardenCandidate('warden_city');
    }

    if (this.state.phase === 'DAY' && Array.isArray(this.locations)) {
      const collected =
        this.state.dayCollectedByDistrict?.[this.state.currentDistrictId] || {};
      this.locations.forEach((location) => {
        if (typeof location.x !== 'number' || typeof location.y !== 'number') {
          return;
        }
        const distance = Phaser.Math.Distance.Between(
          this.player.x,
          this.player.y,
          location.x,
          location.y
        );
        if (distance > INTERACT_RADIUS) {
          return;
        }
        const alreadyCollected = Boolean(collected[location.contactId]);
        const reason =
          this.state.dayActionsRemaining <= 0
            ? 'No actions remaining'
            : alreadyCollected
              ? 'Already collected today'
              : '';
        addCandidate({
          distance,
          text: `[F] Speak with ${location.label}`,
          reason,
          canInteract: !reason,
          interactable: {
            onInteract: () => this.handleCollect(location.contactId),
            canInteract: !reason,
          },
        });
      });
    }

    if (this.state.phase === 'NIGHT') {
      const activePois = this.getActivePois().filter((poi) => poi.type !== 'SHRINE');
      activePois.forEach((poi) => {
        const distance = Phaser.Math.Distance.Between(
          this.player.x,
          this.player.y,
          poi.x,
          poi.y
        );
        if (distance > (poi.radius || INTERACT_RADIUS)) {
          return;
        }
        const actionLabel = this.getPoiActionLabel(poi.type);
        const cost = this.getPoiActionCost(poi.type, poi);
        let reason = '';
        if (this.state.packStamina < cost) {
          reason = 'Not enough stamina';
        } else if (poi.type === 'RUCKUS' && this.state.packPower < 2) {
          reason = 'Not enough power';
        }
        addCandidate({
          distance,
          text: `[F] ${actionLabel}`,
          reason,
          canInteract: !reason,
          interactable: {
            onInteract: () => this.handlePoiAction(poi.type),
            canInteract: !reason,
          },
        });
      });
    }

    if (context?.nearestShrine && context.nearestShrineInRange) {
      const reason = context.nearestShrine.prayedToday ? 'Already collected today' : '';
      addCandidate({
        distance: context.nearestShrineDistance || 0,
        text: '[F] Pray',
        reason,
        canInteract: !reason,
        interactable: {
          onInteract: () => this.handlePray(),
          canInteract: !reason,
        },
      });
    }

    if (Array.isArray(this.structureMarkers) && this.structureMarkers.length > 0) {
      this.structureMarkers.forEach((structure) => {
        const distance = Phaser.Math.Distance.Between(
          this.player.x,
          this.player.y,
          structure.x,
          structure.y
        );
        if (distance > (structure.radius || INTERACT_RADIUS)) {
          return;
        }
        const actionLabel = structure.id === 'house'
          ? this.state.phase === 'DAY'
            ? 'Rest (End Day / Start Night)'
            : 'Rest (End Night / Start Day)'
          : structure.action || 'Interact';
        addCandidate({
          distance,
          text: `[F] ${actionLabel}`,
          reason: '',
          canInteract: true,
          interactable: {
            onInteract:
              structure.id === 'house'
                ? () => this.handleHouseRest()
                : () => this.handleStableInteract(),
            canInteract: true,
          },
        });
      });
    }

    if (candidates.length === 0) {
      return null;
    }
    candidates.sort((a, b) => {
      const priorityDelta = (a.priority ?? 1) - (b.priority ?? 1);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      return a.distance - b.distance;
    });
    return candidates[0];
  }

  handleInteract() {
    if (this.inputLocked || this.state.victory || this.state.gameOver) {
      return;
    }
    if (!this.currentInteractable) {
      return;
    }
    if (this.currentInteractable.canInteract === false) {
      return;
    }
    if (!this.currentInteractable.onInteract) {
      return;
    }
    this.currentInteractable.onInteract();
  }

  openStableView() {
    if (this.stableViewOpen || this.draftOverlayOpen || !this.stableOverlay) {
      return;
    }
    this.stableViewOpen = true;
    this.stableOverlay.setVisible(true);
    this.inputLocked = true;
    if (this.domHud) {
      this.domHud.setInteractionLocked(true);
    }
    this.renderStableView();
  }

  closeStableView() {
    if (!this.stableViewOpen) {
      return;
    }
    this.stableViewOpen = false;
    this.stableOverlay?.setVisible(false);
    this.stableSelectionId = null;
    this.inputLocked = false;
    if (this.domHud) {
      this.domHud.setInteractionLocked(false);
    }
  }

  getStableFeedAllocations(id) {
    if (!this.stableFeedAllocations[id]) {
      this.stableFeedAllocations[id] = { scraps: 0, fatty: 0 };
    }
    return this.stableFeedAllocations[id];
  }

  adjustStableFeeding(id, type, delta) {
    const allocation = this.getStableFeedAllocations(id);
    const totalAllocated = Object.values(this.stableFeedAllocations).reduce(
      (sum, entry) => sum + (entry[type] || 0),
      0
    );
    const supply =
      type === 'scraps' ? this.state.foodScraps : this.state.foodFatty;
    if (delta > 0 && totalAllocated >= supply) {
      return;
    }
    allocation[type] = Math.max(0, allocation[type] + delta);
    this.renderStableView();
  }

  confirmStableFeeding() {
    const feedPlan = Object.entries(this.stableFeedAllocations).map(([id, alloc]) => ({
      id,
      scraps: alloc.scraps || 0,
      fatty: alloc.fatty || 0,
    }));
    if (!feedHyenas(this.state, feedPlan)) {
      return;
    }
    feedPlan.forEach((entry) => {
      const total = (entry.scraps || 0) + (entry.fatty || 0);
      if (total <= 0) {
        return;
      }
      const hyena = this.state.hyenaRoster.find((member) => member.id === entry.id);
      const name = hyena ? hyena.name : 'Hyena';
      addEvent(
        this.state,
        `Fed ${name} (${entry.scraps || 0} scraps, ${entry.fatty || 0} fatty).`
      );
    });
    Object.values(this.stableFeedAllocations).forEach((alloc) => {
      alloc.scraps = 0;
      alloc.fatty = 0;
    });
    applyFactionInfluence(this.state, 'feed');
    this.updateHud();
    this.renderStableView();
    saveGameState(this.state);
  }

  assignRosterToSlot(slotIndex) {
    if (!this.stableSelectionId) {
      return;
    }
    const next = [...(this.state.activePackIds || [])];
    const existingIndex = next.indexOf(this.stableSelectionId);
    if (existingIndex !== -1) {
      next.splice(existingIndex, 1);
    }
    next[slotIndex] = this.stableSelectionId;
    const compacted = next.filter(Boolean).slice(0, this.state.packSizeCap);
    this.state.activePackIds = compacted;
    syncActivePack(this.state);
    this.updateHud();
    this.renderStableView();
    saveGameState(this.state);
  }

  renderStableView() {
    if (!this.stableContent) {
      return;
    }
    this.stableContent.removeAll(true);
    const width = this.scale.width;
    const height = this.scale.height;
    const margin = 40;
    const panelGap = 20;
    const panelWidth = (width - margin * 2 - panelGap * 2) / 3;
    const panelHeight = height - margin * 2 - 60;

    const title = this.add
      .text(width / 2, margin - 10, 'Stable Command Deck', {
        fontSize: '28px',
        color: '#f8fafc',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const closeButton = this.add
      .text(width - margin - 10, margin - 10, 'ESC to Close', {
        fontSize: '14px',
        color: '#e2e8f0',
      })
      .setOrigin(1, 0.5);

    this.stableContent.add([title, closeButton]);

    const addPanel = (x, y, label) => {
      const panel = this.add.rectangle(x, y, panelWidth, panelHeight, 0x111827, 0.9);
      panel.setOrigin(0, 0);
      panel.setStrokeStyle(2, 0x38bdf8, 0.6);
      const header = this.add.text(x + 16, y + 12, label, {
        fontSize: '16px',
        color: '#f8fafc',
        fontStyle: 'bold',
      });
      this.stableContent.add([panel, header]);
      return { x, y, header };
    };

    const packPanel = addPanel(margin, margin + 20, 'Active Pack');
    const rosterPanel = addPanel(margin + panelWidth + panelGap, margin + 20, 'Roster');
    const supplyPanel = addPanel(margin + (panelWidth + panelGap) * 2, margin + 20, 'Supplies');
    const packCapText = this.add.text(
      packPanel.x + panelWidth - 20,
      packPanel.y + 14,
      `Cap ${this.state.packSizeCap}`,
      { fontSize: '12px', color: '#94a3b8' }
    ).setOrigin(1, 0);
    this.stableContent.add(packCapText);

    const activePack = getActivePack(this.state);
    const packSlots = Array.from({ length: this.state.packSizeCap }, (_, idx) => activePack[idx] || null);
    packSlots.forEach((hyena, idx) => {
      const slotY = packPanel.y + 50 + idx * 70;
      const slotRect = this.add.rectangle(
        packPanel.x + 16,
        slotY,
        panelWidth - 32,
        54,
        hyena ? 0x1e293b : 0x0f172a,
        0.95
      );
      slotRect.setOrigin(0, 0);
      slotRect.setStrokeStyle(1, this.stableSelectionId ? 0x38bdf8 : 0x334155, 0.6);
      slotRect.setInteractive({ useHandCursor: true });
      slotRect.on('pointerdown', () => this.assignRosterToSlot(idx));

      const nameText = this.add.text(
        packPanel.x + 28,
        slotY + 8,
        hyena ? `${hyena.name} (${hyena.role})` : `Empty Slot ${idx + 1}`,
        { fontSize: '14px', color: '#e2e8f0' }
      );
      const detailText = this.add.text(
        packPanel.x + 28,
        slotY + 28,
        hyena ? `Temperament: ${hyena.temperament}` : 'Assign from roster',
        { fontSize: '12px', color: '#94a3b8' }
      );
      this.stableContent.add([slotRect, nameText, detailText]);
    });

    const rosterStartY = rosterPanel.y + 50;
    const roster = Array.isArray(this.state.hyenaRoster) ? this.state.hyenaRoster : [];
    roster.forEach((hyena, index) => {
      const rowY = rosterStartY + index * 48;
      if (rowY > rosterPanel.y + panelHeight - 40) {
        return;
      }
      const isSelected = this.stableSelectionId === hyena.id;
      const rowRect = this.add.rectangle(
        rosterPanel.x + 16,
        rowY,
        panelWidth - 32,
        38,
        isSelected ? 0x38bdf8 : 0x1e293b,
        0.85
      );
      rowRect.setOrigin(0, 0);
      rowRect.setStrokeStyle(1, 0x334155, 0.6);
      rowRect.setInteractive({ useHandCursor: true });
      rowRect.on('pointerdown', () => {
        this.stableSelectionId = hyena.id;
        this.renderStableView();
      });

      const rowText = this.add.text(
        rosterPanel.x + 26,
        rowY + 10,
        `${hyena.name} • ${hyena.role}`,
        { fontSize: '13px', color: isSelected ? '#0f172a' : '#e2e8f0' }
      );
      this.stableContent.add([rowRect, rowText]);
    });

    const suppliesY = supplyPanel.y + 50;
    const suppliesText = this.add.text(
      supplyPanel.x + 16,
      suppliesY,
      `Scraps: ${this.state.foodScraps}\nFatty: ${this.state.foodFatty}\nSupplies Tier: ${this.state.suppliesTier}`,
      { fontSize: '14px', color: '#e2e8f0', lineSpacing: 6 }
    );

    const baseStamina = Math.max(
      0,
      packRules.PACK_BASE_STAMINA - (this.state.hyenaStaminaBasePenalty || 0)
    );
    const suppliesBonus = Math.max(0, this.state.suppliesTier || 1);
    const previewTotals = activePack.reduce(
      (totals, hyena) => {
        const alloc = this.getStableFeedAllocations(hyena.id);
        const previewHyena = {
          ...hyena,
          fedToday: {
            scraps: (hyena.fedToday?.scraps || 0) + (alloc.scraps || 0),
            fatty: (hyena.fedToday?.fatty || 0) + (alloc.fatty || 0),
          },
        };
        const contribution = getHyenaContribution(previewHyena);
        return {
          stamina: totals.stamina + contribution.stamina,
          power: totals.power + contribution.power,
        };
      },
      { stamina: 0, power: 0 }
    );
    const previewText = this.add.text(
      supplyPanel.x + 16,
      suppliesY + 90,
      `Preview Tonight:\nStamina ${baseStamina + previewTotals.stamina + suppliesBonus}\nPower ${packRules.PACK_BASE_POWER + previewTotals.power}`,
      { fontSize: '14px', color: '#f8fafc', lineSpacing: 6 }
    );

    const feedHeader = this.add.text(
      supplyPanel.x + 16,
      suppliesY + 170,
      'Feeding Tray (Active Pack)',
      { fontSize: '14px', color: '#f8fafc', fontStyle: 'bold' }
    );

    let feedRowY = suppliesY + 200;
    activePack.forEach((hyena) => {
      const alloc = this.getStableFeedAllocations(hyena.id);
      const rowLabel = this.add.text(
        supplyPanel.x + 16,
        feedRowY,
        `${hyena.name}`,
        { fontSize: '13px', color: '#e2e8f0' }
      );
      const scrapsLabel = this.add.text(
        supplyPanel.x + 120,
        feedRowY,
        `Scraps ${alloc.scraps}`,
        { fontSize: '12px', color: '#94a3b8' }
      );
      const fattyLabel = this.add.text(
        supplyPanel.x + 210,
        feedRowY,
        `Fatty ${alloc.fatty}`,
        { fontSize: '12px', color: '#94a3b8' }
      );

      const createAdjust = (x, label, onClick) => {
        const size = 22;
        const rect = this.add.rectangle(x, feedRowY + 8, size, size, 0x38bdf8, 0.9);
        rect.setOrigin(0, 0);
        rect.setInteractive(
          new Phaser.Geom.Rectangle(0, 0, size, size),
          Phaser.Geom.Rectangle.Contains
        );
        rect.on('pointerdown', onClick);
        const text = this.add.text(x + size / 2, feedRowY + 8 + size / 2, label, {
          fontSize: '12px',
          color: '#0f172a',
        }).setOrigin(0.5);
        this.stableContent.add([rect, text]);
      };

      createAdjust(supplyPanel.x + 190, '+', () => this.adjustStableFeeding(hyena.id, 'scraps', 1));
      createAdjust(supplyPanel.x + 230, '+', () => this.adjustStableFeeding(hyena.id, 'fatty', 1));
      createAdjust(supplyPanel.x + 170, '-', () => this.adjustStableFeeding(hyena.id, 'scraps', -1));
      createAdjust(supplyPanel.x + 250, '-', () => this.adjustStableFeeding(hyena.id, 'fatty', -1));

      this.stableContent.add([rowLabel, scrapsLabel, fattyLabel]);
      feedRowY += 50;
    });

    const confirmButton = this.add.rectangle(
      supplyPanel.x + 16,
      supplyPanel.y + panelHeight - 60,
      panelWidth - 32,
      36,
      0x38bdf8,
      0.9
    );
    confirmButton.setOrigin(0, 0);
    confirmButton.setInteractive({ useHandCursor: true });
    confirmButton.on('pointerdown', () => this.confirmStableFeeding());
    const confirmText = this.add.text(
      supplyPanel.x + panelWidth / 2,
      supplyPanel.y + panelHeight - 42,
      this.state.phase === 'DAY' ? 'Confirm Feeding (1 Action)' : 'Feeding Locked (Night)',
      {
        fontSize: '13px',
        color: this.state.phase === 'DAY' ? '#0f172a' : '#94a3b8',
        fontStyle: 'bold',
      }
    ).setOrigin(0.5);
    if (this.state.phase !== 'DAY' || this.state.dayActionsRemaining <= 0) {
      confirmButton.setFillStyle(0x475569, 0.6);
      confirmButton.disableInteractive();
      if (this.state.phase === 'DAY' && this.state.dayActionsRemaining <= 0) {
        confirmText.setText('No Actions Remaining').setColor('#94a3b8');
      }
    }

    this.stableContent.add([suppliesText, previewText, feedHeader, confirmButton, confirmText]);
  }

  refreshDraftOverlay() {
    if (!this.state.draftPending) {
      if (this.draftOverlayOpen) {
        this.closeDraftOverlay();
      }
      return;
    }
    if (!this.draftOverlayOpen) {
      this.ensureDraftCamp();
      this.openDraftOverlay();
    } else {
      this.renderDraftOverlay();
    }
  }

  ensureDraftCamp() {
    if (this.state.currentDistrictId === 'camp') {
      return;
    }
    const campConfig = getDistrictConfig('camp');
    const spawn = campConfig?.spawn || { x: 400, y: 500 };
    this.applyDistrictTransition({ spawnX: spawn.x, spawnY: spawn.y }, campConfig);
  }

  openDraftOverlay() {
    if (!this.draftOverlay) {
      return;
    }
    if (this.stableViewOpen) {
      this.closeStableView();
    }
    this.draftOverlayOpen = true;
    this.draftOverlay.setVisible(true);
    this.inputLocked = true;
    if (this.domHud) {
      this.domHud.setInteractionLocked(true);
    }
    addEvent(this.state, 'Draft Phase triggered.');
    this.renderDraftOverlay();
  }

  closeDraftOverlay() {
    if (!this.draftOverlayOpen) {
      return;
    }
    this.draftOverlayOpen = false;
    this.draftOverlay?.setVisible(false);
    this.inputLocked = false;
    if (this.domHud) {
      this.domHud.setInteractionLocked(false);
    }
  }

  recruitDraftHyena(candidate, addToPack) {
    if (!candidate) {
      return;
    }
    this.state.hyenaRoster = Array.isArray(this.state.hyenaRoster)
      ? [...this.state.hyenaRoster, candidate]
      : [candidate];
    if (addToPack && this.state.activePackIds.length < this.state.packSizeCap) {
      this.state.activePackIds.push(candidate.id);
    }
    syncActivePack(this.state);
    this.state.draftPending = false;
    this.state.draftActive = false;
    this.state.draftChoices = [];
    addEvent(this.state, `Drafted ${candidate.name} (${candidate.role}).`);
    saveGameState(this.state);
    this.closeDraftOverlay();
    this.updateHud();
  }

  renderDraftOverlay() {
    if (!this.draftContent) {
      return;
    }
    this.draftContent.removeAll(true);
    const width = this.scale.width;
    const height = this.scale.height;
    const title = this.add.text(width / 2, 120, 'Draft Phase', {
      fontSize: '32px',
      color: '#f8fafc',
      fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0);
    const subtitle = this.add.text(width / 2, 160, 'Choose a new hyena for the roster.', {
      fontSize: '16px',
      color: '#cbd5f5',
    }).setOrigin(0.5).setScrollFactor(0);
    this.draftContent.add([title, subtitle]);

    const choices = Array.isArray(this.state.draftChoices) ? this.state.draftChoices : [];
    const cardWidth = 220;
    const cardHeight = 220;
    const gap = 30;
    const totalWidth = choices.length * cardWidth + (choices.length - 1) * gap;
    const startX = (width - totalWidth) / 2;

    choices.forEach((choice, index) => {
      const x = startX + index * (cardWidth + gap);
      const y = 220;
      const card = this.add.rectangle(x, y, cardWidth, cardHeight, 0x111827, 0.95);
      card.setOrigin(0, 0);
      card.setScrollFactor(0);
      card.setStrokeStyle(2, 0x38bdf8, 0.7);

      const name = this.add.text(x + 16, y + 16, choice.name, {
        fontSize: '18px',
        color: '#f8fafc',
        fontStyle: 'bold',
      }).setScrollFactor(0);
      const role = this.add.text(x + 16, y + 46, choice.role, {
        fontSize: '14px',
        color: '#38bdf8',
      }).setScrollFactor(0);
      const temperament = this.add.text(x + 16, y + 70, `Temperament: ${choice.temperament}`, {
        fontSize: '12px',
        color: '#cbd5f5',
      }).setScrollFactor(0);
      const traitText = Array.isArray(choice.traits) && choice.traits.length > 0
        ? `Traits: ${choice.traits.join(', ')}`
        : 'Traits: None';
      const traits = this.add.text(x + 16, y + 94, traitText, {
        fontSize: '12px',
        color: '#94a3b8',
        wordWrap: { width: cardWidth - 32 },
      }).setScrollFactor(0);

      const addToPackAvailable = this.state.activePackIds.length < this.state.packSizeCap;
      const recruitButton = this.add.rectangle(x + 16, y + 150, cardWidth - 32, 28, 0x38bdf8, 0.9);
      recruitButton.setOrigin(0, 0);
      recruitButton.setScrollFactor(0);
      recruitButton.setInteractive({ useHandCursor: true });
      recruitButton.on('pointerdown', () => this.recruitDraftHyena(choice, false));
      const recruitText = this.add.text(x + cardWidth / 2, y + 164, 'Recruit', {
        fontSize: '13px',
        color: '#0f172a',
        fontStyle: 'bold',
      }).setOrigin(0.5).setScrollFactor(0);

      this.draftContent.add([card, name, role, temperament, traits, recruitButton, recruitText]);

      if (addToPackAvailable) {
        const packButton = this.add.rectangle(x + 16, y + 184, cardWidth - 32, 28, 0xfbbf24, 0.9);
        packButton.setOrigin(0, 0);
        packButton.setScrollFactor(0);
        packButton.setInteractive({ useHandCursor: true });
        packButton.on('pointerdown', () => this.recruitDraftHyena(choice, true));
        const packText = this.add.text(x + cardWidth / 2, y + 198, 'Recruit + Add to Pack', {
          fontSize: '12px',
          color: '#0f172a',
          fontStyle: 'bold',
        }).setOrigin(0.5).setScrollFactor(0);
        this.draftContent.add([packButton, packText]);
      }
    });
  }

  handleStableInteract() {
    this.openStableView();
  }

  handleHouseRest() {
    if (this.currentDistrict?.id !== 'camp') {
      return;
    }
    if (this.state.phase === 'DAY') {
      const confirmed = window.confirm('Begin Night Watch?');
      if (confirmed) {
        this.handleStartNight();
      }
    } else {
      const confirmed = window.confirm('Sleep until Dawn?');
      if (confirmed) {
        this.handleEndNight();
      }
    }
  }

  handleGatewayOverlap(gateway) {
    if (this.isTransitioning || this.inputLocked) {
      return;
    }
    if (this.wardenLineCooldownUntil && window.performance.now() < this.wardenLineCooldownUntil) {
      return;
    }
    if (!gateway || gateway.toDistrictId === this.state.currentDistrictId) {
      return;
    }
    if (this.currentDistrict?.id === 'camp' && !this.getOnboardingFlags().cityWardenSeen) {
      if (this.triggerWardenLine('warden_city')) {
        return;
      }
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
    this.createStructures(districtConfig.campStructures);
    this.createCampNpcs(districtConfig.campNpcs);
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
      const contactData = getContactById(locationKey);
      const contactName = contactData?.name || 'Contact';
      addEvent(this.state, `Collected supplies from ${contactName}.`);
      const voiceLine = getContactVoiceLine(contactData, this.state);
      if (voiceLine) {
        addEvent(this.state, `${contactName}: ${voiceLine}`);
      }
      applyFactionInfluence(this.state, 'collect', {
        location: contactData?.legacySlot || locationKey,
        contactId: locationKey,
        factionId: contactData?.factionId,
      });
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
    if (this.currentDistrict?.id !== 'camp') {
      return;
    }
    const previousPhase = this.state.phase;
    startNight(this.state);
    spawnPoisForNight(this.state, this.currentDistrict);
    addEvent(this.state, 'Night falls over Jugol’s Rest.');
    applyFactionInfluence(this.state, 'start_night');
    saveGameState(this.state);
    this.playPhaseTransition(previousPhase, this.state.phase);
    this.syncPoiMarkers(true);
    this.handleNarrativePhaseStart();
    this.updateHud();
    this.refreshDraftOverlay();
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
    if (this.currentDistrict?.id !== 'camp') {
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
    this.refreshDraftOverlay();
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

  getPoiActionLabel(type) {
    switch (type) {
      case 'OVERGROWTH':
        return 'Clear Overgrowth';
      case 'ROUTE':
        return 'Guard Route';
      case 'RUCKUS':
        return 'Suppress Threat';
      case 'LOT':
        return 'Secure Lot';
      default:
        return 'Respond';
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
