# Canvas Fingerprint Blocker (Modified)

This is a modified version of the [Canvas Fingerprint Blocker](https://github.com/joue-quroi/canvas-fingerprint-blocker) extension.

## Overview

This extension prevents HTML canvas element from generating a unique identification key to protect user's privacy. It works by adding slight noise to the canvas data, making the fingerprint inconsistent and unique for each session.

## Modifications & Improvements

This version includes several enhancements and fixes over the original codebase:

### 1. Enhanced Privacy Protection
- **Improved Noise Algorithm**: The original extension modified pixels in a predictable 10x10 grid. This version implements a more sophisticated noise injection algorithm that modifies pixels in a semi-random, denser pattern (approximately every 37th pixel). This makes the "noise" appear more natural and significantly harder for advanced fingerprinting scripts to detect and filter out.

### 2. Manifest V3 Compliance & Bug Fixes
- **Fixed Background Scripts**: Resolved an issue where `background.scripts` was incorrectly defined for Manifest V3. The extension now correctly uses a Service Worker.
- **Permission Cleanup**: 
    - Removed the unused `declarativeNetRequestWithHostAccess` permission to follow the principle of least privilege.
    - Ensured `declarativeNetRequest` is properly included to allow the extension to communicate settings via headers.

## Installation

1. Clone or download this repository.
2. Open your browser's extension management page (e.g., `chrome://extensions/`).
3. Enable "Developer mode".
4. Click "Load unpacked" and select the folder containing this extension.

## Credits

Based on the original work by [joue-quroi](https://github.com/joue-quroi).
