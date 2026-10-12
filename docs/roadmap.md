# Roadmap

What is planned for the next twelve months. Plans change; the current state is in the
[issues](https://github.com/VectoDE/ExpressJS-Template/issues) and the [changelog](changelog.md). Ideas and
objections are welcome in [Discussions](https://github.com/VectoDE/ExpressJS-Template/discussions).

## Ongoing

- Security and dependency updates as they come out. Supported versions are listed in the
  [security policy](../.github/SECURITY.md).
- Keep the template working on every active Node.js LTS line and on the database versions listed in
  [configuration](configuration.md#database), tested in CI.

## 4.x

- A copy script from MongoDB to a SQL database and back, for projects that switch.
- Passkeys (WebAuthn) as a second factor next to one-time codes.
- Separate database accounts for migrations and for the running app, as an option.

## Not planned

- An ORM with its own models in the template: the data layer stays small and readable.
- Client-side frameworks for the browser pages; they stay server-rendered and work without JavaScript.
