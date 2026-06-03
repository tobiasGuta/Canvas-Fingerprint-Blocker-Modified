'use strict';

const WEBGL_PROFILES = {
  'noise-only': {
    id: 'noise-only',
    label: 'Disable WebGL vendor spoofing but keep WebGL hash noise',
    passthrough: true
  }
};

const DEFAULT_PROFILE = {
  platform: 'Win32',
  oscpu: 'Windows NT 10.0; Win64; x64',
  timezone: 'America/New_York',
  hardwareConcurrency: 4,
  deviceMemory: 8,
  maxTouchPoints: 0,
  doNotTrack: null,
  screen: {
    width: 1366,
    height: 768,
    availWidth: 1366,
    availHeight: 728,
    colorDepth: 24,
    pixelDepth: 24
  },
  webgl: {
    ...WEBGL_PROFILES['noise-only'],
    profileId: 'noise-only'
  }
};

const DEFAULTS = {
  enabled: true,
  mode: 'standard',
  features: {
    canvas: true,
    webgl: true,
    audio: true,
    font: false,
    headers: false,
    plugins: false,
    screen: false
  },
  dntMode: 'respect',
  notification: false,
  'notification.list': [],
  list: [],
  profile: DEFAULT_PROFILE
};

const INSTALL_DEFAULTS = {
  enabled: DEFAULTS.enabled,
  mode: DEFAULTS.mode,
  features: DEFAULTS.features,
  dntMode: DEFAULTS.dntMode,
  notification: DEFAULTS.notification,
  'notification.list': DEFAULTS['notification.list'],
  list: DEFAULTS.list
};

const notify = async message => {
  const id = await chrome.notifications.create({
    type: 'basic',
    title: chrome.runtime.getManifest().name,
    message,
    iconUrl: '/data/icons/48.png'
  });
  setTimeout(chrome.notifications.clear, 3000, id);
};

const generateSessionSeed = () => {
  const values = new Uint32Array(2);
  crypto.getRandomValues(values);
  return `${Date.now().toString(36)}-${values[0].toString(36)}${values[1].toString(36)}`;
};

const getStoredPreferences = () => chrome.storage.local.get(DEFAULTS);

const setGlobalActionState = enabled => {
  chrome.action.setBadgeText({
    text: enabled ? '' : '×'
  });
  chrome.action.setTitle({
    title: enabled ? 'Protection enabled' : 'Protection disabled'
  });
  chrome.action.setIcon({
    path: enabled ? {
      '16': '/data/icons/enabled/16.png',
      '32': '/data/icons/enabled/32.png',
      '48': '/data/icons/enabled/48.png'
    } : {
      '16': '/data/icons/16.png',
      '32': '/data/icons/32.png',
      '48': '/data/icons/48.png'
    }
  });
};

const withTabId = (sender, callback) => {
  if (!sender.tab || typeof sender.tab.id !== 'number') {
    return;
  }
  callback(sender.tab.id);
};

const headerResourceTypes = [
  'main_frame',
  'sub_frame',
  'xmlhttprequest'
];

const syncHeaderRules = async prefs => {
  const rules = [];
  const removeRuleIds = [1001, 1002, 1003];

  if (prefs.enabled && prefs.features && prefs.features.headers) {
    rules.push({
      id: 1001,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [{
          header: 'If-None-Match',
          operation: 'remove'
        }],
        responseHeaders: [{
          header: 'ETag',
          operation: 'remove'
        }]
      },
      condition: {
        urlFilter: '*',
        resourceTypes: headerResourceTypes
      }
    });
  }

  if (prefs.enabled && prefs.dntMode === 'remove') {
    rules.push({
      id: 1002,
      priority: 2,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [{
          header: 'DNT',
          operation: 'remove'
        }]
      },
      condition: {
        urlFilter: '*',
        resourceTypes: headerResourceTypes
      }
    });
  }
  else if (prefs.enabled && prefs.dntMode === 'disable') {
    rules.push({
      id: 1003,
      priority: 2,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [{
          header: 'DNT',
          operation: 'set',
          value: '0'
        }]
      },
      condition: {
        urlFilter: '*',
        resourceTypes: headerResourceTypes
      }
    });
  }

  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds,
    addRules: rules
  });
};

const initializeSessionSeed = async force => {
  const prefs = await getStoredPreferences();
  if (!prefs.sessionSeed || force) {
    await chrome.storage.local.set({
      sessionSeed: generateSessionSeed()
    });
  }
};

const applyStartupState = async forceSeed => {
  await initializeSessionSeed(forceSeed);
  const prefs = await getStoredPreferences();
  await syncHeaderRules(prefs);
  setGlobalActionState(prefs.enabled);
};

chrome.runtime.onInstalled.addListener(details => {
  applyStartupState(true).catch(error => {
    console.error(error);
    notify('Unexpected error during install setup.');
  });

  if (details.reason === 'install') {
    chrome.storage.local.set(INSTALL_DEFAULTS);
  }
});

chrome.runtime.onStartup.addListener(() => {
  applyStartupState(true).catch(error => {
    console.error(error);
  });
});

chrome.storage.onChanged.addListener(() => {
  applyStartupState(false).catch(error => {
    console.error(error);
  });
});

chrome.runtime.onMessage.addListener((request, sender) => {
  if (request.method === 'possible-fingerprint') {
    withTabId(sender, tabId => {
      chrome.action.setIcon({
        tabId,
        path: {
          '16': '/data/icons/detected/16.png',
          '32': '/data/icons/detected/32.png',
          '48': '/data/icons/detected/48.png'
        }
      });
      chrome.action.setTitle({
        tabId,
        title: 'Fingerprinting access detected'
      });
    });

    getStoredPreferences().then(prefs => {
      if (!prefs.notification || !sender.tab) {
        return;
      }
      try {
        const url = sender.tab.url ? new URL(sender.tab.url) : null;
        if (url && prefs['notification.list'].includes(url.hostname)) {
          return;
        }
      }
      catch (error) {}
      notify(`Fingerprinting access was detected on "${sender.tab.title || 'this page'}".`);
    });
  }
  else if (request.method === 'debug-state') {
    Promise.all([
      getStoredPreferences(),
      chrome.declarativeNetRequest.getSessionRules()
    ]).then(([prefs, rules]) => {
      if (typeof sendResponse === 'function') {
        sendResponse({
          prefs,
          sessionRules: rules,
          dntRule1002Active: rules.some(r => r.id === 1002),
          dntRule1003Active: rules.some(r => r.id === 1003),
          headerRule1001Active: rules.some(r => r.id === 1001)
        });
      }
    }).catch(error => {
      if (typeof sendResponse === 'function') {
        sendResponse({ error: error.message });
      }
    });
    return true;
  }
  else if (request.method === 'enabled') {
    withTabId(sender, tabId => {
      chrome.action.setBadgeText({
        tabId,
        text: ''
      });
      chrome.action.setTitle({
        tabId,
        title: 'Protection enabled on this page'
      });
    });
  }
  else if (request.method === 'disabled') {
    withTabId(sender, tabId => {
      chrome.action.setBadgeText({
        tabId,
        text: '×'
      });
      chrome.action.setTitle({
        tabId,
        title: 'Protection disabled on this page'
      });
    });
  }
});

chrome.action.onClicked.addListener(async () => {
  const prefs = await getStoredPreferences();
  await chrome.storage.local.set({
    enabled: !prefs.enabled
  });
});

const createContextMenus = () => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'add-to-exception-list',
      title: 'Allow on This Hostname',
      contexts: ['action']
    });
    chrome.contextMenus.create({
      id: 'disable-notification',
      title: 'Disable Notifications on This Hostname',
      contexts: ['action']
    });
    chrome.contextMenus.create({
      id: 'test-fingerprint',
      title: 'Open Local Test Page',
      contexts: ['action']
    });
  });
};

chrome.runtime.onInstalled.addListener(createContextMenus);
chrome.runtime.onStartup.addListener(createContextMenus);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'test-fingerprint') {
    chrome.tabs.create({
      url: chrome.runtime.getURL('tests/fingerprint-test.html')
    });
    return;
  }

  const url = tab && tab.url ? tab.url : info.pageUrl;
  if (!url || !url.startsWith('http')) {
    notify('This action is only available on normal web pages.');
    return;
  }

  const hostname = new URL(url).hostname;

  if (info.menuItemId === 'add-to-exception-list') {
    chrome.storage.local.get({
      list: []
    }, prefs => {
      if (prefs.list.includes(hostname)) {
        notify('This hostname is already on the allow list.');
        return;
      }
      prefs.list.push(hostname);
      chrome.storage.local.set({
        list: prefs.list
      });
      notify(`"${hostname}" was added to the allow list.`);
    });
  }
  else if (info.menuItemId === 'disable-notification') {
    chrome.storage.local.get({
      'notification.list': []
    }, prefs => {
      if (prefs['notification.list'].includes(hostname)) {
        notify('This hostname is already on the notification exception list.');
        return;
      }
      prefs['notification.list'].push(hostname);
      chrome.storage.local.set({
        'notification.list': prefs['notification.list']
      });
      notify(`Notifications were disabled for "${hostname}".`);
    });
  }
});

applyStartupState(false).catch(error => {
  console.error(error);
});
