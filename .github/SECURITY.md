# Security policy

## Supported versions

| Version | Supported                                                                                                         |
| ------- | ----------------------------------------------------------------------------------------------------------------- |
| 3.x     | Yes                                                                                                               |
| < 3.0   | No. 1.0 and 1.0.1 contain known critical vulnerabilities; upgrade with [docs/upgrading.md](../docs/upgrading.md). |

## Reporting a vulnerability

Do not open a public issue. Report privately through
[GitHub Security Advisories](https://github.com/VectoDE/ExpressJS-Template/security/advisories/new).

Please include:

- affected version or commit
- steps to reproduce, ideally a minimal request sequence
- impact as you see it

You get an answer within 7 days. Confirmed issues are fixed in a patch release and published as an advisory
with credit, unless you prefer to stay anonymous.

## Scope

In scope: code in this repository, the default configuration, the Dockerfile and the GitHub workflows.

Out of scope: applications built from the template and changed afterwards, missing hardening that
[docs/security.md](../docs/security.md) lists as a known limit, and findings that need a compromised server
or a malicious administrator.

Only test against your own installation. Do not test against systems you do not own.
