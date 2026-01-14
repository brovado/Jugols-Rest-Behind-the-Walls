import { createButton } from '../ui/components.js';
import { hasSavedGame } from '../state/gameState.js';

const VERSION = 'v0.1.0';

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
    this.buttons = [];
  }

  create() {
    const { width, height } = this.scale;

    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0f172a, 0x1e293b, 0x020617, 0x0b1120, 0.98);
    bg.fillRect(0, 0, width, height);

    const titleText = this.add.text(width / 2, height / 2 - 180, 'Jugol’s Rest:\nBehind the Walls', {
      fontSize: '52px',
      color: '#f8fafc',
      align: 'center',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const subtitle = this.add.text(width / 2, height / 2 - 90, 'The wall still stands, for now.', {
      fontSize: '18px',
      color: '#cbd5f5',
    }).setOrigin(0.5);

    const buttonStartY = height / 2 - 10;
    const buttonSpacing = 54;

    const newRunButton = createButton(this, {
      x: width / 2 - 120,
      y: buttonStartY,
      width: 240,
      height: 42,
      label: 'New Run',
      onClick: () => this.startGame('IntroScene', { loadSave: false }),
    });

    const continueButton = createButton(this, {
      x: width / 2 - 120,
      y: buttonStartY + buttonSpacing,
      width: 240,
      height: 42,
      label: 'Continue',
      onClick: () => this.startGame('GameScene', { loadSave: true }),
    });

    const settingsButton = createButton(this, {
      x: width / 2 - 120,
      y: buttonStartY + buttonSpacing * 2,
      width: 240,
      height: 42,
      label: 'Settings',
      onClick: () => {
        this.flashNotice('Settings are on the way.');
      },
    });

    this.buttons = [newRunButton, continueButton, settingsButton];

    if (!hasSavedGame()) {
      continueButton.setEnabled(false);
    }

    const versionLabel = this.add.text(width - 20, height - 24, VERSION, {
      fontSize: '14px',
      color: '#94a3b8',
    }).setOrigin(1, 1);

    this.add.container(0, 0, [titleText, subtitle, newRunButton, continueButton, settingsButton, versionLabel]);

    this.cameras.main.fadeIn(600, 0, 0, 0);
  }

  startGame(sceneKey, data) {
    this.buttons.forEach((button) => button.setEnabled(false));
    this.cameras.main.fadeOut(600, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(sceneKey, data);
    });
  }

  flashNotice(message) {
    const { width, height } = this.scale;
    const notice = this.add.text(width / 2, height / 2 + 170, message, {
      fontSize: '16px',
      color: '#e2e8f0',
    }).setOrigin(0.5);

    this.tweens.add({
      targets: notice,
      alpha: 0,
      duration: 1200,
      ease: 'Sine.easeIn',
      onComplete: () => notice.destroy(),
    });
  }
}
