# Backend

FastAPI code is in `src/recallcam_backend/`; the online RAG workflow belongs in its `query/` package. HTTP routes call application services rather than running video indexing.

From the repository root, use the full container stack:

```sh
docker compose up --build -d
docker compose logs -f backend
```

Implemented in this slice: stateless JWT login, two authentication/role middleware layers, administrator-created users, fixed inherited role permissions, password changes/resets, camera metadata and archive management, and action audit records. PostgreSQL persistence uses SQLAlchemy 2 with psycopg and explicit Alembic migrations. No server-side login sessions or refresh tokens are created.

## First setup

The shared Python Dockerfile installs the locked dependencies. Configure these values in the ignored root `.env` before starting Compose:

```dotenv
JWT_SIGNING_KEY=<a-random-secret-of-at-least-32-bytes>
JWT_ISSUER=recallcam
JWT_AUDIENCE=recallcam-api
JWT_ACCESS_TOKEN_MINUTES=60
```

Use the Docker-only key-generation command in the [root README](../README.md). Do not commit or share the key. Changing it invalidates existing tokens. Compose requires the key before launch; the underlying authentication service fails closed without valid configuration.

Compose runs the one-shot `migrate` service before the backend. With the backend running:

```sh
docker compose exec backend python -m recallcam_backend.cli create-admin --email you@example.com --display-name "Your name"
```

The bootstrap command asks for a hidden password and confirmation in an interactive terminal. Passwords must contain 12–128 characters. It only operates when `users` is empty, uses the same database lock as account administration, and never replaces an existing account. Subsequent users are created in the administrator UI. There is no default administrator password, public registration endpoint, or automatic table creation on backend startup.

Inside the container the API listens on port 8000, uses Compose service addresses for infrastructure and reaches native LLM/VLM endpoints through configured HTTP URLs. The frontend proxies browser API requests to `backend:8000`; no Python application process needs to run natively. See [Containers](../docs/Containers.md) for source mounts, migrations and networking.

## HTTP contracts

| Endpoint | Behavior and access |
| --- | --- |
| `POST /api/auth/login` | Public; JSON `{email,password}` returns access token, lifetime and current user. |
| `GET /api/auth/me` | Any active authenticated user; returns account and effective permission strings. |
| `POST /api/auth/change-password` | Current password plus new password; returns 204 and invalidates the account's old tokens. |
| `GET /api/users` | Administrator; paginated list, optional `search`, `role`, `is_active`. |
| `POST /api/users` | Administrator; email, display name, password and fixed role. |
| `GET /api/users/{user_id}` | Administrator; account details without password hash. |
| `PATCH /api/users/{user_id}` | Administrator; display name, role, active status. |
| `POST /api/users/{user_id}/password` | Administrator resets another account's password; returns 204 and invalidates its tokens. |
| `GET /api/cameras` | Any authenticated user; optional `search` and `include_archived`. |
| `GET /api/cameras/{camera_id}` | Any authenticated user; camera metadata. |
| `POST /api/cameras` | Administrator; name, optional location/description, required IANA timezone. |
| `PATCH /api/cameras/{camera_id}` | Administrator; edit metadata or set `is_active=false` to archive. |
| `GET /api/audit-events` | Supervisor or administrator; paginated action history, optional `search`. |

All paginated endpoints accept `page` (default 1) and `page_size` (default 20, maximum 100), returning `{items,total,page,page_size}`. Contracts are in `recallcam_shared.contracts.accounts`. Login and account responses include `permissions`; roles are `operator`, `supervisor` and `administrator`. Token claims contain account identity and password version, not an authoritative role. Each protected request resolves the account's current active status and role from PostgreSQL, so role changes take effect immediately. This account lookup does not create a session record.

Clients send `Authorization: Bearer <access_token>`. Missing, invalid, expired or invalidated tokens return 401 with a Bearer challenge; insufficient permissions return 403; missing configuration or unavailable database returns 503. Logout discards the client's token; there is no server logout/session endpoint. Password reset/change and deactivation increment `auth_version`, invalidating existing tokens without storing tokens individually. An administrator cannot deactivate or demote their own account; the last active administrator is protected. The admin password-reset endpoint deliberately excludes the caller's own account; use Change password instead.

Application changes and their audit events commit together. Audit details contain bounded action metadata, never plaintext passwords, password hashes, JWTs or footage. This general administrative audit does not implement the specification's future per-query purpose/evidence audit contract.

## Adding API routes

Register API routers through `register_api_router` in `main.py`; its explicit policy registry is independent of FastAPI's lazy included-router implementation. Attach one policy decorator from `security.py` to each endpoint: `require_permission(...)`, `authenticated_endpoint`, or, only for deliberately public endpoints, `public_endpoint`. Authentication runs before role checks; a protected API path missing a route policy is denied. CORS is outermost so 401/403 responses include the browser's allowed-origin headers. `/health/live`, API schema/docs and `POST /api/auth/login` are deliberately public.

## Remaining scope

Uploads, durable video/job records, processing queues, retrieval and RAG remain unimplemented. The existing query endpoint requires `queries:create` and still returns HTTP 501. Camera line/zone configuration versioning will be added with perception configuration; this slice implements camera identity/location/timezone and archive status only. Camera timezone changes do not rewrite historical recording timestamps.

As requested for this change, no automated tests, lint/type/build checks, live endpoint requests or model benchmarks were run. Setup/migration commands are documented for the developer to run; installation is not a verification result.
