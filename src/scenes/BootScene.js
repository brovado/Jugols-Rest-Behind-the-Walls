export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    this.load.image('city', 'src/assets/city_background.png');
    this.load.image('platforms', 'src/assets/platforms.png');
    this.load.image('player', 'src/assets/sprite.png');
    this.load.image('roguelikeSheet', 'src/assets/images/roguelikeSheet_transparent.png');
    this.load.tilemapTiledJSON('heart_district', 'src/assets/maps/heart_district.json');
  }

  create() {
    this.scene.start('TitleScene');
  }
}
