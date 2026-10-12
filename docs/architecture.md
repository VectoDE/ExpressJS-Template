# Architecture

## Folder structure

```
.
├── .github/                 Workflows, Dependabot, release note categories, issue and PR templates, community files
├── docker/mongo/            MongoDB init script for docker compose (least-privilege app user)
├── docs/                    This documentation
├── scripts/                 setup, create-admin, seed, generate-resource, e2e-server, license check
├── src/
│   ├── app.js               Express app: headers, CORS, parsers, sessions, routes, error handling
│   ├── server.js            Start, timeouts, graceful shutdown
│   ├── config/              Environment validation, logger, roles, token types
│   ├── controllers/         HTTP handlers for the API (account, auth, health, metrics, users)
│   │   └── web/             HTTP handlers for the browser UI (site, auth, account, admin)
│   ├── docs/                OpenAPI definition and Swagger UI
│   ├── i18n/                Translation lookup, language negotiation
│   ├── locales/             UI texts in English (en.js, default) and German (de.js)
│   ├── middlewares/         auth, csrf, error, i18n, rateLimit, requestId, requestLogger, sanitize,
│   │                        saveSessionBeforeRedirect, validate, viewAuth, viewLocals
│   ├── db/                  Data layer: MongoDB and SQL adapters, migrations, session and rate-limit stores
│   ├── public/
│   │   ├── css/             tokens → base → layout → components → motion → responsive, story (home page only)
│   │   ├── img/             Logo/favicon and icons (SVG)
│   │   └── js/              motion-init.js (blocking, before first paint) and main.js (deferred), no framework
│   ├── routes/v1/           REST API, versioned (auth, account, user)
│   ├── routes/web/          Browser routes (site, auth, account, admin) with session and CSRF protection
│   ├── services/            Business logic (account, audit, auth, email, token, twoFactor, user)
│   ├── utils/               ApiError, password hashing, TOTP, encryption, metrics, rate-limit store, flash, ...
│   ├── validations/         Joi schemas per route
│   └── views/
│       ├── layouts/         top/bottom page frame, head, header, footer
│       ├── components/      Partials such as flash, field, csrf, page-intro, story, motion-switch
│       ├── content/         Long static texts per language (en/, de/): home, imprint, privacy, security
│       ├── emails/          HTML frame of all emails
│       ├── pages/           auth/, account/, admin/ and site/ pages
│       └── error/           one error page for every status
└── tests/
    ├── e2e/                 Playwright browser tests
    ├── helpers/             Database, fixtures, mail and browser helpers
    ├── integration/         HTTP tests against the real app and an in-memory database
    ├── performance/         Load test of every endpoint (autocannon)
    ├── setup/               Jest environment, global setup and teardown
    └── unit/                Tests of single modules
```

## Request flow

```
request
  → requestId → metrics → requestLogger → language from Accept-Language
  → helmet (CSP, HSTS, COOP/COEP/CORP, frame and referrer policy) + Permissions-Policy + Cache-Control: no-store
  → /assets (static files, before rate limiting)
  → /health, /health/ready, /metrics
  → global rate limit → compression
  → CORS (only for /v1, only listed origins)
  → JSON (100 kB) / urlencoded (20 kB) parsers → sanitize
  → /docs (optional) → /v1 API router
  → session (only for browser routes) → saveSessionBeforeRedirect → CSRF → view locals → browser router
  → 404 → errorConverter → errorHandler
```

The API never creates a session or a cookie. The browser UI never sees a JWT.

`saveSessionBeforeRedirect` writes a changed session to the store before `res.redirect()` sends its headers.
express-session saves only at the end of the response, but browsers follow a redirect as soon as the headers
arrive. Under load the next request could read the old session: the pending sign-in between password and
two-factor code, or a flash message, was then missing. Unchanged sessions are not saved, so visitors without a
session still do not get one.

## Layers

- **Routes** declare the path, the rate limit, `auth(...)` with the required right and `validate(schema)`.
- **Controllers** translate HTTP into service calls and back. They contain no business rules.
- **Services** hold the rules: who may do what, which tokens to revoke, how a login is checked.
- **Models** define the stored data. Sensitive fields (`password`, `failedLoginAttempts`, `lockUntil`)
  are `select: false`, and `toPublic()` returns only an allow-list of fields.

`npm run generate -- <name>` creates all layers for a new resource that belongs to the signed-in user: model,
validation, service, controller, route with OpenAPI comments and an integration test. Every query filters on
the owner, so one user cannot read or change another user's records. The script mounts the route in
`src/routes/v1/index.js` and never overwrites existing files.

## Roles and rights

`src/config/roles.js` maps roles to rights. `auth('manageUsers')` checks the right against the role
stored in the database on every request, never against data inside the token.

| Role  | Rights                      |
| ----- | --------------------------- |
| user  | `getProfile`                |
| admin | `getProfile`, `manageUsers` |

## Browser UI

The browser UI is built from small parts, so a new page needs only its own content:

```ejs
<%- include('../../layouts/top', { width: 'narrow' }) %>
<%- include('../../components/page-intro', { heading: 'New page', lead: 'A short introduction.' }) %>
<form method="post" action="/example" class="form">
  <%- include('../../components/csrf') %>
  <%- include('../../components/field', { id: 'name', name: 'name', label: 'Name', required: true }) %>
  <button type="submit" class="button button--primary">Save</button>
</form>
<%- include('../../layouts/bottom') %>
```

- **Layouts** open and close every page (`top` takes `title`, `description`, `width`: `wide`, `text`, `narrow`
  or `auth`, `bodyClass`, and `stylesheets` for page-specific CSS). Navigation entries live in `layouts/header.ejs`.
- **Components** are partials with documented locals at the top of each file.
- **Texts** come from `src/locales/de.js` and `src/locales/en.js` through `t('key')`. A language chosen with the
  switch or stored with the account wins; otherwise the browser's `Accept-Language` decides. Long static pages live in
  `views/content/<language>/`. `tests/unit/i18n.test.js` keeps both locale files in sync.
- **Styles** follow the same split: change colours, type, spacing and motion timing only in `tokens.css`. Light
  and dark theme follow the system setting. Every colour pair meets WCAG 2.1 AA.
- **Forms** use post/redirect/get. Messages and harmless input (never passwords) survive one redirect
  through `utils/flash.js`.
- **Branding:** the logo in `src/public/img/favicon.svg` is the template's own mark. The Express logo is a
  trademark of the OpenJS Foundation and must not be modified or used as a product logo.

### Stylesheets

| File             | Contents                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| `tokens.css`     | Colours for both themes, fonts, type scale, spacing, durations and easing per motion style     |
| `base.css`       | Element defaults without classes                                                               |
| `layout.css`     | Page frame: header, content widths, footer, page grids                                         |
| `components.css` | One block per component partial                                                                |
| `motion.css`     | Entrances, headline word reveal, page cross-fade, the `off` style and reduced motion           |
| `story.css`      | Scroll story on the start page, loaded only there                                              |
| `responsive.css` | Phones, tablets, landscape phones, large monitors and TVs up to 3840 px, touch, notches, print |

`responsive.css` uses px breakpoints. From 1600 px wide the root font size grows step by step, so the whole
interface scales up on large monitors and TVs. On touch screens small links and buttons get larger touch
targets (most 44 px high) and hover effects that would stick after a tap are switched off. Content keeps clear
of notches and rounded corners through `env(safe-area-inset-*)`. Print shows the content only, without
navigation, forms, buttons or animation.

### Motion

`MOTION_STYLE` (`film`, `precise`, `playful`, `calm` or `off`) is rendered as `data-motion` on `<html>`. Each
style only changes timing tokens in `tokens.css`; the animations in `motion.css` read those tokens.

- `motion-init.js` is loaded without `defer` in `<head>`. Before the first paint it applies a style chosen in
  the footer switch (from `localStorage`) and adds the `motion` class, unless the style is `off` or the visitor
  prefers reduced motion. Without that class every element is in its final state, so nothing depends on
  JavaScript or on an animation finishing.
- `main.js` splits headlines into words, staggers elements marked with `data-reveal` as they scroll into view,
  drives the scroll story on the start page through the `--story-progress` custom property, runs the footer
  switch and removes the `motion` class when reduced motion is switched on during a visit.
- `components/motion-switch.ejs` is rendered only with `MOTION_SWITCH=true`. It starts hidden and `main.js`
  shows it, because it does nothing without JavaScript. A choice is saved in `localStorage` and the page
  reloads to play in the new style.

The scripts pass values to CSS as custom properties set through the CSSOM and as classes, never as `style`
attributes in the markup, so the CSP stays at `style-src 'self'`.
