# Performance

`npm run test:perf` measures every HTTP endpoint of the app: 36 endpoints in 37 measurements (sign-in is
measured for an existing account and for a wrong password), API and browser.

## How it works

1. Starts an in-memory MongoDB and the real server as a separate process with `NODE_ENV=production`,
   the encrypted MongoDB session store and a simulated TLS proxy (`X-Forwarded-Proto: https`).
2. Prepares data per endpoint. Endpoints that consume something get a fresh item per request:
   refresh tokens for rotation and logout, accounts for deletion, browser sessions for sign-out.
3. Runs [autocannon](https://github.com/mcollina/autocannon) against each endpoint and checks the status code
   of every response and the p99 latency against a budget.
4. Writes `reports/performance.json` and `reports/performance.md` and exits with code 1 if a budget is missed.

```bash
npm run test:perf                    # all endpoints, 5 s each
PERF_DURATION=15 npm run test:perf   # longer runs
PERF_ONLY=auth npm run test:perf     # only endpoints whose name contains "auth"
```

The GitHub workflow `Performance` runs weekly, on demand and on pull requests that touch `src/`. Shared
runners vary in speed, so on pull requests a missed budget is reported but does not block the merge.
The report is attached to the run summary.

## Budgets

| Endpoint group                            | p99 budget | Connections |
| ----------------------------------------- | ---------- | ----------- |
| Health and static files                   | 100 ms     | 10          |
| Pages, OpenAPI, 404                       | 150 ms     | 10          |
| Database reads and writes, token rotation | 300 ms     | 10          |
| Endpoints that hash or verify a password  | 3000 ms    | 4           |

Password endpoints are slow on purpose. scrypt with N=2^17 needs 128 MiB and about 0.3 s per call, which is
what makes offline guessing expensive. Node runs it on the libuv thread pool (4 threads by default), so one
instance handles roughly 10 to 12 sign-ins per second per 4 threads. Raise `UV_THREADPOOL_SIZE` on machines
with more cores, and plan memory for concurrent hashes.

## Reference run

Windows 11, Node 26.7, local machine, 5 s per endpoint, 11 October 2026. All 37 measurements within budget.

| Endpoint                                       | Req/s | p99 ms | Budget ms |
| ---------------------------------------------- | ----: | -----: | --------: |
| `GET /health`                                  | 10001 |      2 |       100 |
| `GET /health/ready`                            | 12114 |      1 |       100 |
| `GET /assets/css/components.css`               |  4030 |      4 |       100 |
| `GET /assets/js/main.js`                       |  5025 |      4 |       100 |
| `GET /assets/img/favicon.svg`                  |  5148 |      3 |       100 |
| `GET /docs/openapi.json`                       |  2954 |      9 |       150 |
| `GET /docs/`                                   |  3798 |      6 |       150 |
| `GET /v1/unknown`                              |  3540 |      7 |       150 |
| `GET /`                                        |   809 |     24 |       150 |
| `GET /security`                                |   798 |     22 |       150 |
| `GET /privacy`                                 |   828 |     24 |       150 |
| `GET /imprint`                                 |   782 |     28 |       150 |
| `GET /login`                                   |   506 |     33 |       150 |
| `GET /register`                                |   486 |     33 |       150 |
| `POST /v1/auth/register`                       |     7 |   1173 |      3000 |
| `POST /v1/auth/login`                          |     9 |    495 |      3000 |
| `POST /v1/auth/login`                          |    10 |    731 |      3000 |
| `POST /v1/auth/refresh-tokens`                 |   200 |     55 |       300 |
| `POST /v1/auth/logout`                         |   200 |     17 |       300 |
| `GET /v1/users/profile`                        |   982 |     20 |       300 |
| `GET /v1/account/export`                       |   654 |     27 |       300 |
| `PATCH /v1/account`                            |   526 |     30 |       300 |
| `DELETE /v1/account`                           |     8 |    435 |      3000 |
| `GET /v1/users?limit=20&sortBy=createdAt:desc` |   441 |     40 |       300 |
| `GET /v1/users/:userId`                        |   780 |     26 |       300 |
| `PATCH /v1/users/:userId`                      |   598 |     30 |       300 |
| `POST /v1/users`                               |     8 |    447 |      3000 |
| `DELETE /v1/users/:userId`                     |   200 |     26 |       300 |
| `GET /dashboard`                               |   256 |     54 |       300 |
| `GET /account/export`                          |   520 |     33 |       300 |
| `POST /login`                                  |     8 |    433 |      3000 |
| `POST /register`                               |     8 |    445 |      3000 |
| `POST /logout`                                 |    40 |     21 |       300 |
| `POST /account/profile`                        |    40 |     34 |       300 |
| `POST /account/password`                       |     5 |    853 |      3000 |
| `POST /account/delete`                         |    10 |    433 |      3000 |
| `GET /missing-page`                            |   948 |     20 |       150 |

Rows with fixed request counts (rotation, deletion, sign-out) show lower req/s because the run ends when the
prepared items are used up. The full table of the latest run is in `reports/performance.md` after a run.
