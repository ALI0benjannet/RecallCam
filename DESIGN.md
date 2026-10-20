---
name: RecallCam
description: A modern forest-and-sage workspace for video investigation.
colors:
  background: "#F5F6F2"
  surface: "#FFFFFF"
  foreground: "#203831"
  primary: "#246B54"
  sidebar: "#163D32"
  sidebar-foreground: "#F1F5ED"
  sidebar-muted: "#B4CBBF"
  sage: "#EAF0E3"
  sage-foreground: "#345741"
  muted: "#F0F3ED"
  muted-foreground: "#64736B"
  border: "#E2E8DF"
  amber: "#9A6B28"
  brand-amber: "#C59954"
  destructive: "#AA433B"
  primary-muted-foreground: "#C7D9CE"
  selection: "#DDEBCE"
typography:
  body:
    fontFamily: "Manrope Variable, Segoe UI, sans-serif"
    fontSize: "16px"
    lineHeight: 1.5
  heading:
    fontFamily: "Manrope Variable, Segoe UI, sans-serif"
    fontSize: "32px"
    fontWeight: 600
    letterSpacing: "-0.035em"
rounded:
  control: "8px"
  dialog: "12px"
  surface: "12px"
  feature: "16px"
spacing:
  unit: "4px"
  control-gap: "8px"
  group: "16px"
  section: "28px"
components:
  primary-action:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
---

# RecallCam UI system

## Overview

The user requested a complete redesign inspired by the team's **web-semantique** project. Its local backoffice templates and stylesheet informed this direction: a deep forest sidebar, pale sage selection, a light workspace, white data panels, generous spacing and clear type hierarchy. RecallCam adapts that visual language to cameras, recording timelines and evidence; it does not inherit the reference project's application behavior or dependencies.

This document replaces the earlier light-sidebar layout. [PRODUCT.md](PRODUCT.md) defines product facts; the [cahier des charges](docs/RecallCam_Cahier_des_Charges.md) remains authoritative for functionality. Tailwind CSS and shared shadcn/ui components implement the presentation. Guidance also draws from [Impeccable](https://github.com/pbakaus/impeccable). The redesign has not been visually or functionally tested, following the user's instruction to test personally.

## Colors

The semantic tokens in `front/src/app/globals.css` implement the palette above. Reuse them rather than introduce page-specific hex colors.

- Main workspace: soft off-white background, white data/form surfaces, dark green ink.
- Navigation: deep forest with readable sage text; selected links use pale sage with dark text and `aria-current`.
- Primary actions and links: green. Reserve the stronger accent for actions and selection.
- Sage: contextual banners, identity avatars and positive state labels. Active camera status means a registered active record, not a connected or healthy live stream.
- Muted surfaces: table headings, search fields, secondary groupings and skeletons.
- Amber: restrained brand/timeline detail. `brand-amber` is for illustration; use the darker `amber` token when text requires it.
- Destructive red: errors and destructive actions. Include words or accessible action labels, not color alone.
- `highlight` maps to `selection` for light accents on dark surfaces. `primary-muted-foreground` supports secondary diagram strokes on forest.

Keep the theme explicitly light; operating-system dark mode must not independently change components. No purple accents, gradient text, glass surfaces or decorative glow.

## Typography

Use **Manrope Variable**, self-hosted through `@fontsource-variable/manrope`, with a system sans-serif fallback. No font downloads during builds. One family carries the whole interface.

Page titles are 28px on small screens and 32px above the small breakpoint, weight 600, tracking -0.035em. `PageHeading` supplies the small green terminal dot. Section headings are 15–18px, working text 13–14px, supporting metadata 11–12px. The login brand message can reach 56px; routine administration must stay compact. Reserve 10px for short secondary labels. Do not place essential instructions in tiny text.

Descriptions use a readable 24–28px line height and constrained measure. Use tabular numerals for dates, counts and pagination. Do not use monospace as general decoration. Keep tracking at or above -0.04em.

## Layout

`AppShell` provides a fixed **252px forest sidebar at 1024px and above**, an **82px account/breadcrumb header**, a flexible content region and a restrained footer. Content has a 1540px maximum width and 20/32/40px responsive side gutters. Group navigation into Workspace and Management, hiding unauthorized links. The sidebar's short context note is guidance, never fabricated service status.

Below 1024px, the navigation opens in the shared Radix/shadcn dialog with keyboard dismissal and focus management. Keep the account link accessible from the header. Forms stack and data tables scroll within their own containers; the page must not overflow horizontally.

The overview combines a sage orientation banner, a real active-camera preview, permission-aware shortcuts, the current role description and shared header service indicators. Camera totals come from the existing paginated API; do not invent recording counts, processed hours, progress or service health.

Login uses a forest identity panel and a focused white credential panel. The diagram is conceptual timeline geometry. On small screens, retain compact branding and prioritize the sign-in form. No public signup, fake password recovery or unimplemented OAuth buttons.

Camera, user and audit lists share one bordered panel: panel heading/count, integrated search/filter toolbar, table, pagination. Account and camera edits retain focused dialogs; account settings use profile and password panels. Upload and library pages use real APIs and preserve their distinct form/table/player layouts. Investigation remains marked **Not connected yet**; Process stays disabled until indexing is implemented. The upload progress percentage measures bytes sent, not completed storage or indexing.

## Elevation & Depth

White surfaces and thin borders establish hierarchy. Primary buttons may use a small offset shadow; dialogs use functional overlay elevation. Avoid a large shadow on every panel, excessive nested cards, blurred decorations and ambient dashboard animation. Hover/focus changes should be short (roughly 150–200ms). Respect reduced-motion preferences.

## Shapes

Controls use 8px corners, ordinary surfaces/dialogs 12px and prominent feature compositions 16px. Small status labels can use rounded rectangles; round avatars represent users. Use Lucide consistently for interface icons.

`Brand` supplies live wordmark text and the current friendly surveillance-camera mascot on a pale tile. The user explicitly requested the warmth and personality of their Sayl reference: a rounded cream CCTV head with an amber camera-lens eye, cheerful winking eye and smile, compact swivel mount and forest-green recall swoosh. Preserve its expressive character; do not flatten it back into a sterile technical camera/circuit icon. Gentle shading is part of this illustrated brand asset, not permission to introduce gradients or glow across the UI. Use [recallcam-mark-v3.png](front/public/brand/recallcam-mark-v3.png) and [recallcam-icon-v3.png](front/public/brand/recallcam-icon-v3.png); [asset provenance](front/public/brand/README.md) records the reference role and exact prompt. Keep aspect ratios and empty image alt text when adjacent text already names the brand. Previous v1/v2 assets remain archived.

`EvidenceGraphic` is a reusable, decorative camera-and-timeline SVG. It conveys the product concept and contains no fabricated footage, timestamps or job progress. Its colors come from shared tokens.

## Components

Use the shared shadcn/ui primitives in `front/src/components/ui/` for buttons, fields, selects, tables, dialogs, badges and confirmations. `front/components.json` records registry configuration. Extend a shared primitive before creating a second control style.

Shared composition classes include `panel`, `panel-header`, `panel-title`, `panel-description`, `table-shell`, `list-toolbar`, `entity-icon`, `status-pill`, `status-pill-active` and `subtle-link`. Use `PageHeading`, `EmptyState`, `LoadError`, `LoadingRows` and `Pagination` for consistent states. Standard buttons/inputs are 40px high; the sign-in form uses 48px controls. Dialog content scrolls within the viewport.

One global Sonner toaster covers every route, including login. Notify after confirmed mutations and request failures. Preserve inline field errors and input values after failure. Prevent duplicate submissions, confirm account deactivation/camera archival, and avoid repeated expired-token notifications. Successful background list loads need no toast.

Every data view needs populated, loading, empty and error-with-retry states. A failed request is not an empty collection. Count badges disappear while loading or failed rather than showing stale totals. An unchecked connection is not healthy. Placeholder controls must never simulate answers or uploads.

Preserve visible focus, meaningful labels, dialog titles, accessible icon actions, keyboard dismissal and reduced-motion behavior. Keep the skip-to-content link. Permission-aware navigation and direct-route views support backend enforcement; they never replace it.

## Do's and Don'ts

- Reuse the shared shell and tokens across every implemented or future route.
- Keep each page's main action clear; use direct verbs such as Create user, Save changes and Create camera.
- Show camera location and recording timezone when relevant; never confuse upload time with recording time.
- Keep role descriptions separate from current implementation availability.
- Make unavailable features explicit without filling them with fake records, camera thumbnails or answers.
- Use purposeful diagram geometry; no fabricated screenshots or surveillance imagery.
- Avoid repetitive icon-card grids, excessive eyebrow labels, oversized admin-page heroes and per-page themes.
- Update this document, frontend instructions and shared styles together when changing the design system.

Service indicators live in the authenticated header: neutral while checking, green check for a confirmed connection, red cross when unavailable. Include readable labels and accessible state text. A connected media worker is labeled Playback; optional diagnostic standby remains labeled Standby. Neither implies AI indexing readiness. Audit rows render actor/resource names, with descriptive removed-record fallbacks; UUIDs remain API identities rather than table labels. Private thumbnails use ordinary image elements, not the shared Next image optimizer.

## Recording player

Use the shared `RecordingPlayer` in `front/src/components/recording-player.tsx`. It integrates **Video.js 10.1.0** (`@videojs/react`, Apache-2.0) with the packaged Neutral video skin. Use its public CSS properties in `recording-player.css`: sage/selection accents, forest accent text and the shared Manrope font. The dark viewing surface keeps footage legible; `object-fit: contain` preserves the complete camera image. Never crop surveillance footage to fill a decorative frame.

The library player includes a scrubber, elapsed/duration display, play/pause, volume, playback speed settings, player-scoped keyboard shortcuts, touch seeking, buffering/error states, fullscreen and picture-in-picture where available. The page provides a collapsible shortcut reference. Retain the library's explicit open/refresh-link actions and error toasts. Ordinary play/pause/seek actions need no toast.

Playback uses private stored media through the native HTML video adapter. No external hosting, analytics, casting extension, fabricated subtitle track, storyboard or quality rendition is configured. Unavailable capabilities follow the skin's availability handling. The player does not add codecs or transcode files; keep MPEG compatibility guidance visible. Future citations must seek using original-recording relative seconds through the shared handle, with absolute/camera times resolved from the source metadata. Citation navigation, event timelines and evidence strips remain future M7 work.

Playback preparation extends source selection: the backend prefers a completed H.264 MP4 viewing copy when available. The page labels it **Viewing MP4 copy**, retaining original metadata. Browser format/decoding errors offer the explicit administrator **Prepare playback** action, while network failures suggest refreshing the link. The shared `PlaybackPreparationPanel` displays real queued/running stages, ready/failed states and explicit retry; it never fabricates percentage progress or starts indexing. Other viewers can inspect status/play ready copies and are told when an administrator is needed. Show **Play MP4 copy** after completion, preserving the private authorization flow. See [Playback preparation](docs/Playback_Preparation.md).

On renewal of a playback link for the same recording, preserve position, paused state, speed, volume and mute in memory. Resume only if playback was already running; a browser may require pressing play again. Do not persist signed media links or resume state to browser storage. Remount the player when its source changes; do not carry one recording's position into another recording.
