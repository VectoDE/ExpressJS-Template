# Express Enterprise Starter

An opinionated, production-ready Express.js template that demonstrates best practices for building secure, observable, and testable REST APIs. It includes layered architecture, authentication with JWT and refresh tokens, request validation, MongoDB integration, API documentation, and developer tooling.

## ✨ Highlights

- **Modular architecture** separating configuration, routes, controllers, services, and data access layers.
- **Secure by default** middleware stack with Helmet, rate limiting, request sanitization, and CORS controls.
- **JWT authentication** with refresh tokens, role-based authorization, and reusable access control helpers.
- **Centralised error handling** using custom `ApiError` objects and environment-aware responses.
- **Comprehensive logging** powered by Winston and HTTP request tracing via Morgan.
- **API documentation** automatically generated with Swagger UI (`/docs`).
- **Test harness** with Jest and SuperTest for integration testing and continuous integration readiness.
- **Environment validation** via Joi to prevent misconfiguration at boot time.
- **Modern web experience** including secured sessions, CSRF protection, and a responsive EJS dashboard.

## 🗂️ Project Structure

```
├── src
│   ├── app.js               # Express app configuration
│   ├── server.js            # Application bootstrap & graceful shutdown
│   ├── config/              # Environment, logger, database, roles, token settings
│   ├── controllers/         # Request handlers (REST, auth, health, web views)
│   ├── docs/                # Swagger configuration & definitions
│   ├── middlewares/         # Auth, validation, error & logging middleware
│   ├── models/              # Mongoose schemas (User, Token)
│   ├── routes/v1/           # Versioned REST API routes
│   ├── routes/web/          # Browser routes with CSRF/session handling
│   ├── services/            # Business logic & orchestration layer
│   ├── views/               # EJS templates for UI & error pages
│   ├── public/              # Static assets (CSS/JS) served via /assets
│   ├── utils/               # Shared helpers (ApiError, password hashing, etc.)
│   └── validations/         # Joi schemas & custom validators
├── src/tests/               # Jest setup and sample integration tests
├── example.env              # Documented environment variables
└── jest.config.js           # Jest configuration
```

## 🚀 Getting Started

1. **Clone and install dependencies**
   ```bash
   git clone <repository-url>
   cd ExpressJS-Template
   npm install
   ```
2. **Configure environment variables**
   - Copy `example.env` to `.env` and adapt values to your setup.
   - Mandatory values include MongoDB connection details and a strong `JWT_SECRET`.
3. **Run the API locally**
   ```bash
   npm run dev
   ```
   The server listens on `http://localhost:8080` by default and exposes interactive docs at `http://localhost:8080/docs`.

## 🔧 Environment Variables

| Name | Description | Default |
| ---- | ----------- | ------- |
| `NODE_ENV` | Node runtime mode (`development`, `production`, `test`) | `development` |
| `PORT` | HTTP port | `8080` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/expressjs_template` |
| `MONGODB_DB_NAME` | MongoDB database name | `expressjs_template` |
| `JWT_SECRET` | Secret used to sign JWT tokens | _required in production_ |
| `JWT_ACCESS_EXPIRATION_MINUTES` | Access token lifetime in minutes | `30` |
| `JWT_REFRESH_EXPIRATION_DAYS` | Refresh token lifetime in days | `30` |
| `LOG_LEVEL` | Winston log level | `info` |
| `CORS_ORIGIN` | Comma separated list of allowed origins or `*` | `*` |
| `SESSION_SECRET` | Secret used to sign & encrypt session data | _required in production_ |
| `SESSION_NAME` | Name of the session cookie | `sid` |
| `SESSION_IDLE_TIMEOUT_MINUTES` | Session idle timeout before invalidation | `30` |
| `SESSION_COOKIE_SECURE` | Enable secure cookies (requires HTTPS/proxy) | `false` |
| `TRUST_PROXY` | Trust reverse proxy headers for secure cookies | `false` |

## 📚 Available Scripts

| Command            | Description                                                   |
| ------------------ | ------------------------------------------------------------- |
| `npm run dev`      | Start API & web UI with `nodemon` and auto-reload on file changes. |
| `npm start`        | Launch the API and web interface in production mode.             |
| `npm test`         | Execute Jest test suite (runs in `NODE_ENV=test`).               |

## 🖥️ Web Experience

- `GET /` liefert eine gehärtete Landing Page mit Projektüberblick und Schnellzugriffen.
- Authentifizierung & Registrierung erfolgen über EJS-Formulare mit CSRF-Tokens und verschlüsselten Sessions.
- Das Dashboard zeigt Nutzerprofil, aktive Tokens und empfohlene nächste Schritte für Deployments.
- Fehler für Browser-Clients werden als stilisierte HTML-Seiten ausgegeben, während die API weiterhin JSON liefert.

## 🔐 Authentication & Authorization

- Users register via `POST /v1/auth/register`. Passwords are hashed with Node.js `crypto.scrypt` before persisting.
- Login with `POST /v1/auth/login` to receive access and refresh tokens.
- Refresh access tokens through `POST /v1/auth/refresh-tokens`.
- Revoke refresh tokens using `POST /v1/auth/logout`.
- Protect endpoints by attaching `Authorization: Bearer <accessToken>` headers.
- Role-based permissions are defined in `src/config/roles.js` and enforced via the `auth` middleware.
- Browser sessions are encrypted in MongoDB, regenerated on login, and protected via CSRF tokens for every form submit.

## 📘 API Reference

Swagger documentation is available at `/docs` (disabled during tests). The generated specification can be reused for client generation or platform integration.

Key endpoints:

- `GET /health` – Lightweight service health probe.
- `POST /v1/auth/register` – Create a new account.
- `POST /v1/auth/login` – Exchange credentials for JWT tokens.
- `POST /v1/auth/refresh-tokens` – Renew expired access tokens.
- `GET /v1/users/profile` – Retrieve the authenticated user's profile.
- `GET /v1/users` – Admin-only paginated listing of users.
- `GET /` – Landing page, documentation hub, and entry into the secured dashboard.

## 🧪 Testing Strategy

- Jest runs in isolated `NODE_ENV=test` mode with deterministic environment setup (`src/tests/jest.setup.js`).
- Example integration test (`src/tests/integration/health.test.js`) demonstrates how to exercise routes with SuperTest.
- Extend the suite with further unit or integration tests as new features are introduced.

## 📈 Observability & Error Handling

- Winston logger centralises structured logging across the application.
- Morgan HTTP logging middleware writes concise request traces.
- Custom `ApiError` ensures consistent error payloads and stack traces during development.
- Health check endpoint simplifies infrastructure liveness and readiness probes.
- Browser requests receive branded HTML error pages while API consumers continue to receive JSON payloads.

## 🛠️ Extending the Template

- Add new modules under `src/services` to encapsulate domain logic.
- Create DTOs/validators in `src/validations` and pair them with routes via the `validate` middleware.
- Use `src/utils` for sharable helpers (e.g., mailers, external integrations).
- Update Swagger definitions in `src/docs/swaggerDef.js` as you add endpoints.
- Expand the web experience inside `src/routes/web` and `src/views` for custom flows such as onboarding, billing, or admin dashboards.

## 🪪 License

Released under the [MIT License](./LICENSE).

---

Built with ❤️ to jump-start enterprise-grade Express.js services.
