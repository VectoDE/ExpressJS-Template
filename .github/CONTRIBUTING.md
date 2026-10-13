# Contributing

Thanks for helping. Bug reports, fixes and documentation improvements are welcome.

## Before you start

- Security problems go through the [security policy](SECURITY.md), not through issues.
- For larger changes, open an issue first so we can agree on the approach.

## Setup

```bash
git clone https://github.com/VectoDE/ExpressJS-Template.git
cd ExpressJS-Template
npm ci
npm run setup   # writes .env with fresh secrets, never overwrites
npm run dev
```

Node.js 22.12 or newer is required (`.nvmrc` pins 26). Tests use an in-memory SQLite database; see
[testing](../docs/testing.md) for other databases.

## Making a change

1. Branch from `main`: `fix/short-name` or `feat/short-name`.
2. Keep the change focused. Follow the existing structure: route → validation → controller → service → data
   layer (`src/db`). Database access goes through the adapter methods, so it works on every database.
3. Add or update tests. Security-relevant code needs a test for the attack it prevents.
4. Update the documentation in `docs/` and add an entry under "Unreleased" in `CHANGELOG.md`.
5. Run `npm run check`. It runs lint, format check, tests and `npm audit`, the same as CI.
6. If you touched request handling, run `npm run test:perf` as well.

## Coding standards

- JavaScript (CommonJS) for Node.js 22.12 and newer, formatted by Prettier. ESLint with the security and sonarjs
  plugins runs with `--max-warnings 0`; CI fails on any warning.
- Validate every input with Joi in `src/validations` before it reaches a controller. Escape output in views
  (`<%= %>`, never `<%- %>` for user data). No inline scripts or styles; the CSP forbids them.
- Errors go through `ApiError` and the error middleware; never answer with stack traces or internal messages.
  Log user-supplied values only through `oneLine` so they cannot forge log lines.
- Comments explain why, not what. Names are spelled out.

## Dependencies

- Prefer Node.js built-ins. A new dependency needs a reason in the pull request: what it does that the standard
  library does not, its maintenance state and its license (MIT, BSD, ISC, Apache-2.0 or similar).
- `package-lock.json` is committed and installs use `npm ci`. Docker base images and GitHub Actions are pinned
  by digest or commit SHA.
- Dependabot proposes updates weekly, grouped by production and development dependencies. `npm audit`,
  OSV-Scanner and GitHub dependency review run on every pull request.
- `npm run licenses` regenerates [third-party notices](../docs/third-party-notices.md) after a dependency change.

## Commits and pull requests

- Sign off every commit (`git commit -s`). The `Signed-off-by` line certifies the
  [Developer Certificate of Origin](https://developercertificate.org/): you have the right to submit the change
  under the project's license. The DCO check fails on pull requests with commits that are not signed off.
- Write commit messages in English, imperative mood, and explain why: `Reject refresh tokens as access tokens`.
- One topic per pull request. Fill in the template.
- New dependencies need a reason in the pull request. Prefer the standard library.
- CI must be green before review.

## Code review

Every change reaches `main` through a pull request, and only a maintainer merges it. The reviewer reads the whole diff
and checks it against this list before approving:

1. **Purpose.** The pull request says what it changes and why, and links the issue it closes. It does one thing.
2. **Correctness.** The code does what the description says, on every supported database, including the error
   paths: they answer through `ApiError` without internal details.
3. **Tests.** New behaviour and every fixed bug have a test that fails without the change. Security-relevant code has
   a test for the attack it prevents. Coverage stays above the thresholds.
4. **Security.** Input is validated with Joi before it reaches a controller; views escape user data; sessions, tokens,
   passwords and passkeys keep their current protections; nothing secret reaches logs or responses. Changes to
   authentication, sessions or the CSP get a second look at `docs/security.md`, which must still be true afterwards.
5. **Dependencies.** A new dependency is justified in the description (purpose, maintenance, license) and locked.
6. **Compatibility.** A change to routes, the API, configuration or the database schema is either backwards
   compatible or comes with a migration and notes in `CHANGELOG.md`.
7. **Documentation.** `docs/`, the README and `CHANGELOG.md` (under "Unreleased") match the change.
8. **Style.** The checks enforce formatting and lint rules; the reviewer looks at names, comments that explain why, and
   new files carrying the SPDX header.

The reviewer leaves a comment for each point that fails and approves only when none is left. Changes by the maintainer
go through the same checks, and CI runs them on every pull request.

## Releases

Only maintainers release, through a version tag on `main`; see [deployment](../docs/deployment.md#releases). The
plans for the next versions are in the [roadmap](../docs/roadmap.md), how decisions are made in the
[governance](GOVERNANCE.md).

## License

By contributing you agree that your contribution is licensed under the [MIT License](../LICENSE).

Every file carries an [SPDX](https://spdx.dev/) header with the copyright holder and the license, or is covered by
`REUSE.toml` when a header is not possible or would end up in rendered pages (templates, Markdown, JSON). CI checks
this with the [REUSE](https://reuse.software/) tool; run `uvx reuse lint` locally, and `uvx reuse annotate` adds the
header to a new file.
