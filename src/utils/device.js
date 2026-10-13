// SPDX-FileCopyrightText: 2024-2026 VectoDE
//
// SPDX-License-Identifier: MIT

/**
 * Short, human-readable device label from a User-Agent, for the session list and the activity log.
 * Deliberately coarse (browser and operating system only), so it is useful without being a fingerprint.
 */
const BROWSERS = [
  [/\bEdg(?:e|A|iOS)?\//, 'Edge'],
  [/\bOPR\//, 'Opera'],
  [/\bFirefox\/|\bFxiOS\//, 'Firefox'],
  [/\bChrome\/|\bCriOS\//, 'Chrome'],
  [/\bSafari\//, 'Safari'],
  [/^curl\//, 'curl'],
  [/^PostmanRuntime\//, 'Postman'],
  [/(?:^node)|undici|axios/i, 'Node.js'],
  [/python/i, 'Python'],
];

const SYSTEMS = [
  [/\bAndroid\b/, 'Android'],
  [/\biPhone|iPad|iPod\b/, 'iOS'],
  [/\bWindows\b/, 'Windows'],
  [/\bMac OS X\b|\bMacintosh\b/, 'macOS'],
  [/\bCrOS\b/, 'ChromeOS'],
  [/\bLinux\b/, 'Linux'],
];

const match = (list, userAgent) => list.find(([pattern]) => pattern.test(userAgent))?.[1];

const deviceLabel = (userAgent = '') => {
  const ua = String(userAgent).slice(0, 512);
  const browser = match(BROWSERS, ua);
  const system = match(SYSTEMS, ua);
  if (browser && system) {
    return `${browser} · ${system}`;
  }
  return browser || system || null;
};

module.exports = { deviceLabel };
