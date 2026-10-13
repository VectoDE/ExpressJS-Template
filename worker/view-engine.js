// SPDX-FileCopyrightText: 2024-2026 VectoDE
// SPDX-License-Identifier: MIT

/**
 * Renders the views precompiled by worker/precompile-views.js, for Cloudflare Workers where EJS cannot compile
 * at run time and Express cannot look up view files on disk. Behaves like EJS for what the app uses:
 * <%= %> escapes like ejs.escapeXML, include() resolves relative to the including view and passes the parent's
 * locals plus the extra data.
 */

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&#34;', "'": '&#39;' };
const escapeXML = (markup) =>
  markup === undefined || markup === null ? '' : String(markup).replaceAll(/[&<>'"]/g, (c) => HTML_ESCAPES[c]);

// "a/b/../c" -> "a/c"; never climbs above the views directory.
const normalise = (key) => {
  const parts = [];
  key.split('/').forEach((part) => {
    if (part === '..') parts.pop();
    else if (part && part !== '.') parts.push(part);
  });
  return parts.join('/');
};

const stripExtension = (name) => name.replace(/\.ejs$/, '');

// Accepts a view name ("pages/auth/login") or a file path that contains /views/ ("/x/src/views/emails/message.ejs").
const keyFor = (name) => {
  const slashed = String(name).replaceAll('\\', '/');
  const index = slashed.lastIndexOf('/views/');
  return stripExtension(normalise(index === -1 ? slashed : slashed.slice(index + '/views/'.length)));
};

const createViewEngine = (templates) => {
  const has = (key) => Object.hasOwn(templates, key);

  const render = (key, data) => {
    if (!has(key)) {
      throw new Error(`View "${key}" was not precompiled`);
    }
    const locals = Object.assign(Object.create(null), data);
    const directory = key.includes('/') ? key.slice(0, key.lastIndexOf('/')) : '';
    const include = (target, extra) =>
      render(
        stripExtension(normalise(`${directory}/${target}`)),
        Object.assign(Object.create(null), data, extra || {})
      );
    return templates[key](locals, escapeXML, include);
  };

  // Express template engine: (path, options, callback).
  const engine = (filePath, options, callback) => {
    let html;
    try {
      html = render(keyFor(filePath), options);
    } catch (error) {
      callback(error);
      return;
    }
    callback(null, html);
  };

  // Replaces Express's View, which checks the file system for the view file.
  class PrecompiledView {
    constructor(name, options = {}) {
      this.name = name;
      this.root = options.root;
      this.defaultEngine = options.defaultEngine;
      this.ext = '.ejs';
      const key = keyFor(name);
      this.path = has(key) ? key : undefined;
    }

    render(options, callback) {
      engine(this.path, options, callback);
    }
  }

  // The part of the EJS API the app calls (email.service uses renderFile).
  const renderFile = (filePath, data, options, callback) => {
    const done = [options, callback].find((value) => typeof value === 'function');
    if (done) {
      engine(filePath, data || {}, done);
      return undefined;
    }
    return new Promise((resolve, reject) => {
      engine(filePath, data || {}, (error, html) => (error ? reject(error) : resolve(html)));
    });
  };

  return { render, engine, renderFile, PrecompiledView, keyFor, escapeXML };
};

module.exports = { createViewEngine, escapeXML, keyFor };
