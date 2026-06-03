# Canvas Blocker - Fingerprint Protect

This extension reduces several browser fingerprinting signals without adding telemetry, analytics, remote code, or tracking.

## Protection modes

- Basic protects canvas reads only. It does not spoof WebGL vendor or renderer values.
- Standard protects canvas, WebGL readback, and audio with conservative defaults. It focuses on WebGL hash/readPixels noise and does not spoof WebGL vendor/renderer by default. Screen normalization stays off because it can break sites.
- Strict enables the stronger profile-oriented protections, removes DNT by default, and may spoof WebGL vendor/renderer (using common profiles like Edge/Windows Intel). Screen normalization can still be turned off in Options. Note that Strict mode is marked as riskier.

## WebGL profiles

WebGL vendor and renderer values are selected from built-in profiles and stay stable until you change the selected profile or rotate the browser session. WebGL1 and WebGL2 use the same selected values. `WEBGL_debug_renderer_info`, `UNMASKED_VENDOR_WEBGL`, and `UNMASKED_RENDERER_WEBGL` are spoofed only when WebGL protection is active, passthrough is not selected, and the browser exposes the debug renderer extension.

Built-in profiles:

- Passthrough / Real WebGL
- Disable WebGL vendor spoofing but keep WebGL hash noise
- Common Edge/Windows Intel profile

A rare fake WebGL profile can still make the browser unique. Windows-only WebGL profiles should be paired with a Windows User-Agent/platform. The extension keeps User-Agent rewriting off by default because changing the User-Agent without matching Client Hints can create contradictions.

## Other profile controls

`hardwareConcurrency` and `deviceMemory` are configurable in Options. The extension does not rewrite the User-Agent by default. DNT can add fingerprint entropy when it is set to `True`, so Strict mode removes DNT by default while Basic and Standard respect the browser setting.

## Testing and Philosophy

When using tools like [Cover Your Tracks](https://coveryourtracks.eff.org/), please note:

- **Uniqueness vs Tracking:** Your browser fingerprint can still report as "unique" even when protections are working perfectly. The main goal is reducing *stable* tracking and blocking trackers, not forcing every single metric to look completely fake.
- **Randomized Metrics:** If Cover Your Tracks reports that your Canvas, WebGL hash, or AudioContext fingerprints are "randomized by first-party domain", this is a highly positive sign! It means the trackers cannot stably link you across different sites.
- **WebGL Spoofing Risks:** We do not recommend forcing rare WebGL renderer strings. A rare fake WebGL profile can actually *increase* your uniqueness. This is why Standard mode focuses on WebGL hash noise (which stops tracking) while passing through your real hardware renderer (which prevents you from sticking out as a rare fake profile).
- **Mode Recommendations:** **Standard mode** is recommended for daily browsing. It is conservative, stable, and low-breakage. **Strict mode** should be reserved for testing or specific high-privacy situations, as its aggressive spoofing (like Screen normalization or WebGL renderer spoofing) can make the browser more unique or break site layouts.
