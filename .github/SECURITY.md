# Security policy

## Supported versions

| Version | Supported                                                                      | Security updates until                                        |
| ------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| 4.x     | Yes. Fixes ship in a new patch or minor release of the latest 4.x              | 6 months after 5.0.0 is released                              |
| 3.x     | No. Upgrade with [docs/upgrading.md](../docs/upgrading.md); MongoDB data stays | Ended with the release of 4.0.0, before this policy           |
| < 3.0   | No. 1.0 and 1.0.1 contain known critical vulnerabilities                       | Ended; upgrade with [docs/upgrading.md](../docs/upgrading.md) |

- Only the latest release of a major version is supported; there are no backports to older minor or patch releases.
  Upgrading within a major version is safe, because breaking changes only come with a new major version.
- When a new major version comes out, the previous one keeps getting security fixes for six months. The end date is
  added to this table and announced in the changelog and the release notes of the new major version.
- After that date the old major version gets no updates of any kind, security fixes included.

## Reporting a vulnerability

Do not open a public issue. Report privately through
[GitHub Security Advisories](https://github.com/VectoDE/ExpressJS-Template/security/advisories/new).

Please include:

- affected version or commit
- steps to reproduce, ideally a minimal request sequence
- impact as you see it

You get an answer within 7 days. Confirmed issues are fixed in a patch release and published as an advisory
with credit, unless you prefer to stay anonymous. The changelog lists the fix under "Security".

## Scope

In scope: code in this repository, the default configuration, the Dockerfile and the GitHub workflows.

Out of scope: applications built from the template and changed afterwards, missing hardening that
[docs/security.md](../docs/security.md) lists as a known limit, and findings that need a compromised server
or a malicious administrator.

Only test against your own installation. Do not test against systems you do not own.

## Verifying releases

Every release since 4.0.0 carries a signed build provenance. Check a downloaded archive or the Docker image
with `gh attestation verify <file or oci://image> --repo VectoDE/ExpressJS-Template`; see
[deployment](../docs/deployment.md#releases).

## Secrets and credentials

- The repository holds no secrets. gitleaks runs in CI and GitHub secret scanning with push protection is on.
  Tests generate their passwords and keys at run time.
- The release workflow needs no stored secret: it signs with GitHub's OIDC identity and pushes the image with the
  short-lived repository token. The repository has no Actions secrets; SonarQube Cloud analyses through its
  GitHub app.
- The live demo on Cloudflare has its own three keys (`JWT_SECRET`, `SESSION_SECRET`, `ENCRYPTION_KEY`). They are
  random values that were never displayed, stored only as Worker secrets in Cloudflare, and set by the maintainer
  with `wrangler secret put`. They protect nothing but the demo, whose data is deleted every hour.
- Should a secret become necessary, only the maintainer can read or change it (see [governance](GOVERNANCE.md)).
  It is rotated at least once a year, at once when someone with access leaves, and whenever it may have leaked.
- Applications built from the template keep their secrets in environment variables; `npm run setup` generates
  them and production refuses placeholders. See [configuration](../docs/configuration.md).

## Vulnerabilities in dependencies

`npm audit`, OSV-Scanner and Dependabot alerts are checked on every pull request and weekly. A vulnerable
dependency is updated in a patch release. If a finding does not affect the template (for example a function it
never calls), the reasoning is written in the pull request that dismisses the alert.

## How the project handles security

The reasoning behind the security design is in the [assurance case](../docs/assurance.md), the controls in
[docs/security.md](../docs/security.md). Who has access to what is listed in the [governance](GOVERNANCE.md).
