export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    this.load.image('city', 'src/assets/images/roguelikeSheet_transparent.png');
    this.load.image('platforms', 'src/assets/images/roguelikeSheet_transparent.png');
    this.load.spritesheet('player', 'src/assets/images/roguelikeSheet_transparent.png', {
      frameWidth: 16,
      frameHeight: 16,
      spacing: 1,
      margin: 1,
    });
    this.load.image('roguelikeSheet', 'src/assets/images/roguelikeSheet_transparent.png');
    this.load.tilemapTiledJSON('camp', 'src/assets/maps/camp.tmj');
    this.load.tilemapTiledJSON('heart_district', 'src/assets/maps/heart_district.json');
  }

  create() {
    this.scene.start('TitleScene');
  }
}
