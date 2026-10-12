# Governance

The Express.js template is maintained by [VectoDE](https://github.com/VectoDE). This page says who decides what,
how changes get in, and what happens if the maintainer is gone.

## Roles

| Role        | Who                                                       | Responsibilities                                                                                                         |
| ----------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Maintainer  | [@VectoDE](https://github.com/VectoDE)                    | Reviews and merges pull requests, triages issues, answers security reports, tags releases, owns the image on ghcr.io     |
| Contributor | Anyone who opens an issue, a discussion or a pull request | Follows the [contributing guide](CONTRIBUTING.md) and the [code of conduct](CODE_OF_CONDUCT.md), signs off commits (DCO) |

A contributor with a record of good pull requests can be invited as a second maintainer. The invitation is a pull
request that adds them to this file and to [CODEOWNERS](CODEOWNERS).

## Decisions

- Bug fixes and small changes: a pull request that passes every required check. Pull requests from contributors
  need the maintainer's approval. While there is one maintainer, their own pull requests are merged once every
  check passes; when a second maintainer joins, the ruleset on `main` will require an approval by someone other
  than the author.
- New features, a new supported database or breaking changes: discussed in an issue first. The reasoning is
  written down there, so later readers can see why.
- Security reports follow the [security policy](SECURITY.md) and stay private until a fix is released.

## Releases

A release is a version tag on a commit of `main`. The [release workflow](workflows/release.yml) checks the commit
again and publishes the source archive, the SBOM and the Docker image with signed provenance. Nobody publishes
from a laptop. See [deployment](../docs/deployment.md#releases).

## Access to sensitive resources

| Resource                                                 | Who has access                                                              |
| -------------------------------------------------------- | --------------------------------------------------------------------------- |
| Repository settings, rulesets and secrets                | [@VectoDE](https://github.com/VectoDE) (owner)                              |
| Merging into `main`                                      | [@VectoDE](https://github.com/VectoDE), through pull requests only          |
| Version tags and releases                                | [@VectoDE](https://github.com/VectoDE); the release workflow publishes      |
| Docker image `ghcr.io/vectode/expressjs-template`        | The release workflow with the repository token; no personal token is stored |
| GitHub Pages preview                                     | The preview workflow on `main`                                              |
| Security advisories                                      | [@VectoDE](https://github.com/VectoDE)                                      |
| SonarQube Cloud project and OpenSSF Best Practices entry | [@VectoDE](https://github.com/VectoDE)                                      |

The list changes in the same pull request that grants or removes access.

Before anyone gets more than read access, the maintainers look at their record: at least three merged pull
requests of good quality, constructive behaviour in issues and reviews, and two-factor authentication on GitHub.
The decision is recorded in that pull request. Rights are given at the lowest level that does the job and removed
when no longer needed.

## Continuity

- Code, issues, discussions, releases and the full history are public, so anyone can fork and continue.
- Releases need no personal token or key: the workflow signs with GitHub's OIDC identity.
- The repository belongs to the maintainer account. Access for a second person is arranged by the maintainer and
  recorded here once it exists.
