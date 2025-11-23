# Canvas Fingerprint Blocker (Modified)

This is a modified version of the [Canvas Fingerprint Blocker](https://github.com/joue-quroi/canvas-fingerprint-blocker) extension.

## Overview

This extension prevents HTML canvas element from generating a unique identification key to protect user's privacy. It works by adding slight noise to the canvas data, making the fingerprint inconsistent and unique for each session.

## Modifications & Improvements

This version has been upgraded into a comprehensive **"Anti-Fingerprinting" Suite** designed to make the user "Blend In" as a generic Windows 10 / Edge user, rather than just blocking trackers (which can make you look suspicious).

### 1. Advanced Canvas & WebGL Protection
*   **Session-Unique Noise**: Instead of a static seed, the extension generates a fresh random noise seed every time the page loads. This ensures your Canvas and WebGL hashes are mathematically unique for every single session.
*   **Subtle Noise Injection**: Modifies RGB values by +/- 1 pixel to remain visually identical while altering the hash.
*   **WebGL Hardening**: 
    *   Spoofs WebGL Vendor/Renderer to generic Intel HD Graphics.
    *   Injects noise into `readPixels` to randomize WebGL fingerprints.

### 2. Aggressive AudioContext Protection
*   **Audio Fingerprint Poisoning**: Intercepts `AudioBuffer.prototype.getChannelData`, `createAnalyser`, and `AnalyserNode` methods.
*   **Randomized Jitter**: Injects tiny, randomized noise into audio samples and frequency data. Like the canvas, this noise is randomized per-session to prevent persistent tracking.

### 3. Network & Header Spoofing (DeclarativeNetRequest)
*   **User-Agent**: Rewrites to a standard Windows 10 / Edge string.
*   **Headers**: Standardizes `Accept` headers and removes the `Do Not Track` (DNT) header (which makes users stand out).
*   **Super-Cookie Protection**: Strips `ETag` and `If-None-Match` headers to prevent ETag-based tracking.

### 4. Hardware & Environment Spoofing ("Blending In")
*   **Screen Resolution**: Reports a standard 1366x768 (HD Laptop) resolution with 24-bit color depth.
*   **Platform**: Spoofs `navigator.platform` to "Win32" and `oscpu` to Windows 10.
*   **Concurrency**: Reports 4 CPU cores and 0 touch points (Desktop profile).
*   **Timezone**: Forces `Intl.DateTimeFormat` to report **'America/Chicago'** (Central Time).
*   **Plugins**: Hides installed plugins and mimeTypes (reports empty lists).
*   **Font Fingerprinting**: Adds 1% random noise to `offsetWidth`/`offsetHeight` measurements to fuzz font enumeration scripts.

### 5. Manifest V3 Compliance
*   Full Manifest V3 support with `declarativeNetRequest` for header modification.
*   Optimized content script injection (`document_start`) for immediate protection.

## Installation

1. Clone or download this repository.
2. Open your browser's extension management page (e.g., `chrome://extensions/`).
3. Enable "Developer mode".
4. Click "Load unpacked" and select the folder containing this extension.

## Screenshot

<img width="1285" height="132" alt="image" src="https://github.com/user-attachments/assets/9956052a-1b11-422e-8499-425f3845e472" />


## Credits

Based on the original work by [joue-quroi](https://github.com/joue-quroi).
