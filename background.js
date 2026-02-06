// Focus Guard - Background Service Worker

// Global state
let state = {
  isActive: false,
  isPaused: false,
  duration: 0,
  focusPages: [],
  startTime: null,
  endTime: null,
  pausedAt: null,
  pausedRemaining: 0,
  distractionCount: 0,
  settings: {
    soundEnabled: true,
    notifyEnabled: true
  }
};

const DISTRACTION_DELAY = 1000; // 1秒后显示遮罩（防止误触）
const RECORD_DELAY = 500; // 0.5秒后立即记录分心（防止钻空子）
let distractionTimeout = null;
let recordTimeout = null;

// Helper functions
function safeParseUrl(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function matchUrl(focusPage, tabUrl) {
  const focusUrlObj = safeParseUrl(focusPage.url);
  const tabUrlObj = safeParseUrl(tabUrl);

  if (!focusUrlObj || !tabUrlObj) {
    return focusPage.url === tabUrl;
  }

  // 默认：域名匹配
  // 未来可以扩展为支持多种匹配模式
  return focusUrlObj.hostname === tabUrlObj.hostname;
}

// Initialize
init();

function init() {
  console.log('[FocusGuard] Initializing...');
  
  // Message handling
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender, sendResponse);
    return true;
  });

  // Tab events
  chrome.tabs.onActivated.addListener(onTabActivated);
  chrome.tabs.onUpdated.addListener(onTabUpdated);
  chrome.tabs.onCreated.addListener(onTabCreated);

  // Window events
  chrome.windows.onCreated.addListener(onWindowCreated);

  // Alarm
  chrome.alarms.onAlarm.addListener(onAlarm);

  // Restore state
  restoreState();
}

async function restoreState() {
  const stored = await chrome.storage.local.get(['focusState', 'settings']);
  if (stored.settings) {
    state.settings = stored.settings;
  }
  if (stored.focusState && stored.focusState.isActive) {
    const remaining = stored.focusState.endTime - Date.now();
    if (remaining > 0) {
      state = { ...state, ...stored.focusState };
      console.log('[FocusGuard] Restored active session');
    }
  }
}

async function saveState() {
  await chrome.storage.local.set({ 
    focusState: {
      isActive: state.isActive,
      isPaused: state.isPaused,
      duration: state.duration,
      focusPages: state.focusPages,
      startTime: state.startTime,
      endTime: state.endTime,
      pausedAt: state.pausedAt,
      pausedRemaining: state.pausedRemaining,
      distractionCount: state.distractionCount
    }
  });
}

function handleMessage(message, sender, sendResponse) {
  console.log('[FocusGuard] Message:', message.type);
  
  switch (message.type) {
    case 'GET_STATE':
      sendResponse(state);
      break;

    case 'START_FOCUS':
      startFocus(message.duration, message.focusPages, message.settings);
      sendResponse({ 
        success: true, 
        startTime: state.startTime,
        endTime: state.endTime 
      });
      break;

    case 'STOP_FOCUS':
      stopFocus();
      sendResponse({ success: true });
      break;

    case 'TOGGLE_PAUSE':
      togglePause();
      sendResponse({ isPaused: state.isPaused });
      break;

    case 'UPDATE_SETTINGS':
      state.settings = message.settings;
      break;

    case 'RETURN_TO_FOCUS':
      returnToFocus();
      sendResponse({ success: true });
      break;

    case 'TAKE_BREAK':
      takeBreak(message.minutes || 5);
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ error: 'Unknown message type' });
  }
}

function startFocus(duration, focusPages, settings) {
  console.log('[FocusGuard] Starting focus:', { duration, focusPages });
  
  state.isActive = true;
  state.isPaused = false;
  state.duration = duration;
  state.focusPages = focusPages || [];
  state.settings = settings || state.settings;
  state.startTime = Date.now();
  state.endTime = state.startTime + (duration * 60 * 1000);
  state.distractionCount = 0;

  chrome.alarms.create('focusEnd', { when: state.endTime });
  updateIcon(true);
  saveState();
  
  // 显示开始通知
  const pageNames = focusPages.map(p => {
    try {
      return new URL(p.url).hostname;
    } catch {
      return p.url;
    }
  }).join(', ');

  showNotification(
    '🎯 专注模式已开启',
    `专注 ${duration} 分钟，加油！专注页面: ${pageNames}`
  );
  
  console.log('[FocusGuard] Focus started, ends at:', new Date(state.endTime));
}

function stopFocus() {
  console.log('[FocusGuard] Stopping focus');

  state.isActive = false;
  state.isPaused = false;

  // 清理所有定时器和警报
  chrome.alarms.clear('focusEnd');
  chrome.alarms.clear('breakEnd');

  if (distractionTimeout) {
    clearTimeout(distractionTimeout);
    distractionTimeout = null;
  }

  if (recordTimeout) {
    clearTimeout(recordTimeout);
    recordTimeout = null;
  }

  updateIcon(false);
  clearAllOverlays();
  saveState();
}

function togglePause() {
  if (state.isPaused) {
    const now = Date.now();
    state.endTime = now + state.pausedRemaining;
    state.isPaused = false;
    state.pausedAt = null;
    state.pausedRemaining = 0;
    chrome.alarms.create('focusEnd', { when: state.endTime });
  } else {
    state.pausedAt = Date.now();
    state.pausedRemaining = state.endTime - state.pausedAt;
    state.isPaused = true;
    chrome.alarms.clear('focusEnd');
  }
  saveState();
}

function takeBreak(minutes) {
  state.isPaused = true;
  state.pausedAt = Date.now();
  state.pausedRemaining = state.endTime - state.pausedAt;
  
  chrome.alarms.clear('focusEnd');
  chrome.alarms.create('breakEnd', { delayInMinutes: minutes });

  clearAllOverlays();
  saveState();
}

function onAlarm(alarm) {
  if (alarm.name === 'focusEnd') {
    onFocusComplete();
  } else if (alarm.name === 'breakEnd') {
    togglePause();
    showNotification('休息结束', '继续专注吧！💪');
  }
}

function onFocusComplete() {
  const distractions = state.distractionCount;
  const duration = state.duration;
  stopFocus();
  showNotification(
    '🎉 专注完成！', 
    `太棒了！你完成了 ${duration} 分钟的专注。分心次数：${distractions}`
  );
}

async function onTabActivated(info) {
  console.log('[FocusGuard] Tab activated:', info.tabId, 'isActive:', state.isActive);
  if (!state.isActive || state.isPaused) return;

  try {
    const tab = await chrome.tabs.get(info.tabId);
    checkDistraction(tab);
  } catch (e) {
    console.error('[FocusGuard] Error getting tab:', e);
  }
}

function onTabUpdated(tabId, changeInfo, tab) {
  if (!state.isActive || state.isPaused) return;
  if (changeInfo.status !== 'complete') return;

  console.log('[FocusGuard] Tab updated:', tab.url);
  checkDistraction(tab);
}

async function onTabCreated(tab) {
  if (!state.isActive || state.isPaused) return;

  setTimeout(async () => {
    try {
      const updatedTab = await chrome.tabs.get(tab.id);
      checkDistraction(updatedTab);
    } catch (e) {
      // Tab might be closed
    }
  }, 500);
}

function onWindowCreated(window) {
  if (!state.isActive || state.isPaused) return;

  if (window.incognito) {
    state.distractionCount++;
    saveState();
    showNotification(
      '⚠️ 检测到无痕窗口！',
      '你在专注时间内打开了无痕浏览窗口。请关闭它并返回专注页面。'
    );
    if (state.settings.soundEnabled) {
      playAlertSound();
    }
  }
}

function checkDistraction(tab) {
  if (!tab || !tab.url) return;
  
  console.log('[FocusGuard] Checking distraction for:', tab.url);
  console.log('[FocusGuard] Focus pages:', state.focusPages);

  // Ignore special pages
  if (tab.url.startsWith('chrome://') || 
      tab.url.startsWith('chrome-extension://') ||
      tab.url.startsWith('about:')) {
    return;
  }

  // Check if this is a focus page
  const isFocusPage = state.focusPages.some(page => {
    const match = matchUrl(page, tab.url);
    console.log('[FocusGuard] Comparing:', page.url, 'vs', tab.url, '=', match);
    return match;
  });

  console.log('[FocusGuard] Is focus page:', isFocusPage);

  if (!isFocusPage) {
    // 清除之前的定时器
    if (distractionTimeout) {
      clearTimeout(distractionTimeout);
    }
    if (recordTimeout) {
      clearTimeout(recordTimeout);
    }

    console.log('[FocusGuard] Distraction detected');

    // 策略：快速记录分心（防止用户钻空子），延迟显示遮罩（防止误触）

    // 1. 500ms后立即记录分心次数
    recordTimeout = setTimeout(() => {
      state.distractionCount++;
      saveState();
      console.log('[FocusGuard] Distraction recorded, count:', state.distractionCount);
    }, RECORD_DELAY);

    // 2. 1秒后显示遮罩和提醒
    distractionTimeout = setTimeout(() => {
      triggerDistraction(tab);
    }, DISTRACTION_DELAY);
  } else {
    console.log('[FocusGuard] Back on focus page!');

    // 清除所有定时器
    if (distractionTimeout) {
      clearTimeout(distractionTimeout);
      distractionTimeout = null;
    }
    if (recordTimeout) {
      clearTimeout(recordTimeout);
      recordTimeout = null;
    }

    clearAllOverlays();
  }
}

async function triggerDistraction(tab) {
  console.log('[FocusGuard] Triggering distraction alert for tab:', tab.id, tab.url);

  // 注意：分心次数已在checkDistraction中记录，这里不再重复计数

  // 始终显示通知
  const remaining = Math.ceil((state.endTime - Date.now()) / 60000);
  let currentPage = tab.url;
  try {
    currentPage = new URL(tab.url).hostname;
  } catch {
    // 使用原始URL
  }

  showNotification(
    '⚠️ 你分心了！',
    `专注时间还剩 ${remaining} 分钟。当前页面: ${currentPage}`
  );

  // 尝试显示遮罩
  try {
    await showOverlay(tab.id);
  } catch (e) {
    console.error('[FocusGuard] Overlay failed:', e);
  }

  // 播放声音
  if (state.settings.soundEnabled) {
    playAlertSound();
  }
}

async function showOverlay(tabId) {
  try {
    console.log('[FocusGuard] Injecting overlay into tab:', tabId);
    
    // First inject the CSS
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['content/overlay.css']
    });

    const data = {
      remaining: state.endTime - Date.now(),
      distractionCount: state.distractionCount
    };

    // Then execute the overlay script
    await chrome.scripting.executeScript({
      target: { tabId },
      func: injectOverlayIntoPage,
      args: [data]
    });
    
    console.log('[FocusGuard] Overlay injected successfully');
  } catch (e) {
    console.error('[FocusGuard] Failed to show overlay:', e);
  }
}

// This function runs in the PAGE context (not service worker)
function injectOverlayIntoPage(data) {
  // Remove existing overlay
  const existing = document.getElementById('focus-guard-overlay');
  if (existing) existing.remove();

  const minutes = Math.floor(data.remaining / 60000);
  const seconds = Math.floor((data.remaining % 60000) / 1000);
  const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const overlay = document.createElement('div');
  overlay.id = 'focus-guard-overlay';
  overlay.innerHTML = `
    <div class="fg-overlay-content">
      <div class="fg-warning-icon">⚠️</div>
      <h1 class="fg-title">你分心了！</h1>
      <p class="fg-subtitle">专注时间还剩 <span class="fg-time">${timeStr}</span></p>
      <div class="fg-actions">
        <button class="fg-btn fg-btn-primary" id="fg-return">
          <span>返回专注页面</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14M12 5l7 7-7 7"></path>
          </svg>
        </button>
        <div class="fg-secondary-actions">
          <button class="fg-btn fg-btn-secondary" id="fg-break">休息 5 分钟</button>
          <button class="fg-btn fg-btn-secondary" id="fg-stop">结束专注</button>
        </div>
      </div>
      <p class="fg-distraction-count">本次专注分心 ${data.distractionCount} 次</p>
    </div>
  `;

  document.body.appendChild(overlay);

  // Event handlers
  document.getElementById('fg-return').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'RETURN_TO_FOCUS' });
  });

  document.getElementById('fg-break').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'TAKE_BREAK', minutes: 5 });
  });

  document.getElementById('fg-stop').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'STOP_FOCUS' });
    overlay.remove();
  });

  // Animate in
  requestAnimationFrame(() => {
    overlay.classList.add('fg-visible');
  });
}

async function clearAllOverlays() {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const overlay = document.getElementById('focus-guard-overlay');
          if (overlay) overlay.remove();
        }
      });
    } catch {
      // Ignore errors
    }
  }
}

async function returnToFocus() {
  if (state.focusPages.length === 0) return;

  const tabs = await chrome.tabs.query({});
  const focusTab = tabs.find(tab =>
    state.focusPages.some(page => matchUrl(page, tab.url))
  );

  if (focusTab) {
    await chrome.tabs.update(focusTab.id, { active: true });
    await chrome.windows.update(focusTab.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: state.focusPages[0].url });
  }

  clearAllOverlays();
}

async function playAlertSound() {
  // 方法1: 使用 TTS 语音提醒
  try {
    chrome.tts.speak('你分心了', {
      lang: 'zh-CN',
      rate: 1.2,
      volume: 1.0
    });
  } catch (e) {
    console.log('[FocusGuard] TTS not available');
  }

  // 方法2: 尝试在页面中播放音频
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]) {
    try {
      // 先获取音频URL（在service worker上下文中）
      const audioUrl = chrome.runtime.getURL('assets/alert.mp3');

      await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: (url) => {
          const audio = new Audio(url);
          audio.volume = 0.7;
          audio.play().catch(() => {});
        },
        args: [audioUrl]  // 传递已解析的URL
      });
    } catch (e) {
      console.log('[FocusGuard] Audio injection failed:', e);
    }
  }
}

function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'assets/icon-128.png',
    title,
    message,
    priority: 2
  });
}

function updateIcon(active) {
  const path = active ? {
    16: 'assets/icon-active-16.png',
    48: 'assets/icon-active-48.png'
  } : {
    16: 'assets/icon-16.png',
    48: 'assets/icon-48.png'
  };
  
  chrome.action.setIcon({ path }).catch(() => {
    chrome.action.setIcon({ 
      path: { 16: 'assets/icon-16.png', 48: 'assets/icon-48.png' } 
    });
  });
}

console.log('[FocusGuard] Service worker loaded');
