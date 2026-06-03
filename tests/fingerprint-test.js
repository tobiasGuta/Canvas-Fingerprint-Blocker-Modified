'use strict';

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

window.__cfbActiveConfig = null;

window.__cfbTestReady = (async () => {
  const defaults = {
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
    profile: {
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
    }
  };

  const prefs = await chrome.storage.local.get(defaults);
  const port = document.createElement('div');
  port.id = 'cc-blck-fp';
  port.hidden = true;
  port.style.display = 'none';
  const config = {
    enabled: prefs.enabled,
    active: prefs.enabled,
    mode: prefs.mode,
    features: {
      ...defaults.features,
      ...(prefs.features || {})
    },
    dntMode: prefs.dntMode,
    notifications: prefs.notification,
    seed: String(prefs.sessionSeed || 'test-page'),
    profile: {
      ...defaults.profile,
      ...(prefs.profile || {}),
      screen: {
        ...defaults.profile.screen,
        ...((prefs.profile && prefs.profile.screen) || {})
      },
      webgl: normalizeWebGlProfile(prefs.profile && prefs.profile.webgl, prefs.mode)
    }
  };
  window.__cfbActiveConfig = config;
  port.dataset.config = JSON.stringify(config);
  document.documentElement.appendChild(port);

  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '../data/inject/main.js';
    script.onload = resolve;
    script.onerror = reject;
    document.documentElement.appendChild(script);
  });
})();

const hashBytes = input => {
  let hash = 2166136261;
  for (const value of input) {
    hash ^= value;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const hashString = input => {
  const bytes = new TextEncoder().encode(input);
  return hashBytes(bytes);
};

const drawCanvas = canvas => {
  const context = canvas.getContext('2d', {
    willReadFrequently: true
  });
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#124559';
  context.fillRect(10, 8, 70, 50);
  context.fillStyle = '#f4a261';
  context.font = '20px serif';
  context.fillText('Canvas', 92, 42);
  context.strokeStyle = '#2a9d8f';
  context.lineWidth = 3;
  context.beginPath();
  context.arc(185, 35, 22, 0, Math.PI * 2);
  context.stroke();
  return context;
};

const runNavigatorTests = () => {
  const output = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: navigator.deviceMemory,
    doNotTrack: navigator.doNotTrack,
    maxTouchPoints: navigator.maxTouchPoints
  };
  document.getElementById('navigator-output').textContent = JSON.stringify(output, null, 2);
};

const getUserAgentData = async () => {
  if (!navigator.userAgentData) {
    return null;
  }
  const output = {
    brands: navigator.userAgentData.brands,
    mobile: navigator.userAgentData.mobile,
    platform: navigator.userAgentData.platform
  };
  if (navigator.userAgentData.getHighEntropyValues) {
    try {
      output.highEntropy = await navigator.userAgentData.getHighEntropyValues([
        'architecture',
        'bitness',
        'fullVersionList',
        'model',
        'platformVersion',
        'uaFullVersion',
        'wow64'
      ]);
    }
    catch (error) {
      output.highEntropyError = error.message;
    }
  }
  return output;
};

const pluginDetails = () => Array.from(navigator.plugins || []).map(plugin => ({
  name: plugin.name,
  filename: plugin.filename,
  description: plugin.description,
  length: plugin.length
}));

const detectOsFromUserAgent = userAgent => {
  if (/Windows NT/i.test(userAgent)) {
    return 'windows';
  }
  if (/Mac OS X|Macintosh/i.test(userAgent)) {
    return 'macos';
  }
  if (/Android/i.test(userAgent)) {
    return 'android';
  }
  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    return 'ios';
  }
  if (/Linux|X11/i.test(userAgent)) {
    return 'linux';
  }
  return 'unknown';
};

const detectOsFromPlatform = platform => {
  if (/Win/i.test(platform || '')) {
    return 'windows';
  }
  if (/Mac/i.test(platform || '')) {
    return 'macos';
  }
  if (/Android/i.test(platform || '')) {
    return 'android';
  }
  if (/iPhone|iPad|iPod/i.test(platform || '')) {
    return 'ios';
  }
  if (/Linux/i.test(platform || '')) {
    return 'linux';
  }
  return 'unknown';
};

const webGlProfileWarnings = (profile, userAgentData = null) => {
  const warnings = [];
  if (!profile || profile.passthrough) {
    return warnings;
  }

  const userAgentOs = detectOsFromUserAgent(navigator.userAgent);
  const platformOs = detectOsFromPlatform(navigator.platform);
  const hintOs = userAgentData && userAgentData.platform
    ? detectOsFromPlatform(userAgentData.platform)
    : 'unknown';

  if (profile.expectedPlatform === 'windows') {
    if (userAgentOs !== 'windows') {
      warnings.push('Selected WebGL profile is Windows-oriented, but navigator.userAgent does not look Windows.');
    }
    if (platformOs !== 'windows') {
      warnings.push('Selected WebGL profile is Windows-oriented, but navigator.platform does not look Windows.');
    }
    if (hintOs !== 'unknown' && hintOs !== 'windows') {
      warnings.push('Selected WebGL profile is Windows-oriented, but User-Agent Client Hints platform does not look Windows.');
    }
  }

  return warnings;
};

const runScreenTests = () => {
  const output = {
    width: screen.width,
    height: screen.height,
    availWidth: screen.availWidth,
    availHeight: screen.availHeight,
    colorDepth: screen.colorDepth,
    pixelDepth: screen.pixelDepth,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  };
  document.getElementById('screen-output').textContent = JSON.stringify(output, null, 2);
};

const runCanvasTests = () => {
  const canvas = document.getElementById('canvas-sample');
  const context = drawCanvas(canvas);
  const dataUrl = canvas.toDataURL();
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const output = {
    dataUrlHash: hashString(dataUrl),
    imageDataHash: hashBytes(imageData.data),
    byteLength: imageData.data.length
  };
  document.getElementById('canvas-output').textContent = JSON.stringify(output, null, 2);
};

const inspectWebGlContext = contextName => {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext(contextName);
  if (!gl) {
    return null;
  }

  const supportedExtensions = gl.getSupportedExtensions() || [];
  const extension = gl.getExtension('WEBGL_debug_renderer_info');
  const maskedVendor = gl.getParameter(gl.VENDOR);
  const maskedRenderer = gl.getParameter(gl.RENDERER);
  const unmaskedVendor = extension ? gl.getParameter(extension.UNMASKED_VENDOR_WEBGL) : null;
  const unmaskedRenderer = extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : null;

  gl.clearColor(0.15, 0.25, 0.4, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  const pixels = new Uint8Array(16);
  gl.readPixels(0, 0, 2, 2, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

  return {
    context: contextName,
    maskedVendor,
    maskedRenderer,
    unmaskedVendor,
    unmaskedRenderer,
    debugRendererInfoListed: supportedExtensions.includes('WEBGL_debug_renderer_info'),
    debugRendererInfoReturned: Boolean(extension),
    readPixelsHash: hashBytes(pixels)
  };
};

const runWebGlTests = () => {
  const contexts = {
    webgl: inspectWebGlContext('webgl'),
    webgl2: inspectWebGlContext('webgl2')
  };
  if (!contexts.webgl && !contexts.webgl2) {
    document.getElementById('webgl-output').textContent = 'WebGL not available';
    return;
  }

  const availableContexts = Object.values(contexts).filter(Boolean);
  const first = availableContexts[0];
  
  const webglProfile = window.__cfbActiveConfig && window.__cfbActiveConfig.profile
    ? window.__cfbActiveConfig.profile.webgl
    : null;
  const webglProtectionEnabled = Boolean(window.__cfbActiveConfig && window.__cfbActiveConfig.features.webgl && window.__cfbActiveConfig.mode !== 'basic');

  let mode = 'passthrough';
  if (webglProtectionEnabled) {
    if (webglProfile && webglProfile.passthrough) {
      mode = 'noise-only';
    } else {
      mode = 'spoofed';
    }
  }

  const output = {
    activeProfileName: webglProfile ? webglProfile.label : 'None',
    webglMode: mode,
    webgl1: contexts.webgl ? {
      VENDOR: contexts.webgl.maskedVendor,
      RENDERER: contexts.webgl.maskedRenderer,
      UNMASKED_VENDOR_WEBGL: contexts.webgl.unmaskedVendor,
      UNMASKED_RENDERER_WEBGL: contexts.webgl.unmaskedRenderer,
      readPixelsHash: contexts.webgl.readPixelsHash
    } : null,
    webgl2: contexts.webgl2 ? {
      VENDOR: contexts.webgl2.maskedVendor,
      RENDERER: contexts.webgl2.maskedRenderer,
      UNMASKED_VENDOR_WEBGL: contexts.webgl2.unmaskedVendor,
      UNMASKED_RENDERER_WEBGL: contexts.webgl2.unmaskedRenderer,
      readPixelsHash: contexts.webgl2.readPixelsHash
    } : null,
    webgl1And2Match: availableContexts.length < 2 || availableContexts.every(context =>
      context.maskedVendor === first.maskedVendor &&
      context.maskedRenderer === first.maskedRenderer &&
      context.unmaskedVendor === first.unmaskedVendor &&
      context.unmaskedRenderer === first.unmaskedRenderer
    ),
    profileWarnings: webGlProfileWarnings(webglProfile, navigator.userAgentData || null)
  };
  document.getElementById('webgl-output').textContent = JSON.stringify(output, null, 2);
  return output;
};

const runProfileConsistencyTests = async () => {
  const webgl = runWebGlTests();
  const userAgentData = await getUserAgentData();
  const output = {
    userAgent: navigator.userAgent,
    userAgentData,
    platform: navigator.platform,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: navigator.deviceMemory,
    pluginsLength: navigator.plugins ? navigator.plugins.length : undefined,
    plugins: pluginDetails(),
    mimeTypesLength: navigator.mimeTypes ? navigator.mimeTypes.length : undefined,
    screen: {
      width: screen.width,
      height: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth
    },
    webgl,
    webglProfileWarnings: webGlProfileWarnings(webgl && webgl.selectedProfile, userAgentData),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    doNotTrack: {
      navigator: navigator.doNotTrack,
      window: window.doNotTrack
    }
  };
  document.getElementById('profile-output').textContent = JSON.stringify(output, null, 2);
};

const runAudioTests = async () => {
  const AudioContextClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!AudioContextClass) {
    document.getElementById('audio-output').textContent = 'Offline audio not available';
    return;
  }

  const context = new AudioContextClass(1, 44100, 44100);
  const oscillator = context.createOscillator();
  const compressor = context.createDynamicsCompressor();
  oscillator.type = 'triangle';
  oscillator.frequency.value = 880;
  compressor.threshold.value = -50;
  compressor.knee.value = 40;
  compressor.ratio.value = 12;
  compressor.attack.value = 0;
  compressor.release.value = 0.25;
  oscillator.connect(compressor);
  compressor.connect(context.destination);
  oscillator.start(0);

  const rendered = await context.startRendering();
  const channel = rendered.getChannelData(0);
  const sample = Array.from(channel.slice(0, 12)).map(value => Number(value.toFixed(6)));
  const output = {
    hash: hashBytes(new Uint8Array(new Float32Array(channel.slice(0, 256)).buffer)),
    sample
  };
  document.getElementById('audio-output').textContent = JSON.stringify(output, null, 2);
};

const runFontTests = () => {
  const host = document.createElement('div');
  host.style.position = 'absolute';
  host.style.left = '-9999px';
  host.style.top = '0';
  host.style.visibility = 'hidden';

  const probe = document.createElement('span');
  probe.style.fontFamily = '"Courier New", monospace';
  probe.style.fontSize = '32px';
  probe.textContent = 'fingerprint-font-check';
  host.appendChild(probe);
  document.body.appendChild(host);

  const widths = [];
  const heights = [];
  for (let index = 0; index < 10; index += 1) {
    widths.push(probe.offsetWidth);
    heights.push(probe.offsetHeight);
  }
  host.remove();

  const output = {
    widths,
    heights,
    widthStable: widths.every(value => value === widths[0]),
    heightStable: heights.every(value => value === heights[0])
  };
  document.getElementById('font-output').textContent = JSON.stringify(output, null, 2);
};

const runProtectionsTests = () => {
  return new Promise(resolve => {
    try {
      chrome.runtime.sendMessage({ method: 'debug-state' }, response => {
        const config = window.__cfbActiveConfig || {};
        const features = config.features || {};
        const profile = config.profile || {};
        
        let webglVendorSpoofing = 'off';
        let activeWebglProfile = 'none';

        if (features.webgl && config.mode !== 'basic') {
          if (profile.webgl && profile.webgl.passthrough) {
            webglVendorSpoofing = 'off';
            activeWebglProfile = `${profile.webgl.label} (${profile.webgl.profileId})`;
          } else {
            webglVendorSpoofing = 'on';
            activeWebglProfile = profile.webgl ? `${profile.webgl.label} (${profile.webgl.profileId})` : 'unknown';
          }
        }

        const debugState = response || {};
        
        const output = {
          currentMode: config.mode || 'unknown',
          enabled: config.enabled || false,
          active: config.active || false,
          activeWebglProfile: activeWebglProfile,
          webglVendorSpoofing: webglVendorSpoofing,
          dntHandlingMode: config.dntMode || 'respect',
          dntDnrRuleActive: debugState.dntRule1002Active || debugState.dntRule1003Active || false,
          screenNormalizationActive: features.screen ? 'yes' : 'no',
          currentScreenSpoofProfile: features.screen && profile.screen ? profile.screen : 'real values pass-through',
          currentNavigatorDoNotTrack: navigator.doNotTrack,
          currentWindowDoNotTrack: window.doNotTrack,
          currentScreenWidth: screen.width,
          currentScreenHeight: screen.height,
          currentScreenColorDepth: screen.colorDepth
        };
        const el = document.getElementById('protections-output');
        if (el) el.textContent = JSON.stringify(output, null, 2);
        resolve();
      });
    } catch(error) {
      resolve();
    }
  });
};

const runAll = async () => {
  await window.__cfbTestReady;
  await runProtectionsTests();
  await runProfileConsistencyTests();
  runNavigatorTests();
  runScreenTests();
  runCanvasTests();
  runWebGlTests();
  await runAudioTests();
  runFontTests();
};

document.getElementById('rerun').addEventListener('click', () => {
  runAll().catch(error => {
    console.error(error);
  });
});

runAll().catch(error => {
  console.error(error);
});
