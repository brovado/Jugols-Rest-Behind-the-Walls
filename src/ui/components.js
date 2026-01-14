export const createButton = (scene, config) => {
  const {
    x,
    y,
    width = 200,
    height = 36,
    label,
    onClick,
  } = config;

  const container = scene.add.container(x, y);
  const background = scene.add
    .rectangle(0, 0, width, height, 0x111827, 0.95)
    .setOrigin(0, 0)
    .setStrokeStyle(1, 0x334155, 0.9);
  const text = scene.add.text(width / 2, height / 2, label, {
    fontSize: '14px',
    color: '#e2e8f0',
  }).setOrigin(0.5);

  container.add([background, text]);
  container.setSize(width, height);
  container.setScrollFactor(0);
  container.setInteractive(
    new Phaser.Geom.Rectangle(0, 0, width, height),
    Phaser.Geom.Rectangle.Contains
  );
  container.input.alwaysEnabled = true;

  let enabled = true;
  let pressed = false;

  const applyVisualState = (state) => {
    switch (state) {
      case 'disabled':
        background.setFillStyle(0x0f172a, 0.6);
        background.setStrokeStyle(1, 0x1f2937, 0.6);
        text.setColor('#64748b');
        break;
      case 'pressed':
        background.setFillStyle(0x1e3a8a, 0.95);
        background.setStrokeStyle(1, 0x38bdf8, 1);
        text.setColor('#f8fafc');
        break;
      case 'hover':
        background.setFillStyle(0x1e293b, 0.95);
        background.setStrokeStyle(1, 0x60a5fa, 1);
        text.setColor('#f8fafc');
        break;
      default:
        background.setFillStyle(0x111827, 0.95);
        background.setStrokeStyle(1, 0x334155, 0.9);
        text.setColor('#e2e8f0');
        break;
    }
  };

  applyVisualState('default');

  container.on('pointerover', () => {
    if (!enabled || pressed) {
      return;
    }
    applyVisualState('hover');
  });

  container.on('pointerout', () => {
    if (!enabled || pressed) {
      return;
    }
    applyVisualState('default');
  });

  container.on('pointerdown', (pointer) => {
    pointer.event?.stopPropagation?.();
    if (!enabled) {
      return;
    }
    pressed = true;
    applyVisualState('pressed');
  });

  container.on('pointerup', (pointer) => {
    pointer.event?.stopPropagation?.();
    if (!enabled) {
      pressed = false;
      applyVisualState('disabled');
      return;
    }
    const bounds = container.getBounds();
    const within = Phaser.Geom.Rectangle.Contains(bounds, pointer.x, pointer.y);
    pressed = false;
    applyVisualState(within ? 'hover' : 'default');
    if (within && onClick) {
      onClick();
    }
  });

  container.setEnabled = (isEnabled) => {
    enabled = isEnabled;
    applyVisualState(isEnabled ? 'default' : 'disabled');
    container.input.enabled = true;
    container.setAlpha(isEnabled ? 1 : 0.85);
  };

  container.setLabel = (nextLabel) => {
    text.setText(nextLabel);
  };

  return container;
};

export const createPanel = (scene, config) => {
  const {
    x,
    y,
    width,
    height,
    title,
  } = config;

  const container = scene.add.container(x, y);
  const background = scene.add
    .rectangle(0, 0, width, height, 0x0b1120, 0.9)
    .setOrigin(0, 0)
    .setStrokeStyle(1, 0x1e293b, 1);
  const header = scene.add
    .text(12, 10, title, {
      fontSize: '16px',
      color: '#e2e8f0',
    })
    .setOrigin(0, 0);
  const divider = scene.add
    .line(0, 0, 10, 38, width - 10, 38, 0x1f2937, 0.9)
    .setOrigin(0, 0);

  const body = scene.add.container(0, 40);

  container.add([background, header, divider, body]);
  container.setSize(width, height);
  container.setScrollFactor(0);

  body.setPosition(0, 40);

  return {
    container,
    body,
    header,
    background,
  };
};

export const createMeter = (scene, config) => {
  const {
    x,
    y,
    width = 200,
    height = 16,
    label,
    color = 0x38bdf8,
  } = config;

  const container = scene.add.container(x, y);
  const labelText = scene.add.text(0, 0, label, {
    fontSize: '13px',
    color: '#e2e8f0',
  }).setOrigin(0, 0);
  const barBg = scene.add
    .rectangle(0, 22, width, height, 0x111827, 0.9)
    .setOrigin(0, 0)
    .setStrokeStyle(1, 0x1f2937, 1);
  const fill = scene.add
    .rectangle(0, 22, 0, height, color, 0.95)
    .setOrigin(0, 0);
  const valueText = scene.add.text(width, 0, '0/100', {
    fontSize: '12px',
    color: '#94a3b8',
  }).setOrigin(1, 0);

  container.add([labelText, barBg, fill, valueText]);

  const update = (value, maxValue = 100) => {
    const clamped = Math.max(0, Math.min(maxValue, value));
    const widthValue = (clamped / maxValue) * width;
    fill.setSize(widthValue, height);
    valueText.setText(`${Math.round(clamped)}/${maxValue}`);
  };

  return {
    container,
    update,
  };
};
