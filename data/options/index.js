'use strict';

const toast = document.getElementById('toast');
const mode = document.getElementById('mode');

const WEBGL_PROFILES = {
  passthrough: {
    id: 'passthrough',
    label: 'Passthrough / Real WebGL',
    passthrough: true
  },
  'noise-only': {
    id: 'noise-only',
    label: 'Disable WebGL vendor spoofing but keep WebGL hash noise',
    passthrough: true
  },
  'edge-windows-intel': {
    id: 'edge-windows-intel',
    label: 'Common Edge/Windows Intel profile',
    expectedPlatform: 'windows',
    maskedVendor: 'WebKit',
    maskedRenderer: 'WebKit WebGL',
    vendor: 'Google Inc. (Intel)',
    renderer: 'ANGLE (Intel, Intel(R) Graphics Direct3D11 vs_5_0 ps_5_0)'
  }
};

const LEGACY_WEBGL_PROFILE_IDS = {
  'chromium-generic': 'noise-only',
  'chromium-edge-intel': 'noise-only',
  'integrated-intel': 'edge-windows-intel',
  'normalized-intel': 'noise-only'
};

const WEBGL_PROFILE_BY_MODE = {
  standard: 'noise-only',
  strict: 'edge-windows-intel'
};

const DEFAULT_WEBGL_PROFILE_ID = WEBGL_PROFILE_BY_MODE.standard;

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
    ...WEBGL_PROFILES[DEFAULT_WEBGL_PROFILE_ID],
    profileId: DEFAULT_WEBGL_PROFILE_ID
  }
};

let loadedProfile = DEFAULT_PROFILE;

const FEATURE_IDS = {
  canvas: 'feature-canvas',
  webgl: 'feature-webgl',
  audio: 'feature-audio',
  font: 'feature-font',
  headers: 'feature-headers',
  plugins: 'feature-plugins',
  screen: 'feature-screen'
};

const DEFAULTS = {
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

const PRESETS = {
  basic: {
    canvas: true,
    webgl: false,
    audio: false,
    font: false,
    headers: false,
    plugins: false,
    screen: false
  },
  standard: {
    canvas: true,
    webgl: true,
    audio: true,
    font: false,
    headers: false,
    plugins: false,
    screen: false
  },
  strict: {
    canvas: true,
    webgl: true,
    audio: true,
    font: true,
    headers: true,
    plugins: true,
    screen: true
  }
};

const DNT_PRESETS = {
  basic: 'respect',
  standard: 'respect',
  strict: 'remove'
};

const normalizeWebGlProfile = (profile, currentMode) => {
  const profileId = profile && profile.profileId;
  const mappedId = LEGACY_WEBGL_PROFILE_IDS[profileId] || profileId;
  const selectedId = mappedId && WEBGL_PROFILES[mappedId]
    ? mappedId
    : WEBGL_PROFILE_BY_MODE[currentMode] || DEFAULT_WEBGL_PROFILE_ID;
  return {
    ...WEBGL_PROFILES[selectedId],
    profileId: selectedId
  };
};

const normalizeProfile = prefs => {
  const profile = prefs.profile || {};
  return {
    ...DEFAULT_PROFILE,
    ...profile,
    hardwareConcurrency: Number(profile.hardwareConcurrency) || DEFAULT_PROFILE.hardwareConcurrency,
    deviceMemory: Number(profile.deviceMemory) || DEFAULT_PROFILE.deviceMemory,
    screen: {
      ...DEFAULT_PROFILE.screen,
      ...(profile.screen || {})
    },
    webgl: normalizeWebGlProfile(profile.webgl, prefs.mode || DEFAULTS.mode)
  };
};

const selectedWebGlProfile = () => {
  const profileId = document.getElementById('webgl-profile').value;
  const profile = WEBGL_PROFILES[profileId] || WEBGL_PROFILES[DEFAULT_WEBGL_PROFILE_ID];
  return {
    ...profile,
    profileId: profile.id
  };
};

const numberFromInput = (id, fallback) => {
  const value = Number(document.getElementById(id).value);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const writeProfile = profile => {
  document.getElementById('webgl-profile').value = profile.webgl.profileId || DEFAULT_WEBGL_PROFILE_ID;
  document.getElementById('hardware-concurrency').value = profile.hardwareConcurrency;
  document.getElementById('device-memory').value = profile.deviceMemory;
};

const readProfile = () => ({
  ...loadedProfile,
  hardwareConcurrency: numberFromInput('hardware-concurrency', DEFAULT_PROFILE.hardwareConcurrency),
  deviceMemory: numberFromInput('device-memory', DEFAULT_PROFILE.deviceMemory),
  webgl: selectedWebGlProfile()
});

const normalizeHostnames = value => value
  .split(',')
  .map(entry => entry.trim())
  .map(entry => {
    if (!entry) {
      return '';
    }
    if (entry.startsWith('http://') || entry.startsWith('https://') || entry.startsWith('ftp://')) {
      try {
        return new URL(entry).hostname;
      }
      catch (error) {
        return '';
      }
    }
    return entry;
  })
  .filter((entry, index, all) => entry && all.indexOf(entry) === index);

const readFeatures = () => Object.fromEntries(
  Object.entries(FEATURE_IDS).map(([key, id]) => [key, document.getElementById(id).checked])
);

const writeFeatures = features => {
  for (const [key, id] of Object.entries(FEATURE_IDS)) {
    document.getElementById(id).checked = Boolean(features[key]);
  }
};

mode.addEventListener('change', () => {
  writeFeatures(PRESETS[mode.value] || PRESETS.standard);
  document.getElementById('dnt-mode').value = DNT_PRESETS[mode.value] || 'respect';
  document.getElementById('webgl-profile').value = WEBGL_PROFILE_BY_MODE[mode.value] || DEFAULT_WEBGL_PROFILE_ID;
  document.getElementById('reload-warning').style.display = 'block';
});

document.addEventListener('change', (e) => {
  if (e.target !== document.getElementById('mode') && e.target !== document.getElementById('save')) {
    document.getElementById('reload-warning').style.display = 'block';
  }
});

const updateDebugState = () => {
  try {
    chrome.runtime.sendMessage({ method: 'debug-state' }, response => {
      const el = document.getElementById('debug-output');
      if (el) {
        if (!response) {
          el.textContent = 'Error: No response from background. Is the extension loaded?';
          return;
        }
        
        const prefs = response.prefs || {};
        const features = prefs.features || {};
        const profile = prefs.profile || {};
        const webglModeActive = features.webgl && prefs.mode !== 'basic';
        const webglPassthrough = profile.webgl && profile.webgl.passthrough;

        const output = {
          currentMode: prefs.mode || 'unknown',
          enabled: prefs.enabled || false,
          webglProfileId: profile.webgl ? profile.webgl.profileId : 'unknown',
          webglVendorSpoofingActive: webglModeActive && !webglPassthrough,
          dntMode: prefs.dntMode || 'respect',
          dntDnrRuleActive: response.dntRule1002Active || response.dntRule1003Active || false,
          screenNormalizationActive: features.screen || false,
          currentScreenProfile: features.screen && profile.screen ? profile.screen : 'real values pass-through'
        };
        el.textContent = JSON.stringify(output, null, 2);
      }
    });
  } catch(err) {
    const el = document.getElementById('debug-output');
    if (el) el.textContent = 'Error loading debug state.';
  }
};

document.getElementById('save').addEventListener('click', () => {
  const list = normalizeHostnames(document.getElementById('list').value);
  const notificationList = normalizeHostnames(document.getElementById('notification.list').value);

  document.getElementById('list').value = list.join(', ');
  document.getElementById('notification.list').value = notificationList.join(', ');

  chrome.storage.local.set({
    mode: mode.value,
    features: readFeatures(),
    dntMode: document.getElementById('dnt-mode').value,
    notification: document.getElementById('notification').checked,
    'notification.list': notificationList,
    list,
    profile: readProfile()
  }, () => {
    toast.textContent = 'Options saved';
    document.getElementById('reload-warning').style.display = 'block';
    updateDebugState();
    setTimeout(() => {
      toast.textContent = '';
    }, 900);
  });
});

document.getElementById('reset').addEventListener('click', event => {
  if (event.detail === 1) {
    toast.textContent = 'Double-click to reset';
    setTimeout(() => {
      toast.textContent = '';
    }, 900);
    return;
  }

  chrome.storage.local.clear(() => {
    chrome.runtime.reload();
    window.close();
  });
});

document.getElementById('support').addEventListener('click', () => chrome.tabs.create({
  url: chrome.runtime.getManifest().homepage_url + '?rd=donate'
}));

chrome.storage.local.get(DEFAULTS, prefs => {
  document.getElementById('notification').checked = prefs.notification;
  document.getElementById('list').value = prefs.list.join(', ');
  document.getElementById('notification.list').value = prefs['notification.list'].join(', ');
  mode.value = prefs.mode;
  document.getElementById('dnt-mode').value = prefs.dntMode;
  loadedProfile = normalizeProfile(prefs);
  writeProfile(loadedProfile);
  writeFeatures({
    ...PRESETS[prefs.mode],
    ...(prefs.features || {})
  });
  updateDebugState();
});
