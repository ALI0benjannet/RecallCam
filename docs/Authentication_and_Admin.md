# Authentication and administration

This implementation slice connects login, role-based access, administrator-created users, camera metadata and administrative audit from the Next.js interface to FastAPI/PostgreSQL. It supplements the [source specification](RecallCam_Cahier_des_Charges.md) and [application database design](PostgreSQL_App_Design.md). It does not implement video upload/indexing, evidence export, standing queries or RAG.

## Start locally

From the repository root, configure root `.env` and start the full Docker stack:

```sh
docker compose up --build -d
```

Set `JWT_SIGNING_KEY` in the private root `.env` to a generated random secret of at least 32 bytes. A private key was added to the existing local development environment during this implementation, without displaying it. A fresh checkout must generate its own; `.env.example` deliberately has no usable signing key. Keep the issuer, audience and lifetime settings consistent across API processes.

The initial users/cameras/audit migration was previously applied to the local PostgreSQL database as setup. Compose retains that volume and runs its one-shot `migrate` before the backend. No default administrator is seeded; an empty user table needs the bootstrap command below.

Create the initial administrator explicitly:

```sh
docker compose exec backend python -m recallcam_backend.cli create-admin --email admin@example.com --display-name "Administrator"
```

The command prompts for the password without echoing it. Choose the real local account email; no default account/password is seeded. Passwords must contain 12–128 characters. Bootstrap is for the first administrator; later accounts are created from the Users page.

Backend and frontend already run as Compose services. Open `http://localhost:3000/login` and use the created account. The frontend proxies API calls to `backend:8000` without exposing Docker-only names to the browser. Root `.env` configures Compose; host `front/.env.local` is excluded. See [Containers](Containers.md).

## Browser workflow

After signing in, the shared workspace shows navigation allowed by the current account. The administrator can open **Users**, create an account with its role and initial password, change its display name/role, deactivate/reactivate it or reset its password. Password reset and ordinary account changes are separate actions. The account page supports changing one's own password.

The administrator can open **Cameras**, register a camera, enter its name/location/description and IANA timezone, then edit or archive/restore it. A camera record is metadata, not a live RTSP connection. Lines/zones, upload association and media-derived records belong to later processing features. Archived records are retained rather than hard-deleted by these controls.

Supervisors and administrators can inspect administrative audit records. The future query audit must additionally record each question's user, purpose, time and returned clips; administrative audit alone does not satisfy that separate requirement.

The UI uses the shared [design system](../DESIGN.md), shadcn/ui primitives and a global toast provider. Actions report success/failure, form validation remains visible next to inputs, and protected routes show explicit authentication/permission states.

## Authentication and role enforcement

`POST /api/auth/login` accepts JSON email/password and returns a bearer access token, expiry duration and user. `GET /api/auth/me` resolves the current account. There is no public registration, refresh endpoint, session table or persisted token allowlist.

JWT signing uses HS256 with a configured private secret. Validation fixes the algorithm and checks the signature, issuer, audience, issue/not-before/expiry claims, subject and account authentication version. The backend then loads the active account and current role from PostgreSQL. Permission changes therefore do not depend on an old role claim embedded in a token.

Two middleware layers enforce distinct responsibilities: authentication establishes the current principal; role authorization requires the route's declared permission. API routes without an authorization policy fail closed. Login is explicitly public; process-health and API-documentation routes are deliberate public infrastructure surfaces. CORS preflight is handled outside protected API execution.

Missing, expired, malformed or invalidated tokens produce `401`; an authenticated principal without the required permission receives `403`. Database/configuration unavailability is a service problem rather than invalid credentials. Backend permissions apply regardless of browser navigation or direct HTTP calls.

Tokens are kept in browser memory and tab-scoped `sessionStorage` to survive reloads in that tab. This is client storage, not a server-side session. It is accessible to page JavaScript; keep token access centralized, avoid unsafe HTML/script injection, and never log tokens or copy them into URLs. The backend remains the authority even if browser storage is modified. No JWT is kept in permanent `localStorage`.

Expiration or a protected-request `401` clears the browser token and returns to login with one notification. Logout discards the client token; it does not revoke a copied token remotely. Password changes/resets increase the account's authentication version, invalidating previously issued tokens without creating session records. The user signs in again afterward. Deactivation prevents authenticated access, and privileged mutations preserve at least one active administrator.

## API surfaces

| API | Purpose / access |
| --- | --- |
| `POST /api/auth/login` | Public sign-in. |
| `GET /api/auth/me` | Current authenticated account, role and computed permissions. |
| `POST /api/auth/change-password` | Authenticated account changes its password. |
| `GET`, `POST /api/users` | Administrator lists/creates accounts. |
| `PATCH /api/users/{user_id}` | Administrator updates display name, role or active state. |
| `POST /api/users/{user_id}/password` | Administrator resets a user's password. |
| `GET /api/cameras`, `GET /api/cameras/{camera_id}` | Authenticated footage-reading roles inspect camera metadata. |
| `POST /api/cameras`, `PATCH /api/cameras/{camera_id}` | Administrator registers/updates/archives/restores a camera. |
| `GET /api/audit-events` | Supervisor/administrator reads paginated administrative audit. |

List responses use `items`, `total`, `page`, `page_size`. User and camera identifiers are UUIDs. Passwords are accepted only by dedicated input contracts, hashed with Argon2 and never returned. PostgreSQL stores constrained roles, camera metadata and bounded audit details. No video bytes or passwords/tokens belong in audit payloads.

The browser API client and shared Pydantic contracts define the exact request/response shapes. OpenAPI is available at `/docs` when the backend runs. A role's declared permissions describe access policy, not proof that every future feature has been implemented.

## Verification status

At the user's explicit request, this change was not exercised with automated tests, lint/type checks, a frontend build, HTTP login requests or browser checks. Existing scaffold test results recorded earlier apply to that earlier scaffold only. The user will perform functional verification. Dependency installation and schema setup are setup operations and must not be presented as an end-to-end authentication test.
