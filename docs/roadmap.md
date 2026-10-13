# Roadmap

What is planned for the next twelve months. Plans change; the current state is in the
[issues](https://github.com/VectoDE/ExpressJS-Template/issues) and the [changelog](../CHANGELOG.md). Ideas and
objections are welcome in [Discussions](https://github.com/VectoDE/ExpressJS-Template/discussions).

## Ongoing

- Security and dependency updates as they come out. Supported versions are listed in the
  [security policy](../.github/SECURITY.md).
- Keep the template working on every active Node.js LTS line and on the database versions listed in
  [configuration](configuration.md#database), tested in CI.

## Done in 4.0

Node.js 26 and MongoDB 9 in Docker and CI, the copy script between databases, passkeys as a second factor and
separate database accounts for migrations. See the [changelog](../CHANGELOG.md#400---2026-10-12).

## Done in 4.1

A public live demo on Cloudflare Workers with D1 and signed version tags. See the
[changelog](../CHANGELOG.md#410---2026-10-13).

## 4.x

- Passkeys as the only sign-in step (passwordless), as an option next to password plus second factor.
- A second maintainer, so that pull requests get a review by someone other than the author.

## Not planned

- An ORM with its own models in the template: the data layer stays small and readable.
- Client-side frameworks for the browser pages; they stay server-rendered and work without JavaScript.
