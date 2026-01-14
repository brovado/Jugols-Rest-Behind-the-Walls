export default class IntroScene extends Phaser.Scene {
  constructor() {
    super({ key: 'IntroScene' });
  }

  create(data = {}) {
    const { width, height } = this.scale;

    const bg = this.add.graphics();
    bg.fillGradientStyle(0x020617, 0x0f172a, 0x020617, 0x0b1120, 0.98);
    bg.fillRect(0, 0, width, height);

    const card = this.add
      .rectangle(width / 2, height / 2, 720, 360, 0x0b1120, 0.96)
      .setStrokeStyle(2, 0x38bdf8, 1);

    const title = this.add.text(width / 2, height / 2 - 130, 'Jugol’s Rest, Behind the Walls', {
      fontSize: '30px',
      color: '#f8fafc',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);

    const lore = [
      'Nightly wardens keep Jugol’s Rest from collapse.',
      'Living and spirit hyenas prowl the inner walls together.',
      'By day, gather scraps and offerings to feed the pack.',
      'By night, deploy them to clear overgrowth, guard routes, and suppress threats.',
      'Keep them fed, and the walls will hold.',
    ];

    const loreText = this.add.text(width / 2, height / 2 - 40, lore.join('\n'), {
      fontSize: '18px',
      color: '#cbd5f5',
      align: 'center',
      lineSpacing: 10,
    }).setOrigin(0.5);

    const prompt = this.add.text(width / 2, height / 2 + 120, 'Press Space or Click to Begin', {
      fontSize: '18px',
      color: '#facc15',
    }).setOrigin(0.5);

    this.tweens.add({
      targets: prompt,
      alpha: 0.4,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.add.container(0, 0, [card, title, loreText, prompt]);

    const proceed = () => {
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('GameScene', { loadSave: false, ...data });
      });
    };

    this.input.keyboard.once('keydown-SPACE', proceed);
    this.input.once('pointerdown', (pointer) => {
      pointer.event?.stopPropagation?.();
      proceed();
    });

    this.cameras.main.fadeIn(400, 0, 0, 0);
  }
}
