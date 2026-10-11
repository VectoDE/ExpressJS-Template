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

Node.js 22.12 or newer is required (`.nvmrc` pins 24). Tests start their own in-memory MongoDB.

## Making a change

1. Branch from `main`: `fix/short-name` or `feat/short-name`.
2. Keep the change focused. Follow the existing structure: route → validation → controller → service → model.
3. Add or update tests. Security-relevant code needs a test for the attack it prevents.
4. Update the documentation in `docs/` and add an entry under "Unreleased" in `docs/changelog.md`.
5. Run `npm run check`. It runs lint, format check, tests and `npm audit`, the same as CI.
6. If you touched request handling, run `npm run test:perf` as well.

## Commits and pull requests

- Write commit messages in English, imperative mood, and explain why: `Reject refresh tokens as access tokens`.
- One topic per pull request. Fill in the template.
- New dependencies need a reason in the pull request. Prefer the standard library.
- CI must be green before review.

## License

By contributing you agree that your contribution is licensed under the [MIT License](../LICENSE).
