# RecallCam frontend

Next.js App Router, TypeScript, Tailwind CSS 4 and official shadcn/ui components. Read [the UI design system](../DESIGN.md) and [frontend agent instructions](AGENTS.md) before changing the interface.

## Run in Docker

```sh
docker compose up --build -d
docker compose logs -f front
```

Run those commands from the repository root after configuring root `.env` as in the [README](../README.md). Node dependencies live in the frontend image, while source/public directories are mounted for hot reload. Host `node_modules`, `.next` and `front/.env.local` are excluded. The Docker setup does not require host Node.js/npm.

Browser requests default to the same frontend origin. `next.config.mjs` proxies `/api/*` and `/health/live` to the server-only `BACKEND_INTERNAL_URL`, defaulting to `http://backend:8000` in Compose. `NEXT_PUBLIC_API_BASE_URL` is an optional direct browser-reachable override; it must never be a Docker-only hostname. Only selected frontend variables enter this container; no backend/model credentials are passed to it.

Open `http://localhost:3000/login`. There is no public sign-up or default account. The first administrator is created through the backend bootstrap command. URLs are configured rather than selected by development operating system. `NEXT_PUBLIC_*` values are visible to the browser and must not contain secrets.

## Implemented routes

| Route                          | Scope                                                                                                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `/login`                       | Email/password login with JWT access token.                                                                                            |
| `/`                            | Role-aware overview, real active-camera preview/count, workspace shortcuts and on-demand backend process check.                        |
| `/account`                     | Current account, role description and change own password.                                                                             |
| `/admin/users`                 | Administrator: list/search/filter users, create accounts, edit names/roles, activate/deactivate and reset another user's password.     |
| `/cameras`                     | All authenticated roles read; administrator creates/edits/archives/restores cameras with location, description and recording timezone. |
| `/audit`                       | Supervisor/administrator application audit list. Query/evidence auditing remains future work.                                          |
| `/upload`, `/library`, `/chat` | Explicit placeholders; uploads, indexing and investigation are not connected yet.                                                      |

Navigation and direct route views are permission guarded. Backend JWT/role enforcement remains authoritative. A global Sonner toaster is mounted for all pages, including login; forms also show inline server validation errors. User deactivation and camera archival require confirmation.

## Authentication behavior

The access token is kept in memory and in tab-scoped `sessionStorage` so a page refresh can restore access. It is never put in a URL, persistent `localStorage`, console output or application database. This is a browser storage choice, not a server session. JavaScript can access this bearer token, so future frontend changes must preserve the prohibition on unsafe HTML and avoid introducing script injection.

There is no refresh token. Expiry/401 clears local credentials and returns to login. A late response from an older token cannot log out a new sign-in. Logout discards the local token; it does not invalidate a copied bearer token. Password changes/resets are enforced by the backend's account token version. The frontend re-reads `/api/auth/me` on window focus/return to a visible tab and after an administrator edits their own display name. Backend authorization reads the current active account and role on every protected request.

## Components and styling

Official [shadcn/ui](https://ui.shadcn.com/docs/installation/manual) registry primitives were added with `shadcn@4.22.1` and adapted to the documented palette. Components live in `src/components/ui/`; `components.json` preserves the registry configuration. Current registry components use `radix-ui` and `cn`. Tailwind uses `@tailwindcss/postcss` in `postcss.config.mjs`. Manrope Variable ships locally through `@fontsource-variable/manrope`; builds do not fetch Google Fonts.

The redesigned interface takes its visual direction from the local web-semantique backoffice: a forest sidebar, sage accents, white list panels and stronger typography. The 252px desktop sidebar becomes a keyboard-accessible navigation dialog below 1024px. Login, overview, account, camera/user management, audit and unavailable-feature screens share this system.

Use shared `Brand`, `EvidenceGraphic`, `PageHeading`, `EmptyState`, `LoadError`, `LoadingRows`, `Pagination` and centralized API/error handling before adding alternatives. Brand assets live in `public/brand/`; provenance and the durable design tokens are recorded in the root design documentation.

Formatting: `docker compose exec front npm run format`. Optional verification: `docker compose exec front npm run typecheck` or `docker compose run --rm --no-deps front npm run build`. Dependency changes require rebuilding the image. See [Containers](../docs/Containers.md) for details.

Per the user's request, this authentication/camera implementation was not exercised with tests, a build, a typecheck or browser automation. Dependency installation and source formatting were performed; runtime behavior remains for the user to verify.

The later containerization/proxy change was also not built, started or tested, at the user's request.

The subsequent full UI redesign was source-edited and formatted only. Tests, builds, typechecks, API requests and browser checks were not run, following the same user instruction.
