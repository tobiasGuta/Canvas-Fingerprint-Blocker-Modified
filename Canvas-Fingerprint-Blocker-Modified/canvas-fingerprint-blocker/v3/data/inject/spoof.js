(function() {
  'use strict';

  // --- 1. Session-Unique Noise Generation ---
  // These values are calculated freshly every time the page loads (document_start).
  // This ensures a unique fingerprint per session, preventing cross-session tracking.
  const SESSION_SEED = Math.random();
  const NOISE_AMPLITUDE = 0.0001; // Very subtle noise for float values
  
  // Canvas Noise: +/- 1 pixel for R, G, B channels
  // We determine the shift direction randomly per session
  const CANVAS_SHIFT = {
    r: Math.floor(Math.random() * 10) - 5,
    g: Math.floor(Math.random() * 10) - 5,
    b: Math.floor(Math.random() * 10) - 5
  };
  // Ensure we have at least some noise
  if (CANVAS_SHIFT.r === 0 && CANVAS_SHIFT.g === 0 && CANVAS_SHIFT.b === 0) {
    CANVAS_SHIFT.r = 1;
    CANVAS_SHIFT.g = -1;
  }

  // Helper to overwrite properties safely
  const overwrite = (object, property, value) => {
    try {
      Object.defineProperty(object, property, {
        get: () => value,
        configurable: true,
        enumerable: true
      });
    } catch(e) {}
  };

  // --- 2. Screen & Hardware Spoofing ---
  overwrite(window.screen, 'width', 1366);
  overwrite(window.screen, 'height', 768);
  overwrite(window.screen, 'availWidth', 1366);
  overwrite(window.screen, 'availHeight', 728);
  overwrite(window.screen, 'colorDepth', 24);
  overwrite(window.screen, 'pixelDepth', 24);
  overwrite(navigator, 'hardwareConcurrency', 4);
  overwrite(navigator, 'maxTouchPoints', 0);
  overwrite(navigator, 'platform', 'Win32');
  overwrite(navigator, 'oscpu', 'Windows NT 10.0; Win64; x64');
  overwrite(navigator, 'plugins', []);
  overwrite(navigator, 'mimeTypes', []);
  overwrite(navigator, 'cookieEnabled', true);

  // --- 3. Timezone Spoofing (America/New_York) ---
  try {
    const OriginalDateTimeFormat = Intl.DateTimeFormat;
    const proxyDateTimeFormat = new Proxy(OriginalDateTimeFormat, {
      construct(target, args) {
        const [locales, options = {}] = args;
        options.timeZone = 'America/New_York';
        return new target(locales, options);
      },
      apply(target, thisArg, args) {
        const [locales, options = {}] = args;
        options.timeZone = 'America/New_York';
        return target.apply(thisArg, [locales, options]);
      }
    });
    proxyDateTimeFormat.prototype = OriginalDateTimeFormat.prototype;
    Object.getOwnPropertyNames(OriginalDateTimeFormat).forEach(prop => {
        if (prop !== 'prototype' && prop !== 'length' && prop !== 'name') {
            try { proxyDateTimeFormat[prop] = OriginalDateTimeFormat[prop]; } catch(e) {}
        }
    });
    Intl.DateTimeFormat = proxyDateTimeFormat;
  } catch (e) {}

  // --- 4. Canvas Fingerprint Protection (Noise Injection) ---
  const applyCanvasNoise = (context, width, height) => {
    try {
      const imageData = context.getImageData(0, 0, width, height);
      const data = imageData.data;
      // Apply noise to a subset of pixels to save performance, but enough to change hash
      for (let i = 0; i < data.length; i += 40) { // Skip every 10 pixels (4 channels * 10)
        data[i] = data[i] + CANVAS_SHIFT.r;     // R
        data[i+1] = data[i+1] + CANVAS_SHIFT.g; // G
        data[i+2] = data[i+2] + CANVAS_SHIFT.b; // B
      }
      context.putImageData(imageData, 0, 0);
    } catch (e) {}
  };

  // Proxy toDataURL
  const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function(...args) {
    // Create a temporary canvas to avoid modifying the visible one
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.width;
    tempCanvas.height = this.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(this, 0, 0);
    
    applyCanvasNoise(tempCtx, this.width, this.height);
    return originalToDataURL.apply(tempCanvas, args);
  };

  // Proxy toBlob
  const originalToBlob = HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob = function(callback, ...args) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.width;
    tempCanvas.height = this.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(this, 0, 0);
    
    applyCanvasNoise(tempCtx, this.width, this.height);
    return originalToBlob.apply(tempCanvas, [callback, ...args]);
  };

  // Proxy getImageData
  const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
  CanvasRenderingContext2D.prototype.getImageData = function(...args) {
    const imageData = originalGetImageData.apply(this, args);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 40) {
        data[i] = data[i] + CANVAS_SHIFT.r;
        data[i+1] = data[i+1] + CANVAS_SHIFT.g;
        data[i+2] = data[i+2] + CANVAS_SHIFT.b;
    }
    return imageData;
  };

  // --- 5. WebGL Fingerprint Protection ---
  // Vendor/Renderer Spoofing
  try {
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter) {
      if (parameter === 37445) return 'Google Inc. (Intel)';
      if (parameter === 37446) return 'ANGLE (Intel, Intel(R) HD Graphics 620 Direct3D11 vs_5_0 ps_5_0)';
      return getParameter.apply(this, arguments);
    };
    if (typeof WebGL2RenderingContext !== 'undefined') {
        const getParameter2 = WebGL2RenderingContext.prototype.getParameter;
        WebGL2RenderingContext.prototype.getParameter = function(parameter) {
            if (parameter === 37445) return 'Google Inc. (Intel)';
            if (parameter === 37446) return 'ANGLE (Intel, Intel(R) HD Graphics 620 Direct3D11 vs_5_0 ps_5_0)';
            return getParameter2.apply(this, arguments);
        };
    }
  } catch (e) {}

  // WebGL ReadPixels Noise (The "Hash" Fix)
  const originalReadPixels = WebGLRenderingContext.prototype.readPixels;
  WebGLRenderingContext.prototype.readPixels = function(...args) {
    originalReadPixels.apply(this, args);
    const pixels = args[6]; // The TypedArray destination
    // Add noise to the buffer
    if (pixels) {
        for (let i = 0; i < pixels.length; i += 40) {
            pixels[i] = pixels[i] + CANVAS_SHIFT.r;
        }
    }
  };

  // --- 6. AudioContext Fingerprint Protection (Aggressive) ---
  try {
    const AUDIO_NOISE = (Math.random() * 0.0001) - 0.00005; // Unique per session

    // 1. Intercept AudioBuffer.prototype.getChannelData
    // This is the primary vector for reading the "fingerprint" from a rendered buffer
    const originalGetChannelData = AudioBuffer.prototype.getChannelData;
    Object.defineProperty(AudioBuffer.prototype, 'getChannelData', {
      value: function(channel) {
        const data = originalGetChannelData.apply(this, arguments);
        // Prevent noise accumulation if called multiple times on the same buffer
        if (this._isPoisoned) return data;
        this._isPoisoned = true;

        // Apply randomized jitter to the audio samples
        for (let i = 0; i < data.length; i += 50) {
            data[i] += AUDIO_NOISE;
        }
        return data;
      },
      writable: true,
      configurable: true
    });

    // 2. Intercept AnalyserNode methods (Frequency/TimeDomain data)
    const originalGetFloatFrequencyData = AnalyserNode.prototype.getFloatFrequencyData;
    AnalyserNode.prototype.getFloatFrequencyData = function(array) {
        const ret = originalGetFloatFrequencyData.apply(this, arguments);
        for (let i = 0; i < array.length; i += 20) {
            array[i] += AUDIO_NOISE;
        }
        return ret;
    };

    const originalGetByteFrequencyData = AnalyserNode.prototype.getByteFrequencyData;
    AnalyserNode.prototype.getByteFrequencyData = function(array) {
        const ret = originalGetByteFrequencyData.apply(this, arguments);
        for (let i = 0; i < array.length; i += 20) {
            // Cast noise to byte range
            array[i] += Math.floor(AUDIO_NOISE * 255);
        }
        return ret;
    };

    // 3. Intercept createAnalyser (AudioContext & OfflineAudioContext)
    // Ensures we catch creation of analysers even if they try to bypass prototypes
    const injectAnalyser = (proto) => {
        const originalCreateAnalyser = proto.createAnalyser;
        Object.defineProperty(proto, 'createAnalyser', {
            value: function() {
                const analyser = originalCreateAnalyser.apply(this, arguments);
                return analyser;
            },
            writable: true,
            configurable: true
        });
    };
    if (window.AudioContext) injectAnalyser(AudioContext.prototype);
    if (window.OfflineAudioContext) injectAnalyser(OfflineAudioContext.prototype);

  } catch (e) { console.error("Audio spoof failed", e); }

  // --- 7. Font Fingerprint Protection ---
  try {
    const elementProto = HTMLElement.prototype;
    const originalOffsetWidth = Object.getOwnPropertyDescriptor(elementProto, 'offsetWidth').get;
    const originalOffsetHeight = Object.getOwnPropertyDescriptor(elementProto, 'offsetHeight').get;

    Object.defineProperty(elementProto, 'offsetWidth', {
      get() {
        const width = originalOffsetWidth.apply(this);
        if (Math.random() < 0.01) { 
            return width + (Math.random() > 0.5 ? 1 : -1);
        }
        return width;
      },
      configurable: true
    });

    Object.defineProperty(elementProto, 'offsetHeight', {
      get() {
        const height = originalOffsetHeight.apply(this);
        if (Math.random() < 0.01) {
            return height + (Math.random() > 0.5 ? 1 : -1);
        }
        return height;
      },
      configurable: true
    });
  } catch (e) {}

})();
