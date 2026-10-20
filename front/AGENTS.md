# Frontend agent instructions

Read the root [agent instructions](../AGENTS.md), [product context](../PRODUCT.md) and [UI system](../DESIGN.md) before frontend changes. The cahier des charges remains authoritative for features; the UI system controls their consistent presentation.

- Use Tailwind CSS and the shared shadcn/ui primitives under `src/components/ui/`. Reuse the authenticated shell, API client, form patterns and global toast provider.
- Follow the web-semantique-inspired design in `DESIGN.md`: 252px deep forest sidebar, pale sage selection, off-white workspace, white bordered panels and self-hosted Manrope. Use semantic tokens from `src/app/globals.css`; avoid page-specific palettes, purple gradients and generic marketing decoration.
- Reuse `Brand`, `EvidenceGraphic`, `PageHeading` and shared panel/table/toolbar/status patterns. Keep the real camera preview on the overview; no invented metrics, footage or health. The mobile shell uses the shared accessible dialog below 1024px.
- Every mutation and request failure needs clear feedback through the shared notification system. Keep field errors inline as well. A failed load is not an empty list; never show success before backend confirmation.
- Respect all roles in navigation and direct-route guards, while treating backend authorization as authoritative. No signup, refresh-token flow or fake working footage/search views.
- Keep API addresses in configuration, credentials out of public environment variables, and JWT handling in the shared auth layer. Do not create ad hoc local token handling in individual pages.
- Compose is the development entry point. Browser API calls default to the frontend origin, proxied by `next.config.mjs` to the server-only `BACKEND_INTERNAL_URL`. Never send the Docker-only backend hostname to browser code or mount backend/model secrets into the frontend. Read [Containers](../docs/Containers.md) before changing deployment settings.
- Implement loading, empty, failed/retry, pending/disabled and permission-denied states. Use real labels, keyboard focus, dialog titles, accessible icon actions and responsive form/table layouts.
- The generated brand assets are in `public/brand/`; their README records provenance. Lucide handles ordinary UI icons.
- Preserve existing unrelated work and update UI documentation when a deliberate shared design change is made. Honor explicit user verification instructions: for this implementation the user asked to test personally, so no automated tests, builds, typechecks or browser checks were run.
