(() => {
  'use strict';

  if (window.__cfbProtectionInstalled) {
    return;
  }
  window.__cfbProtectionInstalled = true;

  const PORT_ID = 'cc-blck-fp';
  const CONFIG_EVENT = 'cfb-config-updated';
  const GL_VENDOR = 7936;
  const GL_RENDERER = 7937;
  const DEBUG_VENDOR = 37445;
  const DEBUG_RENDERER = 37446;
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
  const defaults = {
    active: true,
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
    notifications: false,
    profile: DEFAULT_PROFILE,
    seed: '0'
  };

  const clampByte = value => Math.max(0, Math.min(255, value));
  const port = (() => {
    const root = document.documentElement || document;
    let node = document.getElementById(PORT_ID);
    if (!node) {
      node = document.createElement('div');
      node.id = PORT_ID;
      node.hidden = true;
      node.style.display = 'none';
      root.appendChild(node);
    }
    return node;
  })();

  const state = {
    config: defaults
  };

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

  const readConfig = () => {
    try {
      const raw = port.dataset.config;
      if (!raw) {
        state.config = defaults;
        return;
      }
      const parsed = JSON.parse(raw);
      state.config = {
        ...defaults,
        ...parsed,
        features: {
          ...defaults.features,
          ...(parsed.features || {})
        },
        profile: {
          ...DEFAULT_PROFILE,
          ...(parsed.profile || {}),
          screen: {
            ...DEFAULT_PROFILE.screen,
            ...((parsed.profile && parsed.profile.screen) || {})
          },
          webgl: normalizeWebGlProfile(parsed.profile && parsed.profile.webgl, parsed.mode || defaults.mode)
        }
      };
    }
    catch (error) {
      console.error('Canvas Blocker: failed to parse config', error);
      state.config = defaults;
    }
  };

  readConfig();
  port.addEventListener(CONFIG_EVENT, readConfig);
  new MutationObserver(readConfig).observe(port, {
    attributes: true,
    attributeFilter: ['data-config']
  });

  const isFeatureEnabled = name => state.config.active && state.config.enabled && state.config.features[name];
  const isProfileEnabled = () => state.config.active && state.config.enabled && state.config.mode !== 'basic';
  const isScreenProfileEnabled = () => isProfileEnabled() && state.config.features.screen;
  const isWebGlProfileEnabled = () => state.config.active && state.config.enabled && state.config.features.webgl && state.config.mode !== 'basic';
  const isWebGlVendorRendererSpoofEnabled = () => isWebGlProfileEnabled() && state.config.profile.webgl.passthrough !== true;
  const dntValue = () => {
    if (!isProfileEnabled()) {
      return;
    }
    if (state.config.dntMode === 'remove') {
      return null;
    }
    if (state.config.dntMode === 'disable') {
      return '0';
    }
  };

  const hashString = input => {
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  };

  const createPrng = seed => {
    let value = seed >>> 0;
    return () => {
      value += 0x6D2B79F5;
      let temp = value;
      temp = Math.imul(temp ^ (temp >>> 15), temp | 1);
      temp ^= temp + Math.imul(temp ^ (temp >>> 7), temp | 61);
      return ((temp ^ (temp >>> 14)) >>> 0) / 4294967296;
    };
  };

  const currentOrigin = () => {
    try {
      return location.origin || location.href || 'null';
    }
    catch (error) {
      return 'null';
    }
  };

  const seedFor = namespace => hashString([state.config.seed, currentOrigin(), namespace].join('|'));

  const canvasShiftFor = namespace => {
    const random = createPrng(seedFor(namespace));
    const shift = {
      r: Math.floor(random() * 5) - 2,
      g: Math.floor(random() * 5) - 2,
      b: Math.floor(random() * 5) - 2
    };
    if (shift.r === 0 && shift.g === 0 && shift.b === 0) {
      shift.r = 1;
    }
    return {
      ...shift,
      stride: 16 + Math.floor(random() * 31)
    };
  };

  const mutatePixelBuffer = (data, namespace) => {
    const shift = canvasShiftFor(namespace);
    const stride = Math.max(4, shift.stride * 4);
    for (let index = 0; index < data.length; index += stride) {
      data[index] = clampByte(data[index] + shift.r);
      if (index + 1 < data.length) {
        data[index + 1] = clampByte(data[index + 1] + shift.g);
      }
      if (index + 2 < data.length) {
        data[index + 2] = clampByte(data[index + 2] + shift.b);
      }
    }
  };

  const original2dGetImageData = CanvasRenderingContext2D.prototype.getImageData;
  const get2dContext = (canvasLike, settings = {}) => {
    try {
      return HTMLCanvasElement.prototype.getContext
        ? HTMLCanvasElement.prototype.getContext.call(canvasLike, '2d', settings)
        : canvasLike.getContext('2d', settings);
    }
    catch (error) {
      try {
        return canvasLike.getContext('2d', settings);
      }
      catch (innerError) {
        return null;
      }
    }
  };

  const makeExportCanvas = source => {
    const width = Number(source && source.width) || 0;
    const height = Number(source && source.height) || 0;
    if (width <= 0 || height <= 0) {
      return null;
    }

    let clone;
    if (typeof OffscreenCanvas !== 'undefined' && source instanceof OffscreenCanvas) {
      clone = new OffscreenCanvas(width, height);
    }
    else {
      clone = document.createElement('canvas');
      clone.width = width;
      clone.height = height;
    }

    const context = get2dContext(clone, {
      willReadFrequently: true
    });
    if (!context) {
      return null;
    }
    context.drawImage(source, 0, 0);

    try {
      const imageData = original2dGetImageData.call(context, 0, 0, width, height);
      mutatePixelBuffer(imageData.data, 'canvas-export');
      context.putImageData(imageData, 0, 0);
    }
    catch (error) {}

    return clone;
  };

  const reportFingerprintAttempt = (() => {
    let sent = false;
    return () => {
      if (sent || window.top !== window) {
        return;
      }
      sent = true;
      setTimeout(() => {
        sent = false;
      }, 1000);
      try {
        port.dispatchEvent(new CustomEvent('cfb-fingerprint-attempt'));
      }
      catch (error) {}
    };
  })();

  const installFunctionWrapper = (prototype, property, wrapperFactory) => {
    if (!prototype || !prototype[property] || prototype[property].__cfbWrapped) {
      return;
    }
    const original = prototype[property];
    const wrapped = wrapperFactory(original);
    Object.defineProperty(wrapped, '__cfbWrapped', {
      value: true
    });
    prototype[property] = wrapped;
  };

  const installGetterWrapper = (prototype, property, wrapperFactory) => {
    if (!prototype) {
      return;
    }
    const descriptor = Object.getOwnPropertyDescriptor(prototype, property);
    if (!descriptor || !descriptor.get || descriptor.get.__cfbWrapped) {
      return;
    }
    const wrapped = wrapperFactory(descriptor.get);
    Object.defineProperty(wrapped, '__cfbWrapped', {
      value: true
    });
    Object.defineProperty(prototype, property, {
      ...descriptor,
      get: wrapped
    });
  };

  installFunctionWrapper(HTMLCanvasElement.prototype, 'toDataURL', original => function(...args) {
    if (!isFeatureEnabled('canvas')) {
      return Reflect.apply(original, this, args);
    }
    reportFingerprintAttempt();
    const clone = makeExportCanvas(this);
    return Reflect.apply(original, clone || this, args);
  });

  installFunctionWrapper(HTMLCanvasElement.prototype, 'toBlob', original => function(callback, ...args) {
    if (!isFeatureEnabled('canvas')) {
      return Reflect.apply(original, this, [callback, ...args]);
    }
    reportFingerprintAttempt();
    const clone = makeExportCanvas(this);
    return Reflect.apply(original, clone || this, [callback, ...args]);
  });

  installFunctionWrapper(CanvasRenderingContext2D.prototype, 'getImageData', original => function(...args) {
    const imageData = Reflect.apply(original, this, args);
    if (!isFeatureEnabled('canvas')) {
      return imageData;
    }
    reportFingerprintAttempt();
    mutatePixelBuffer(imageData.data, 'canvas-read');
    return imageData;
  });

  if (typeof OffscreenCanvas !== 'undefined') {
    installFunctionWrapper(OffscreenCanvas.prototype, 'convertToBlob', original => function(...args) {
      if (!isFeatureEnabled('canvas')) {
        return Reflect.apply(original, this, args);
      }
      reportFingerprintAttempt();
      const clone = makeExportCanvas(this);
      return Reflect.apply(original, clone || this, args);
    });
  }

  if (typeof OffscreenCanvasRenderingContext2D !== 'undefined') {
    installFunctionWrapper(OffscreenCanvasRenderingContext2D.prototype, 'getImageData', original => function(...args) {
      const imageData = Reflect.apply(original, this, args);
      if (!isFeatureEnabled('canvas')) {
        return imageData;
      }
      reportFingerprintAttempt();
      mutatePixelBuffer(imageData.data, 'offscreen-canvas-read');
      return imageData;
    });
  }

  const createDebugRendererInfo = () => Object.freeze(Object.create(null, {
    UNMASKED_VENDOR_WEBGL: {
      value: DEBUG_VENDOR,
      enumerable: true
    },
    UNMASKED_RENDERER_WEBGL: {
      value: DEBUG_RENDERER,
      enumerable: true
    }
  }));

  const patchWebGlPrototype = prototype => {
    if (!prototype) {
      return;
    }

    installFunctionWrapper(prototype, 'getParameter', original => function(parameter) {
      if (isWebGlVendorRendererSpoofEnabled()) {
        if (parameter === GL_VENDOR) {
          reportFingerprintAttempt();
          return state.config.profile.webgl.maskedVendor;
        }
        if (parameter === GL_RENDERER) {
          reportFingerprintAttempt();
          return state.config.profile.webgl.maskedRenderer;
        }
        if (parameter === DEBUG_VENDOR) {
          const extensions = typeof this.getSupportedExtensions === 'function'
            ? this.getSupportedExtensions()
            : [];
          if (extensions && extensions.includes('WEBGL_debug_renderer_info')) {
            reportFingerprintAttempt();
            return state.config.profile.webgl.vendor;
          }
        }
        if (parameter === DEBUG_RENDERER) {
          const extensions = typeof this.getSupportedExtensions === 'function'
            ? this.getSupportedExtensions()
            : [];
          if (extensions && extensions.includes('WEBGL_debug_renderer_info')) {
            reportFingerprintAttempt();
            return state.config.profile.webgl.renderer;
          }
        }
      }
      return Reflect.apply(original, this, [parameter]);
    });

    installFunctionWrapper(prototype, 'getExtension', original => function(name) {
      const extension = Reflect.apply(original, this, [name]);
      if (!isWebGlVendorRendererSpoofEnabled()) {
        return extension;
      }
      if (typeof name === 'string' && name.toLowerCase() === 'webgl_debug_renderer_info') {
        if (!extension) {
          return extension;
        }
        reportFingerprintAttempt();
        return createDebugRendererInfo();
      }
      return extension;
    });

    installFunctionWrapper(prototype, 'getSupportedExtensions', original => function(...args) {
      const extensions = Reflect.apply(original, this, args);
      if (!isWebGlVendorRendererSpoofEnabled() || !Array.isArray(extensions)) {
        return extensions;
      }
      return extensions.slice();
    });

    installFunctionWrapper(prototype, 'readPixels', original => function(...args) {
      const result = Reflect.apply(original, this, args);
      if (!isFeatureEnabled('webgl')) {
        return result;
      }

      const pixels = args[6];
      if (!pixels || typeof pixels.length !== 'number' || typeof pixels.BYTES_PER_ELEMENT !== 'number') {
        return result;
      }

      reportFingerprintAttempt();
      const shift = canvasShiftFor('webgl-read');
      const stride = Math.max(1, shift.stride);
      for (let index = 0; index < pixels.length; index += stride) {
        const value = pixels[index];
        if (typeof value === 'number') {
          const delta = shift.r || 1;
          pixels[index] = typeof Uint8Array !== 'undefined' && pixels instanceof Uint8Array
            ? clampByte(value + delta)
            : value + delta;
        }
      }
      return result;
    });
  };

  patchWebGlPrototype(self.WebGLRenderingContext && WebGLRenderingContext.prototype);
  patchWebGlPrototype(self.WebGL2RenderingContext && WebGL2RenderingContext.prototype);

  const poisonedChannels = new WeakMap();

  if (self.AudioBuffer) {
    installFunctionWrapper(AudioBuffer.prototype, 'getChannelData', original => function(channel) {
      const data = Reflect.apply(original, this, [channel]);
      if (!isFeatureEnabled('audio')) {
        return data;
      }

      let channels = poisonedChannels.get(this);
      if (!channels) {
        channels = new Set();
        poisonedChannels.set(this, channels);
      }
      if (channels.has(channel)) {
        return data;
      }
      channels.add(channel);

      reportFingerprintAttempt();
      const random = createPrng(seedFor(`audio:${channel}:${this.length}`));
      const stride = 64 + Math.floor(random() * 64);
      const delta = (random() - 0.5) * 0.00002;
      for (let index = 0; index < data.length; index += stride) {
        data[index] += delta;
      }
      return data;
    });
  }

  const patchAnalyser = property => {
    if (!self.AnalyserNode || !AnalyserNode.prototype[property]) {
      return;
    }
    installFunctionWrapper(AnalyserNode.prototype, property, original => function(array) {
      const result = Reflect.apply(original, this, [array]);
      if (!isFeatureEnabled('audio') || !array || typeof array.length !== 'number') {
        return result;
      }
      reportFingerprintAttempt();
      const random = createPrng(seedFor(`analyser:${property}:${array.length}`));
      const stride = 24 + Math.floor(random() * 24);
      const delta = property.includes('Byte')
        ? Math.max(-1, Math.min(1, Math.round((random() - 0.5) * 2)))
        : (random() - 0.5) * 0.00002;
      for (let index = 0; index < array.length; index += stride) {
        array[index] += delta;
      }
      return result;
    });
  };

  patchAnalyser('getFloatFrequencyData');
  patchAnalyser('getByteFrequencyData');
  patchAnalyser('getFloatTimeDomainData');
  patchAnalyser('getByteTimeDomainData');

  const suspiciousFontElement = element => {
    if (!(element instanceof HTMLElement)) {
      return false;
    }
    const style = getComputedStyle(element);
    if (!style) {
      return false;
    }
    const hidden = style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0;
    const detached = !element.isConnected;
    const probePosition = style.position === 'absolute' || style.position === 'fixed';
    const smallProbe = (element.textContent || '').length <= 64;
    return smallProbe && (hidden || detached || probePosition);
  };

  const fontAdjustments = new WeakMap();
  const fontDeltaFor = (element, property) => {
    let entry = fontAdjustments.get(element);
    if (!entry) {
      const basis = [
        property,
        element.tagName,
        element.id,
        element.className,
        element.textContent || '',
        getComputedStyle(element).fontFamily || ''
      ].join('|');
      const random = createPrng(seedFor(`font:${basis}`));
      entry = {
        offsetWidth: random() > 0.85 ? 1 : 0,
        offsetHeight: random() > 0.9 ? 1 : 0
      };
      fontAdjustments.set(element, entry);
    }
    return entry[property] || 0;
  };

  const patchOffset = property => {
    installGetterWrapper(HTMLElement.prototype, property, original => function() {
      const value = Reflect.apply(original, this, []);
      if (!isFeatureEnabled('font') || !suspiciousFontElement(this) || value <= 0) {
        return value;
      }
      reportFingerprintAttempt();
      return value + fontDeltaFor(this, property);
    });
  };

  patchOffset('offsetWidth');
  patchOffset('offsetHeight');

  const makeNamedCollection = entries => {
    const collection = {};
    const byName = new Map();

    entries.forEach((entry, index) => {
      const normalized = Object.freeze({
        ...entry,
        enabledPlugin: entry.enabledPlugin || null
      });
      collection[index] = normalized;
      if (normalized.name) {
        byName.set(normalized.name, normalized);
      }
      if (normalized.type) {
        byName.set(normalized.type, normalized);
      }
    });

    Object.defineProperties(collection, {
      length: {
        value: entries.length,
        enumerable: false
      },
      item: {
        value(index) {
          return this[index] || null;
        },
        enumerable: false
      },
      namedItem: {
        value(name) {
          return byName.get(name) || null;
        },
        enumerable: false
      },
      refresh: {
        value() {},
        enumerable: false
      },
      [Symbol.iterator]: {
        value: function* iterator() {
          for (let index = 0; index < entries.length; index += 1) {
            yield this[index];
          }
        },
        enumerable: false
      }
    });

    for (const [name, value] of byName) {
      if (/^[A-Za-z_$][\w$]*$/.test(name) && !(name in collection)) {
        Object.defineProperty(collection, name, {
          value,
          enumerable: false
        });
      }
    }

    return Object.freeze(collection);
  };

  const pdfPlugin = Object.freeze({
    name: 'PDF Viewer',
    filename: 'internal-pdf-viewer',
    description: 'Portable Document Format'
  });
  const pdfMimeType = Object.freeze({
    type: 'application/pdf',
    suffixes: 'pdf',
    description: 'Portable Document Format',
    enabledPlugin: pdfPlugin
  });
  const normalizedPlugins = makeNamedCollection([{
    ...pdfPlugin,
    0: pdfMimeType,
    length: 1,
    item(index) {
      return index === 0 ? pdfMimeType : null;
    },
    namedItem(name) {
      return name === pdfMimeType.type ? pdfMimeType : null;
    }
  }]);
  const normalizedMimeTypes = makeNamedCollection([pdfMimeType]);

  const patchValueGetter = (prototype, property, resolver) => {
    installGetterWrapper(prototype, property, original => function() {
      if (!isProfileEnabled()) {
        return Reflect.apply(original, this, []);
      }
      return resolver.call(this, () => Reflect.apply(original, this, []));
    });
  };

  patchValueGetter(Navigator.prototype, 'hardwareConcurrency', () => state.config.profile.hardwareConcurrency);
  if (Object.getOwnPropertyDescriptor(Navigator.prototype, 'deviceMemory')) {
    patchValueGetter(Navigator.prototype, 'deviceMemory', () => state.config.profile.deviceMemory);
  }
  patchValueGetter(Navigator.prototype, 'maxTouchPoints', original => {
    const value = state.config.profile.maxTouchPoints;
    return typeof value === 'number' ? value : original();
  });
  patchValueGetter(Navigator.prototype, 'platform', original => state.config.profile.platform || original());
  patchValueGetter(Navigator.prototype, 'doNotTrack', original => {
    const value = dntValue();
    return value === undefined ? original() : value;
  });
  if (Object.getOwnPropertyDescriptor(Window.prototype, 'doNotTrack')) {
    patchValueGetter(Window.prototype, 'doNotTrack', original => {
      const value = dntValue();
      return value === undefined ? original() : value;
    });
  } else if (self.doNotTrack !== undefined) {
    const originalDnt = self.doNotTrack;
    Object.defineProperty(self, 'doNotTrack', {
      get: () => {
        const value = dntValue();
        return value === undefined ? originalDnt : value;
      }
    });
  }
  if (Object.getOwnPropertyDescriptor(Navigator.prototype, 'plugins')) {
    patchValueGetter(Navigator.prototype, 'plugins', original => {
      if (!isFeatureEnabled('plugins')) {
        return original();
      }
      return normalizedPlugins;
    });
  }
  if (Object.getOwnPropertyDescriptor(Navigator.prototype, 'mimeTypes')) {
    patchValueGetter(Navigator.prototype, 'mimeTypes', original => {
      if (!isFeatureEnabled('plugins')) {
        return original();
      }
      return normalizedMimeTypes;
    });
  }

  if (Object.getOwnPropertyDescriptor(Navigator.prototype, 'oscpu')) {
    patchValueGetter(Navigator.prototype, 'oscpu', original => state.config.profile.oscpu || original());
  }

  for (const property of ['width', 'height', 'availWidth', 'availHeight', 'colorDepth', 'pixelDepth']) {
    const hook = original => {
      if (!isScreenProfileEnabled()) {
        return original();
      }
      const value = state.config.profile.screen[property];
      return typeof value === 'number' ? value : original();
    };

    patchValueGetter(Screen.prototype, property, hook);

    if (self.screen) {
      const descriptor = Object.getOwnPropertyDescriptor(self.screen, property);
      if (descriptor && descriptor.get && !descriptor.get.__cfbWrapped) {
        patchValueGetter(self.screen, property, hook);
      } else if (!descriptor || (!descriptor.get && descriptor.writable)) {
        let originalValue = self.screen[property];
        Object.defineProperty(self.screen, property, {
          get: () => hook(() => originalValue),
          set: value => { originalValue = value; }
        });
      }
    }
  }

  if (self.Intl && Intl.DateTimeFormat) {
    const OriginalDateTimeFormat = Intl.DateTimeFormat;
    const wrapOptions = options => {
      const next = {
        ...(options || {})
      };
      if (isProfileEnabled()) {
        next.timeZone = state.config.profile.timezone;
      }
      return next;
    };

    const WrappedDateTimeFormat = new Proxy(OriginalDateTimeFormat, {
      apply(target, thisArg, args) {
        const [locales, options] = args;
        return Reflect.apply(target, thisArg, [locales, wrapOptions(options)]);
      },
      construct(target, args) {
        const [locales, options] = args;
        return Reflect.construct(target, [locales, wrapOptions(options)]);
      }
    });
    WrappedDateTimeFormat.prototype = OriginalDateTimeFormat.prototype;
    Intl.DateTimeFormat = WrappedDateTimeFormat;

    installFunctionWrapper(Intl.DateTimeFormat.prototype, 'resolvedOptions', original => function(...args) {
      const options = Reflect.apply(original, this, args);
      if (!isProfileEnabled()) {
        return options;
      }
      return {
        ...options,
        timeZone: state.config.profile.timezone
      };
    });
  }
})();
