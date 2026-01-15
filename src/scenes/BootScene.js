export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    this.load.image('city', 'src/assets/images/roguelikeSheet_transparent.png');
    this.load.image('platforms', 'src/assets/images/roguelikeSheet_transparent.png');
    this.load.image('player', 'assets/images/roguelikeChar_transparent.png');
    this.load.image('roguelikeSheet', 'src/assets/images/roguelikeSheet_transparent.png');
    this.load.tilemapTiledJSON('camp', 'src/assets/maps/camp.tmj');
    this.load.tilemapTiledJSON('heart_district', 'src/assets/maps/heart_district.json');
  }

  create() {
    this.scene.start('TitleScene');
  }
}
