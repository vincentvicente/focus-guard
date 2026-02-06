// Focus Guard - Popup Script

class FocusGuardPopup {
  constructor() {
    this.state = {
      isActive: false,
      isPaused: false,
      duration: 45,
      focusPages: [],
      startTime: null,
      endTime: null,
      distractionCount: 0,
      settings: {
        soundEnabled: true,
        notifyEnabled: true
      }
    };

    this.elements = {};
    this.timerInterval = null;

    this.init();
  }

  async init() {
    this.cacheElements();
    this.bindEvents();
    await this.loadState();
    this.render();
  }

  cacheElements() {
    this.elements = {
      // Views
      setupView: document.getElementById('setupView'),
      focusView: document.getElementById('focusView'),
      settingsView: document.getElementById('settingsView'),
      
      // Setup
      timeBtns: document.querySelectorAll('.time-btn:not(.custom)'),
      customTimeBtn: document.getElementById('customTimeBtn'),
      customTimeInput: document.getElementById('customTime'),
      focusPages: document.getElementById('focusPages'),
      addCurrentPage: document.getElementById('addCurrentPage'),
      startBtn: document.getElementById('startBtn'),
      
      // Focus
      timerDisplay: document.getElementById('timerDisplay'),
      progressRing: document.getElementById('progressRing'),
      distractionCount: document.getElementById('distractionCount'),
      pauseBtn: document.getElementById('pauseBtn'),
      stopBtn: document.getElementById('stopBtn'),
      
      // Settings
      settingsBtn: document.getElementById('settingsBtn'),
      backBtn: document.getElementById('backBtn'),
      soundEnabled: document.getElementById('soundEnabled'),
      notifyEnabled: document.getElementById('notifyEnabled')
    };
  }

  bindEvents() {
    // Time selection
    this.elements.timeBtns.forEach(btn => {
      btn.addEventListener('click', () => this.selectTime(btn));
    });

    this.elements.customTimeInput.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      if (value > 0 && value <= 180) {
        this.state.duration = value;
        this.elements.timeBtns.forEach(b => b.classList.remove('active'));
        this.elements.customTimeBtn.classList.add('active');
      }
    });

    this.elements.customTimeInput.addEventListener('focus', () => {
      this.elements.timeBtns.forEach(b => b.classList.remove('active'));
      this.elements.customTimeBtn.classList.add('active');
    });

    // Add current page
    this.elements.addCurrentPage.addEventListener('click', () => this.addCurrentPage());

    // Start focus
    this.elements.startBtn.addEventListener('click', () => this.startFocus());

    // Pause/Stop
    this.elements.pauseBtn.addEventListener('click', () => this.togglePause());
    this.elements.stopBtn.addEventListener('click', () => this.stopFocus());

    // Settings
    this.elements.settingsBtn.addEventListener('click', () => this.showSettings());
    this.elements.backBtn.addEventListener('click', () => this.hideSettings());

    this.elements.soundEnabled.addEventListener('change', (e) => {
      this.state.settings.soundEnabled = e.target.checked;
      this.saveSettings();
    });

    this.elements.notifyEnabled.addEventListener('change', (e) => {
      this.state.settings.notifyEnabled = e.target.checked;
      this.saveSettings();
    });

    // Listen for state updates from background
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'STATE_UPDATE') {
        this.state = { ...this.state, ...message.state };
        this.render();
      }
    });

    // Listen for storage changes (优化性能，避免轮询)
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.focusState) {
        const newState = changes.focusState.newValue;
        if (newState) {
          this.state = { ...this.state, ...newState };
          if (!this.state.isActive && this.timerInterval) {
            this.render();
          }
        }
      }
    });
  }

  async loadState() {
    try {
      // Get state from background
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
      if (response) {
        this.state = { ...this.state, ...response };
      }

      // Load settings
      const stored = await chrome.storage.local.get(['settings', 'focusPages']);
      if (stored.settings) {
        this.state.settings = stored.settings;
      }
      if (stored.focusPages && !this.state.isActive) {
        this.state.focusPages = stored.focusPages;
      }
    } catch (e) {
      console.error('Failed to load state:', e);
    }
  }

  async saveSettings() {
    await chrome.storage.local.set({ settings: this.state.settings });
    chrome.runtime.sendMessage({ 
      type: 'UPDATE_SETTINGS', 
      settings: this.state.settings 
    });
  }

  selectTime(btn) {
    this.elements.timeBtns.forEach(b => b.classList.remove('active'));
    this.elements.customTimeBtn.classList.remove('active');
    btn.classList.add('active');
    this.state.duration = parseInt(btn.dataset.minutes);
    this.elements.customTimeInput.value = '';
  }

  async addCurrentPage() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url) return;

      // Check if already added
      if (this.state.focusPages.some(p => p.url === tab.url)) {
        return;
      }

      const page = {
        url: tab.url,
        title: tab.title || tab.url,
        favicon: tab.favIconUrl || ''
      };

      this.state.focusPages.push(page);
      await chrome.storage.local.set({ focusPages: this.state.focusPages });
      this.renderFocusPages();
    } catch (e) {
      console.error('Failed to add page:', e);
    }
  }

  async removePage(url) {
    this.state.focusPages = this.state.focusPages.filter(p => p.url !== url);
    await chrome.storage.local.set({ focusPages: this.state.focusPages });
    this.renderFocusPages();
  }

  renderFocusPages() {
    const container = this.elements.focusPages;
    
    if (this.state.focusPages.length === 0) {
      container.innerHTML = '<div class="empty-state">点击下方按钮添加专注页面</div>';
      return;
    }

    container.innerHTML = this.state.focusPages.map(page => `
      <div class="page-item" data-url="${this.escapeHtml(page.url)}">
        <img class="page-favicon" src="${page.favicon || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22><rect fill=%22%23333%22 width=%2216%22 height=%2216%22 rx=%222%22/></svg>'}" alt="">
        <span class="page-url" title="${this.escapeHtml(page.title)}">${this.formatUrl(page.url)}</span>
        <button class="page-remove" data-url="${this.escapeHtml(page.url)}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"></path>
          </svg>
        </button>
      </div>
    `).join('');

    // Bind remove events
    container.querySelectorAll('.page-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removePage(btn.dataset.url);
      });
    });
  }

  formatUrl(url) {
    try {
      const u = new URL(url);
      return u.hostname + (u.pathname !== '/' ? u.pathname : '');
    } catch {
      return url;
    }
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  async startFocus() {
    if (this.state.focusPages.length === 0) {
      // Add current page if none added
      await this.addCurrentPage();
      if (this.state.focusPages.length === 0) return;
    }

    const response = await chrome.runtime.sendMessage({
      type: 'START_FOCUS',
      duration: this.state.duration,
      focusPages: this.state.focusPages,
      settings: this.state.settings
    });

    if (response && response.success) {
      this.state.isActive = true;
      this.state.startTime = response.startTime;
      this.state.endTime = response.endTime;
      this.state.distractionCount = 0;
      this.render();
    }
  }

  async togglePause() {
    const response = await chrome.runtime.sendMessage({ type: 'TOGGLE_PAUSE' });
    if (response) {
      this.state.isPaused = response.isPaused;
      this.updatePauseButton();
    }
  }

  async stopFocus() {
    await chrome.runtime.sendMessage({ type: 'STOP_FOCUS' });
    this.state.isActive = false;
    this.state.isPaused = false;
    this.render();
  }

  updatePauseButton() {
    const btn = this.elements.pauseBtn;
    if (this.state.isPaused) {
      btn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
        继续
      `;
    } else {
      btn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="4" width="4" height="16"></rect>
          <rect x="14" y="4" width="4" height="16"></rect>
        </svg>
        暂停
      `;
    }
  }

  render() {
    // Update settings toggles
    this.elements.soundEnabled.checked = this.state.settings.soundEnabled;
    this.elements.notifyEnabled.checked = this.state.settings.notifyEnabled;

    if (this.state.isActive) {
      this.showFocusView();
    } else {
      this.showSetupView();
    }
  }

  showSetupView() {
    this.elements.setupView.classList.remove('hidden');
    this.elements.focusView.classList.add('hidden');
    this.elements.settingsView.classList.add('hidden');
    
    this.renderFocusPages();
    
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  showFocusView() {
    this.elements.setupView.classList.add('hidden');
    this.elements.focusView.classList.remove('hidden');
    this.elements.settingsView.classList.add('hidden');

    // Add SVG gradient definition
    if (!document.getElementById('timerGradient')) {
      const svg = document.querySelector('.progress-ring');
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      defs.innerHTML = `
        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#a855f7" />
          <stop offset="50%" stop-color="#06b6d4" />
          <stop offset="100%" stop-color="#ec4899" />
        </linearGradient>
      `;
      defs.id = 'timerGradient';
      svg.insertBefore(defs, svg.firstChild);
    }

    this.elements.distractionCount.textContent = this.state.distractionCount;
    this.updatePauseButton();
    this.startTimerDisplay();
  }

  showSettings() {
    this.elements.setupView.classList.add('hidden');
    this.elements.focusView.classList.add('hidden');
    this.elements.settingsView.classList.remove('hidden');
  }

  hideSettings() {
    if (this.state.isActive) {
      this.showFocusView();
    } else {
      this.showSetupView();
    }
  }

  startTimerDisplay() {
    let syncCounter = 0;
    const SYNC_INTERVAL = 10; // 每10秒同步一次状态，而不是每秒

    const updateTimer = () => {
      if (!this.state.endTime) return;

      const now = Date.now();
      const remaining = Math.max(0, this.state.endTime - now);
      const total = this.state.duration * 60 * 1000;

      // Update time display
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      this.elements.timerDisplay.textContent =
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

      // Update progress ring
      const circumference = 2 * Math.PI * 54;
      const progress = remaining / total;
      const offset = circumference * (1 - progress);
      this.elements.progressRing.style.strokeDashoffset = offset;

      // Update distraction count
      this.elements.distractionCount.textContent = this.state.distractionCount;

      if (remaining === 0) {
        this.state.isActive = false;
        this.render();
      }
    };

    updateTimer();
    this.timerInterval = setInterval(async () => {
      syncCounter++;

      // 只在每10秒或暂停状态变化时同步状态
      if (syncCounter >= SYNC_INTERVAL) {
        syncCounter = 0;
        const response = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
        if (response) {
          this.state = { ...this.state, ...response };
          if (!this.state.isActive) {
            this.render();
            return;
          }
        }
      }

      updateTimer();
    }, 1000);
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  new FocusGuardPopup();
});
