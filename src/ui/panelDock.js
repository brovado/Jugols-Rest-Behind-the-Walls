const STORAGE_KEY = 'thelore_panel_state_v1';

const DEFAULT_PANELS = {
  actions: {
    open: true,
    dirty: false,
    dirtyCount: 0,
    active: false,
    disabled: false,
    stateText: '',
  },
  pack: {
    open: true,
    dirty: false,
    dirtyCount: 0,
    active: false,
    disabled: false,
    stateText: '',
  },
  feed: {
    open: false,
    dirty: false,
    dirtyCount: 0,
    active: false,
    disabled: false,
    stateText: '',
  },
  meters: {
    open: true,
    dirty: false,
    dirtyCount: 0,
    active: false,
    disabled: false,
    stateText: '',
  },
  population: {
    open: true,
    dirty: false,
    dirtyCount: 0,
    active: false,
    disabled: false,
    stateText: '',
  },
  controls: {
    open: true,
    dirty: false,
    dirtyCount: 0,
    active: false,
    disabled: false,
    stateText: '',
  },
  status: {
    open: true,
    dirty: false,
    dirtyCount: 0,
    active: false,
    disabled: false,
    stateText: '',
  },
};

let dockInstance = null;

const cloneDefaultPanels = () =>
  Object.fromEntries(
    Object.entries(DEFAULT_PANELS).map(([key, value]) => [key, { ...value }])
  );

const loadPersistedState = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw);
  } catch (error) {
    return {};
  }
};

const savePersistedState = (state) => {
  try {
    const openState = Object.fromEntries(
      Object.entries(state).map(([key, value]) => [key, Boolean(value.open)])
    );
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(openState));
  } catch (error) {
    // ignore storage failures
  }
};

const getDrawerHeight = (element) => element.getBoundingClientRect().height;

const setDrawerOpenState = (panel, open) => {
  if (!panel.body) {
    return;
  }

  if (open) {
    panel.wrapper.classList.remove('is-hidden');
    panel.wrapper.classList.remove('is-collapsed');
    panel.body.style.opacity = '1';
    panel.body.style.height = '0px';
  } else {
    const currentHeight = getDrawerHeight(panel.body);
    panel.body.style.height = `${currentHeight}px`;
    panel.body.style.opacity = '0';
    panel.wrapper.classList.add('is-collapsed');
  }

  window.requestAnimationFrame(() => {
    panel.body.style.height = open ? `${panel.body.scrollHeight}px` : '0px';
  });
};

const finalizeDrawerState = (panel, open) => {
  if (!panel.body) {
    return;
  }
  if (open) {
    panel.body.style.height = 'auto';
    panel.body.style.opacity = '1';
    panel.wrapper.classList.remove('is-hidden');
  } else {
    panel.body.style.height = '0px';
    panel.body.style.opacity = '0';
    panel.wrapper.classList.add('is-hidden');
  }
};

const renderBadge = (panel, state) => {
  if (!panel.badge) {
    return;
  }
  const shouldShow = state.dirty || state.dirtyCount > 0;
  panel.badge.classList.toggle('is-visible', shouldShow);
  const count = state.dirtyCount || 0;
  panel.badge.textContent = count > 0 ? `${count}` : '';
  panel.badge.classList.toggle('is-dot', count === 0);
};

const renderPanelState = (panel, state) => {
  if (panel.tab) {
    panel.tab.classList.toggle('is-open', state.open);
    panel.tab.classList.toggle('is-active', state.active);
    panel.tab.classList.toggle('is-disabled', state.disabled);
    panel.tab.disabled = state.disabled;
  }
  if (panel.wrapper) {
    panel.wrapper.classList.toggle('is-active', state.active);
  }
  if (panel.stateTextEl) {
    panel.stateTextEl.textContent = state.stateText || '';
  }
  renderBadge(panel, state);
};

const setupPanel = (panelId, panels, dom) => {
  const state = panels[panelId];
  if (!state || !dom.wrapper) {
    return;
  }

  dom.body.addEventListener('transitionend', (event) => {
    if (event.propertyName !== 'height') {
      return;
    }
    finalizeDrawerState(dom, state.open);
  });

  renderPanelState(dom, state);
  setDrawerOpenState(dom, state.open);
  finalizeDrawerState(dom, state.open);
};

export const initPanelDock = () => {
  if (dockInstance) {
    return dockInstance;
  }

  const persisted = loadPersistedState();
  const panels = cloneDefaultPanels();
  Object.entries(persisted).forEach(([key, open]) => {
    if (panels[key]) {
      panels[key].open = Boolean(open);
    }
  });

  const panelElements = {};
  document.querySelectorAll('.ui-dock-tab').forEach((tab) => {
    const panelId = tab.dataset.panel;
    if (!panelId) {
      return;
    }
    panelElements[panelId] = panelElements[panelId] || {};
    panelElements[panelId].tab = tab;
    panelElements[panelId].badge = tab.querySelector('[data-badge]');
  });

  document.querySelectorAll('.ui-drawer').forEach((wrapper) => {
    const panelId = wrapper.dataset.panel;
    if (!panelId) {
      return;
    }
    panelElements[panelId] = panelElements[panelId] || {};
    panelElements[panelId].wrapper = wrapper;
    panelElements[panelId].body = wrapper.querySelector('.ui-drawer-body');
    panelElements[panelId].stateTextEl = wrapper.querySelector('[data-panel-state]');
  });

  Object.keys(panels).forEach((panelId) => {
    setupPanel(panelId, panels, panelElements[panelId] || {});
  });

  const setPanelOpen = (panelId, open) => {
    const state = panels[panelId];
    const dom = panelElements[panelId];
    if (!state || !dom) {
      return;
    }
    if (state.disabled) {
      return;
    }
    if (state.open === open) {
      return;
    }
    state.open = open;
    if (open) {
      state.dirty = false;
      state.dirtyCount = 0;
    }
    setDrawerOpenState(dom, open);
    renderPanelState(dom, state);
    savePersistedState(panels);
  };

  const togglePanel = (panelId) => {
    const state = panels[panelId];
    if (!state) {
      return;
    }
    setPanelOpen(panelId, !state.open);
  };

  Object.entries(panelElements).forEach(([panelId, elements]) => {
    if (!elements.tab) {
      return;
    }
    elements.tab.addEventListener('click', () => {
      togglePanel(panelId);
    });

    if (elements.wrapper) {
      const header = elements.wrapper.querySelector('.ui-drawer-header');
      if (header) {
        header.addEventListener('click', () => {
          togglePanel(panelId);
        });
      }
    }
  });

  const setPanelDirty = (panelId, dirty, options = {}) => {
    const state = panels[panelId];
    const dom = panelElements[panelId];
    if (!state || !dom) {
      return;
    }
    if (state.open) {
      state.dirty = false;
      state.dirtyCount = 0;
    } else {
      state.dirty = Boolean(dirty);
      if (dirty) {
        if (Number.isFinite(options.increment)) {
          state.dirtyCount += options.increment;
        } else if (Number.isFinite(options.count)) {
          state.dirtyCount = options.count;
        }
      } else {
        state.dirtyCount = 0;
      }
    }
    renderPanelState(dom, state);
  };

  const setPanelActive = (panelId, active) => {
    const state = panels[panelId];
    const dom = panelElements[panelId];
    if (!state || !dom) {
      return;
    }
    state.active = Boolean(active);
    renderPanelState(dom, state);
  };

  const setPanelDisabled = (panelId, disabled) => {
    const state = panels[panelId];
    const dom = panelElements[panelId];
    if (!state || !dom) {
      return;
    }
    state.disabled = Boolean(disabled);
    if (state.disabled) {
      state.open = false;
      state.dirty = false;
      state.dirtyCount = 0;
      setDrawerOpenState(dom, false);
    }
    renderPanelState(dom, state);
  };

  const setPanelStateText = (panelId, text) => {
    const state = panels[panelId];
    const dom = panelElements[panelId];
    if (!state || !dom) {
      return;
    }
    state.stateText = text || '';
    renderPanelState(dom, state);
  };

  const isPanelOpen = (panelId) => Boolean(panels[panelId]?.open);

  dockInstance = {
    panels,
    setPanelOpen,
    togglePanel,
    setPanelDirty,
    setPanelActive,
    setPanelDisabled,
    setPanelStateText,
    isPanelOpen,
  };

  return dockInstance;
};

export const getPanelDock = () => dockInstance;

export const setPanelOpen = (panelId, open) => dockInstance?.setPanelOpen(panelId, open);
export const togglePanel = (panelId) => dockInstance?.togglePanel(panelId);
export const setPanelDirty = (panelId, dirty, options) =>
  dockInstance?.setPanelDirty(panelId, dirty, options);
export const setPanelActive = (panelId, active) => dockInstance?.setPanelActive(panelId, active);
export const setPanelDisabled = (panelId, disabled) =>
  dockInstance?.setPanelDisabled(panelId, disabled);
export const setPanelStateText = (panelId, text) =>
  dockInstance?.setPanelStateText(panelId, text);
export const isPanelOpen = (panelId) => dockInstance?.isPanelOpen(panelId) ?? false;
