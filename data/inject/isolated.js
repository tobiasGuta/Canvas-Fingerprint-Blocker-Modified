const PORT_ID = 'cc-blck-fp';
const CONFIG_EVENT = 'cfb-config-updated';
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
    ...WEBGL_PROFILES[DEFAULT_WEBGL_PROFILE_ID]
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

const getPort = () => {
  const root = document.documentElement || document;
  let port = document.getElementById(PORT_ID);
  if (!port) {
    port = document.createElement('div');
    port.id = PORT_ID;
    port.hidden = true;
    port.style.display = 'none';
    root.appendChild(port);
  }
  return port;
};

const hostname = (() => {
  try {
    return location.hostname;
  }
  catch (error) {
    return '';
  }
})();

const port = getPort();

const normalizeWebGlProfile = (profile, mode) => {
  const profileId = profile && profile.profileId;
  const mappedId = LEGACY_WEBGL_PROFILE_IDS[profileId] || profileId;
  const selectedId = mappedId && WEBGL_PROFILES[mappedId]
    ? mappedId
    : WEBGL_PROFILE_BY_MODE[mode] || DEFAULT_WEBGL_PROFILE_ID;
  return {
    ...WEBGL_PROFILES[selectedId],
    profileId: selectedId
  };
};

const buildConfig = prefs => {
  const features = {
    ...DEFAULTS.features,
    ...(prefs.features || {})
  };
  const profile = {
    ...DEFAULT_PROFILE,
    ...(prefs.profile || {}),
    screen: {
      ...DEFAULT_PROFILE.screen,
      ...((prefs.profile && prefs.profile.screen) || {})
    },
    webgl: normalizeWebGlProfile(prefs.profile && prefs.profile.webgl, prefs.mode)
  };

  return {
    enabled: prefs.enabled,
    active: prefs.enabled && prefs.list.includes(hostname) === false,
    mode: prefs.mode,
    features,
    dntMode: prefs.dntMode,
    notifications: prefs.notification,
    seed: String(prefs.sessionSeed || '0'),
    profile
  };
};

const applyConfig = prefs => {
  const config = buildConfig(prefs);
  port.dataset.config = JSON.stringify(config);
  port.dispatchEvent(new CustomEvent(CONFIG_EVENT, {
    detail: config
  }));

  if (window.top === window) {
    try {
      chrome.runtime.sendMessage({
        method: config.active ? 'enabled' : 'disabled'
      });
    }
    catch (error) {}
  }
};

port.addEventListener('cfb-fingerprint-attempt', event => {
  event.stopPropagation();
  try {
    chrome.runtime.sendMessage({
      method: 'possible-fingerprint'
    });
  }
  catch (error) {}
});

const loadConfig = async () => {
  const prefs = await chrome.storage.local.get(DEFAULTS);
  applyConfig(prefs);
};

loadConfig().catch(error => {
  console.error('Canvas Blocker: failed to load config', error);
});

chrome.storage.onChanged.addListener(changes => {
  if (changes.mode && changes.mode.newValue) {
    port.dataset.mode = changes.mode.newValue;
  }

  const relevant = [
    'enabled',
    'mode',
    'features',
    'notification',
    'notification.list',
    'list',
    'dntMode',
    'profile',
    'sessionSeed'
  ];

  if (relevant.some(key => key in changes)) {
    loadConfig().catch(error => {
      console.error('Canvas Blocker: failed to refresh config', error);
    });
  }
});
