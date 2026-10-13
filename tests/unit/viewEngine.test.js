// SPDX-FileCopyrightText: 2024-2026 VectoDE
// SPDX-License-Identifier: MIT

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ejs = require('ejs');
const app = require('../../src/app');
const { browser } = require('../helpers/web');
const { useDatabase } = require('../helpers/db');
const { PASSWORD, createUser, createAdmin } = require('../helpers/fixtures');
const { precompileViews, freeIdentifiers, compileView } = require('../../worker/precompile-views');
const { createViewEngine, keyFor, escapeXML } = require('../../worker/view-engine');

const VIEWS = path.join(__dirname, '../../src/views');

// The generated module is written and loaded like the Worker build does, in strict mode.
const loadTemplates = (source) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'views-'));
  const file = path.join(dir, 'views.js');
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- a fresh temporary directory
  fs.writeFileSync(file, source);
  return require(file);
};

const templates = loadTemplates(precompileViews(VIEWS));
const viewEngine = createViewEngine(templates);

describe('precompiled views', () => {
  useDatabase();

  // Every page the app renders goes through real EJS and through the precompiled function with the same locals.
  const rendered = [];
  const originalEngine = app.engines['.ejs'];
  beforeAll(() => {
    app.engine('ejs', (file, options, callback) => {
      ejs.renderFile(file, options, (error, expected) => {
        if (error) {
          callback(error);
          return;
        }
        viewEngine.engine(file, options, (precompiledError, actual) => {
          rendered.push({ file: keyFor(file), expected, actual, error: precompiledError });
          callback(null, expected);
        });
      });
    });
  });
  afterAll(() => {
    if (originalEngine) app.engine('ejs', originalEngine);
    else delete app.engines['.ejs'];
  });

  // Every csrfToken() call makes a fresh token, so the two renderings differ there and nowhere else.
  const withoutCsrf = (html) => html.replaceAll(/name="_csrf" value="[^"]+"/g, 'name="_csrf" value=""');

  const expectSameOutput = () => {
    const count = rendered.length;
    expect(count).toBeGreaterThan(0);
    rendered.forEach(({ file, expected, actual, error }) => {
      expect({ file, error }).toEqual({ file, error: null });
      expect({ file, html: withoutCsrf(actual) }).toEqual({ file, html: withoutCsrf(expected) });
    });
    rendered.length = 0;
    return count;
  };

  it.each([
    ['en', '/'],
    ['de', '/'],
    ['en', '/security'],
    ['de', '/privacy'],
    ['en', '/imprint'],
    ['en', '/login'],
    ['de', '/register'],
    ['en', '/forgot-password'],
    ['de', '/no-such-page'],
  ])('renders %s %s exactly like EJS', async (language, page) => {
    const { agent } = browser(app);
    await agent.get(page).set('Accept', 'text/html').set('Accept-Language', language);
    expect(expectSameOutput()).toBeGreaterThan(0);
  });

  it('renders the dashboard and the admin pages exactly like EJS', async () => {
    const admin = await createAdmin();
    const other = await createUser();
    const { agent, submit } = browser(app);
    await submit('/login', { email: admin.email, password: PASSWORD });
    rendered.length = 0;
    await agent.get('/dashboard').set('Accept', 'text/html');
    await agent.get('/admin/users').set('Accept', 'text/html');
    await agent.get(`/admin/users/${other.id}`).set('Accept', 'text/html');
    expect(expectSameOutput()).toBeGreaterThanOrEqual(3);
  });

  it('renders the demo notice and a shown email exactly like EJS', async () => {
    const t = (key, vars) => `${key}${vars ? JSON.stringify(vars) : ''}`;
    const locals = {
      t,
      demoMail: [
        {
          to: 'a@example.com',
          subject: 'Reset <now>',
          greeting: 'Hi Ada,',
          intro: 'Hi',
          action: { label: 'Go', url: '/x?a=1&b=2' },
        },
        { to: 'b@example.com', subject: 'Changed', intro: 'Done', action: null, outro: 'Bye' },
      ],
    };
    const expected = await ejs.renderFile(path.join(VIEWS, 'components/demo-mail.ejs'), locals);
    expect(viewEngine.render('components/demo-mail', locals)).toBe(expected);
    expect(expected).toContain('Reset &lt;now&gt;');
  });

  it('renders the email template through the ejs API the email service uses', async () => {
    const data = {
      lang: 'de',
      subject: 'Betreff',
      greeting: 'Hallo "Ada"',
      intro: 'Text',
      action: { label: 'Los', url: 'https://example.com/?a=1&b=2' },
      outro: null,
      notYou: { text: 'Nicht du?', url: 'https://example.com/forgot-password' },
      signature: 'Team',
    };
    const file = path.join(VIEWS, 'emails/message.ejs');
    const expected = await ejs.renderFile(file, data);
    await expect(viewEngine.renderFile(file, data)).resolves.toBe(expected);
    await expect(
      new Promise((resolve, reject) => {
        viewEngine.renderFile(file, data, {}, (error, html) => (error ? reject(error) : resolve(html)));
      })
    ).resolves.toBe(expected);
  });
});

describe('view engine pieces', () => {
  it('escapes like EJS', () => {
    expect(escapeXML(`<a href="x">'&'</a>`)).toBe(ejs.escapeXML(`<a href="x">'&'</a>`));
    expect(escapeXML(null)).toBe('');
    expect(escapeXML(undefined)).toBe('');
    expect(escapeXML(0)).toBe('0');
  });

  it('maps view names and file paths to template keys', () => {
    expect(keyFor('pages/auth/login')).toBe('pages/auth/login');
    expect(keyFor('pages/auth/login.ejs')).toBe('pages/auth/login');
    expect(keyFor('C:\\app\\src\\views\\emails\\message.ejs')).toBe('emails/message');
    expect(keyFor('/bundle/src/views/pages/site/../../content/en/home')).toBe('content/en/home');
    expect(keyFor('../../../etc/passwd')).toBe('etc/passwd');
  });

  it('declares template variables but leaves JavaScript built-ins alone', () => {
    const names = freeIdentifiers(
      '__append(escapeFn(user.name)); JSON.stringify(Math.max(a?.b, c)); include("x", { d })'
    );
    expect(names).toEqual(['a', 'c', 'd', 'user']);
  });

  it('lets a template declare a name that is also a local', () => {
    const fn = loadTemplates(
      `'use strict';\nmodule.exports = { "t": ${compileView('<% const user = "inner"; %><%= user %>', 'test.ejs')} };`
    ).t;
    expect(fn({ user: 'outer' }, escapeXML, () => '')).toBe('inner');
  });

  it('resolves includes relative to the including view and passes the parent locals', () => {
    const engine = createViewEngine({
      'pages/site/content': (locals, escape, include) => include(`../../content/${locals.lang}/home`, { extra: '!' }),
      'content/de/home': (locals) => `${locals.lang}:${locals.title}${locals.extra}`,
    });
    expect(engine.render('pages/site/content', { lang: 'de', title: 'Start' })).toBe('de:Start!');
  });

  it('reports views that were not precompiled', async () => {
    const engine = createViewEngine({});
    expect(() => engine.render('missing', {})).toThrow(/View "missing" was not precompiled/);
    const view = new engine.PrecompiledView('missing', { root: '/views', defaultEngine: 'ejs' });
    expect(view.path).toBeUndefined();
    await expect(engine.renderFile('/views/missing.ejs', {})).rejects.toThrow(/not precompiled/);
  });

  it('works as the Express View class', async () => {
    const engine = createViewEngine({ hello: (locals) => `Hi ${locals.name}` });
    const view = new engine.PrecompiledView('hello', {});
    expect(view.path).toBe('hello');
    await expect(
      new Promise((resolve, reject) => {
        view.render({ name: 'Ada' }, (error, html) => (error ? reject(error) : resolve(html)));
      })
    ).resolves.toBe('Hi Ada');
  });
});
