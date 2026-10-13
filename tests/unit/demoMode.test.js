// SPDX-FileCopyrightText: 2024-2026 VectoDE
// SPDX-License-Identifier: MIT

const crypto = require('node:crypto');

// Loads a module with a changed environment; the change is undone afterwards.
const withEnv = (env, load) => {
  const saved = { ...process.env };
  Object.entries(env).forEach(([key, value]) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  });
  try {
    let result;
    jest.isolateModules(() => {
      result = load();
    });
    return result;
  } finally {
    process.env = saved;
  }
};

const loadConfig = (env) => withEnv(env, () => require('../../src/config/config'));

const production = {
  NODE_ENV: 'production',
  JWT_SECRET: crypto.randomBytes(32).toString('base64url'),
  SESSION_SECRET: crypto.randomBytes(32).toString('base64url'),
  ENCRYPTION_KEY: crypto.randomBytes(32).toString('base64url'),
  APP_URL: 'https://demo.example.com',
  SMTP_URL: undefined,
  CORS_ORIGIN: 'https://demo.example.com',
  TRUST_PROXY: '1',
};

describe('demo mode gating', () => {
  it('is off by default and keeps the full scrypt cost', () => {
    const config = loadConfig({ DEMO_MODE: undefined, PASSWORD_HASH_COST: undefined });
    expect(config.demo).toBe(false);
    expect(config.password.hashCost).toBe(17);
  });

  it('refuses a lower scrypt cost without DEMO_MODE', () => {
    expect(() => loadConfig({ DEMO_MODE: undefined, PASSWORD_HASH_COST: '10' })).toThrow(
      /PASSWORD_HASH_COST below 17 is only allowed with DEMO_MODE=true/
    );
    expect(() => loadConfig({ DEMO_MODE: 'false', PASSWORD_HASH_COST: '12' })).toThrow(/PASSWORD_HASH_COST/);
  });

  it('allows a higher scrypt cost without DEMO_MODE', () => {
    expect(loadConfig({ DEMO_MODE: undefined, PASSWORD_HASH_COST: '18' }).password.hashCost).toBe(18);
  });

  it('rejects a cost outside 10 to 20 even in demo mode', () => {
    expect(() => loadConfig({ DEMO_MODE: 'true', PASSWORD_HASH_COST: '8' })).toThrow(/Environment validation error/);
  });

  it('refuses D1 without DEMO_MODE because its transactions are not atomic', () => {
    expect(() => loadConfig({ DEMO_MODE: undefined, DATABASE_URL: 'd1:DB' })).toThrow(
      /d1: runs transactions without atomicity/
    );
  });

  it('still requires SMTP in production without DEMO_MODE', () => {
    expect(() => loadConfig({ ...production, DEMO_MODE: undefined })).toThrow(/SMTP_URL is required/);
  });

  it('accepts the Worker settings with DEMO_MODE', () => {
    const config = loadConfig({ ...production, DEMO_MODE: 'true', PASSWORD_HASH_COST: '10', DATABASE_URL: 'd1:DB' });
    expect(config.demo).toBe(true);
    expect(config.password.hashCost).toBe(10);
    expect(config.database.url).toBe('d1:DB');
  });

  it('keeps every other production check in demo mode', () => {
    expect(() => loadConfig({ ...production, DEMO_MODE: 'true', TRUST_PROXY: '0' })).toThrow(/TRUST_PROXY/);
    expect(() => loadConfig({ ...production, DEMO_MODE: 'true', JWT_SECRET: undefined })).toThrow(/JWT_SECRET/);
  });
});

describe('password hashing cost', () => {
  it('hashes with N = 2^17 by default', async () => {
    const { hashPassword } = require('../../src/utils/password');
    expect((await hashPassword('Correct-Horse-1')).split('$')[1]).toBe(String(2 ** 17));
  });

  it('hashes with the demo cost and upgrades those hashes outside the demo', async () => {
    const demoHash = await withEnv({ DEMO_MODE: 'true', PASSWORD_HASH_COST: '10' }, () =>
      require('../../src/utils/password')
    ).hashPassword('Correct-Horse-1');
    expect(demoHash.split('$')[1]).toBe('1024');
    const { comparePassword, needsRehash } = require('../../src/utils/password');
    await expect(comparePassword('Correct-Horse-1', demoHash)).resolves.toBe(true);
    expect(needsRehash(demoHash)).toBe(true);
  });
});

describe('demo inbox', () => {
  const demoInbox = require('../../src/utils/demoInbox');

  it('hands a mail to the session of the running request', () => {
    const req = { session: {} };
    demoInbox.trackRequest(req, {}, () => {
      expect(demoInbox.deliver({ subject: 'one' })).toBe(true);
    });
    expect(req.session.demoMail).toEqual([{ subject: 'one' }]);
    expect(demoInbox.consume(req)).toEqual([{ subject: 'one' }]);
    expect(req.session.demoMail).toBeUndefined();
    expect(demoInbox.consume(req)).toEqual([]);
  });

  it('keeps the last five mails only', () => {
    const req = { session: { demoMail: 'garbage' } };
    demoInbox.trackRequest(req, {}, () => {
      for (let index = 0; index < 7; index += 1) demoInbox.deliver({ index });
    });
    expect(req.session.demoMail.map((mail) => mail.index)).toEqual([2, 3, 4, 5, 6]);
    req.session.demoMail = 'garbage';
    expect(demoInbox.consume(req)).toEqual([]);
  });

  it('reports mails it has nowhere to show', () => {
    expect(demoInbox.deliver({ subject: 'none' })).toBe(false);
    demoInbox.trackRequest({}, {}, () => {
      expect(demoInbox.deliver({ subject: 'no session' })).toBe(false);
    });
  });
});

describe('email service in demo mode', () => {
  it('shows the mail instead of sending it, link included', () => {
    const { emailService, demoInbox } = withEnv({ DEMO_MODE: 'true', PASSWORD_HASH_COST: '10' }, () => ({
      emailService: require('../../src/services/email.service'),
      demoInbox: require('../../src/utils/demoInbox'),
    }));
    const req = { session: {} };
    demoInbox.trackRequest(req, {}, () => {
      emailService.notify({ name: 'Ada', email: 'ada@example.com', locale: 'en' }, 'resetPassword', { token: 't k' });
    });
    const [mail] = req.session.demoMail;
    expect(mail.to).toBe('ada@example.com');
    expect(mail.subject).toEqual(expect.any(String));
    expect(mail.action.url).toMatch(/\/reset-password\?token=t%20k$/);
    expect(emailService.outbox).toHaveLength(0);
  });

  it('logs a mail that has no session to go to', () => {
    const { emailService, logger } = withEnv({ DEMO_MODE: 'true', PASSWORD_HASH_COST: '10' }, () => ({
      emailService: require('../../src/services/email.service'),
      logger: require('../../src/config/logger'),
    }));
    const info = jest.spyOn(logger, 'info').mockImplementation(() => logger);
    emailService.notify({ name: 'Ada', email: 'ada@example.com', locale: 'de' }, 'passwordChanged');
    expect(info).toHaveBeenCalledWith(expect.stringContaining('neither sent nor shown'), expect.any(String));
  });
});

describe('metrics without an event loop monitor', () => {
  it('reports a delay of 0 where the runtime has no monitor (Workers)', () => {
    jest.isolateModules(() => {
      jest.doMock('node:perf_hooks', () => ({
        monitorEventLoopDelay: () => {
          throw new Error('not implemented');
        },
      }));
      const metrics = require('../../src/utils/metrics');
      expect(metrics.render()).toContain('nodejs_eventloop_delay_p99_seconds 0');
    });
    jest.dontMock('node:perf_hooks');
  });
});
