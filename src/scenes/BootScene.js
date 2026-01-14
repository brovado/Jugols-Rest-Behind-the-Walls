export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    this.load.image('city', 'src/assets/city_background.png');
    this.load.image('platforms', 'src/assets/platforms.png');
    this.load.image('player', 'src/assets/sprite.png');
  }

  create() {
    this.scene.start('TitleScene');
  }
}
