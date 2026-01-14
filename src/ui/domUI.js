let domUIInstance = null;

const formatNumber = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return Number(value).toFixed(1);
};

const createStatusRow = (label) => {
  const labelEl = document.createElement('div');
  labelEl.className = 'status-label';
  labelEl.textContent = label;

  const valueEl = document.createElement('div');
  valueEl.className = 'status-value';
  valueEl.textContent = '—';

  return { labelEl, valueEl };
};

export const initDomUI = () => {
  if (domUIInstance) {
    return domUIInstance;
  }

  const actionsPanel = document.getElementById('actions-panel');
  const statusPanel = document.getElementById('status-panel');
  const consoleLog = document.getElementById('console-log');

  if (!actionsPanel || !statusPanel || !consoleLog) {
    return null;
  }

  actionsPanel.innerHTML = '';
  statusPanel.innerHTML = '';
  consoleLog.innerHTML = '';

  const actionHeader = document.createElement('div');
  actionHeader.textContent = 'Auto Move';
  actionHeader.style.color = '#94a3b8';
  actionsPanel.appendChild(actionHeader);

  const toggleRow = document.createElement('div');
  toggleRow.className = 'action-row toggle';

  const toggleLabel = document.createElement('label');
  toggleLabel.className = 'toggle';

  const toggleInput = document.createElement('input');
  toggleInput.type = 'checkbox';
  toggleInput.checked = true;

  const toggleText = document.createElement('span');
  toggleText.textContent = 'Enable click-to-move';

  toggleLabel.append(toggleInput, toggleText);
  toggleRow.appendChild(toggleLabel);
  actionsPanel.appendChild(toggleRow);

  const buttonRow = document.createElement('div');
  buttonRow.className = 'action-row';

  const resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.textContent = 'Reset Target';

  const centerButton = document.createElement('button');
  centerButton.type = 'button';
  centerButton.textContent = 'Center Camera';

  buttonRow.append(resetButton, centerButton);
  actionsPanel.appendChild(buttonRow);

  const statusGrid = document.createElement('div');
  statusGrid.className = 'status-grid';

  const rows = {
    position: createStatusRow('Position'),
    target: createStatusRow('Target'),
    distance: createStatusRow('Distance'),
    velocity: createStatusRow('Velocity'),
  };

  Object.values(rows).forEach(({ labelEl, valueEl }) => {
    statusGrid.append(labelEl, valueEl);
  });

  statusPanel.appendChild(statusGrid);

  let onAutoMoveToggle = null;
  let onResetTarget = null;
  let onCenterCamera = null;

  toggleInput.addEventListener('change', () => {
    if (onAutoMoveToggle) {
      onAutoMoveToggle(toggleInput.checked);
    }
  });

  resetButton.addEventListener('click', () => {
    if (onResetTarget) {
      onResetTarget();
    }
  });

  centerButton.addEventListener('click', () => {
    if (onCenterCamera) {
      onCenterCamera();
    }
  });

  const appendLog = (message) => {
    if (!message) {
      return;
    }
    const line = document.createElement('div');
    line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    consoleLog.appendChild(line);

    const maxLines = 120;
    while (consoleLog.children.length > maxLines) {
      consoleLog.removeChild(consoleLog.firstChild);
    }
    consoleLog.scrollTop = consoleLog.scrollHeight;
  };

  domUIInstance = {
    setActionHandlers: (handlers) => {
      onAutoMoveToggle = handlers?.onAutoMoveToggle ?? null;
      onResetTarget = handlers?.onResetTarget ?? null;
      onCenterCamera = handlers?.onCenterCamera ?? null;
    },
    setAutoMove: (enabled) => {
      toggleInput.checked = Boolean(enabled);
    },
    updateStatus: ({ position, target, distance, velocity }) => {
      rows.position.valueEl.textContent = position
        ? `${formatNumber(position.x)}, ${formatNumber(position.y)}`
        : '—';
      rows.target.valueEl.textContent = target
        ? `${formatNumber(target.x)}, ${formatNumber(target.y)}`
        : '—';
      rows.distance.valueEl.textContent = distance !== null && distance !== undefined
        ? `${formatNumber(distance)} px`
        : '—';
      rows.velocity.valueEl.textContent = velocity
        ? `${formatNumber(velocity.x)}, ${formatNumber(velocity.y)}`
        : '—';
    },
    appendLog,
  };

  return domUIInstance;
};

export const getDomUI = () => domUIInstance;
