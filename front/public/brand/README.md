# RecallCam brand assets

## Current identity: expressive surveillance mascot (v3)

Generated on 2026-10-20 using the built-in image-generation tool. The user supplied their Sayl logo as a style reference and asked for a surveillance identity with life and personality. That image was a visual reference only; its wording, flags, microphone and multilingual motifs were not incorporated.

- `recallcam-mark-v3.png`: transparent square mascot used beside the live RecallCam wordmark.
- `recallcam-icon-v3.png`: identical square transparent artwork used as the favicon/app-icon source. This is a direct copy of the generated mark, not a separately generated or raster-edited character.

The mascot is a rounded cream surveillance-camera head on a swivel mount, with an amber camera-lens eye, cheerful winking eye and smile, and a forest-green recall swoosh. Soft dimensional shading intentionally follows the user's reference. Keep the character expressive, preserve its proportions, and pair it with live RecallCam text in the app. Use Lucide for ordinary UI controls. No application build or browser test was run for this asset replacement.

### Generation prompt (v3)

```text
Use case: logo-brand.
Asset type: a finished transparent mascot logo symbol for RecallCam, an AI video investigation app.
Input image: STYLE REFERENCE ONLY. The supplied Sayl logo demonstrates the friendly expressive personality, rounded cream robot surfaces, deep ink face, green framing shape, confident clean shapes and gentle dimensional polish the user likes. Design an ORIGINAL RecallCam surveillance mascot rather than editing Sayl's identity.
Primary request: give the logo life and warmth. A lovable, intelligent little surveillance-camera companion with a rounded cream-white CCTV camera head, slight curious head tilt, a dark forest-ink faceplate, expressive happy eyes and a little friendly smile. Make the surveillance-camera silhouette unmistakable through the projecting camera hood and compact swiveling camera mount beneath the head. Integrate a large camera lens into ONE eye, with a muted amber lens ring and a bright friendly glint; the other eye is a cheerful curved LED eye, creating an engaging wink. The lens is one of the eyes, never a third eye. The small swivel mount is part of the camera, not a human body. An open forest-green circular recall swoosh behind the head unifies the silhouette. Keep the mascot welcoming, observant and clever.
Style: polished modern illustrated mascot brand mark, similar warmth and gentle volume to the reference, crisp vector-like edges, substantial simple forms, restrained soft shading within the character, beautiful negative space, professional app branding, immediately legible silhouette.
Palette: deep forest green #163D32 and #246B54, warm cream #F6F5F0, very dark green-ink face, small muted amber #C59954 lens accent. Preserve the app's green identity.
Composition: ONE centered compact mascot emblem, square canvas, fills about 86 percent of the square, modest even padding, fully contained. Genuinely transparent outer background.
Constraints: no wordmark or text in this symbol (RecallCam is rendered separately in the app), no headset, microphone, flags, language bubbles, speech text, shield, police insignia, weapon, human portrait, floating accessory icons, watermark or mockup. Expressive personality and visual charm are essential; avoid a sterile diagram or generic flat outline icon.
```

## Archived identity: technical camera + AI (v2)

The following v2 assets are retained as history and are no longer referenced by the frontend.

Redesigned at the user's request on 2026-10-20 with the built-in imagegen tool. A recognizable CCTV camera and integrated three-node circuit motif replace the abstract return-arrow mark. The dominant forest green and amber lens/nodes preserve the application palette.

- `recallcam-mark-v2.png`: transparent logo used beside the live RecallCam wordmark throughout the frontend.
- `recallcam-icon-v2.png`: matching square app/favicon artwork on warm ivory.

The frontend references these versioned filenames so old browser image/icon caches do not keep the previous identity. Preserve proportions and use Lucide for ordinary UI controls. Do not use the old mark for new screens.

### Logo prompt (v2)

```text
Use case: logo-brand.
Asset type: production transparent logo symbol for RecallCam, a professional AI video-search and surveillance investigation app.
Primary request: redesign the identity so it clearly depicts BOTH a surveillance camera and artificial intelligence. Create one cohesive, distinctive emblem: a recognizable modern CCTV bullet camera angled slightly downward to the right, with a simple wall-mount bracket underneath, a prominent circular lens, and a compact three-node circuit/neural connection motif integrated into its housing. Integrate the circuit into the camera rather than placing unrelated icons beside it. Camera silhouette should be immediately recognizable; circuitry should make AI-assisted analysis apparent.
Style: polished flat vector-like graphic with clean substantial strokes, precise negative space and balanced geometry. Richer and more descriptive than an abstract viewfinder icon, still clear at navigation-logo size. Two-color identity: deep forest green #254D3C dominant and muted amber #B48240 for the lens and selected neural nodes. No text or wordmark, because the product name is rendered separately in the UI.
Composition: one centered compact emblem in a square canvas, filling approximately 82 percent of its width with modest even padding. Actual transparent background.
Avoid: generic sparkle icons, purple or blue, gradients, shadows, textures, 3D rendering, photorealism, shields, human faces, floating extra symbols, tiny intricate circuit traces, mockups, watermarks and typography.
```

### App icon prompt (v2)

The new transparent logo was provided as the edit reference.

```text
Use case: logo-brand.
Asset type: square RecallCam app icon and browser favicon source.
Edit target: the provided new RecallCam CCTV-camera-and-AI logo.
Preserve the recognizable CCTV camera silhouette, its direction and lens, the integrated three-node circuit motif, the forest green #254D3C and amber #B48240 colors. Make a clean, flat app-icon adaptation of exactly this new identity on a solid warm ivory #F6F5F0 square background. Center the emblem and make it occupy approximately 82 percent of the square width with comfortable padding. Simplify only unnecessary very fine mount details for small-size clarity. Keep the camera and integrated AI circuitry immediately recognizable, with a strong amber circular lens. Crisp flat fills and deliberate clean negative space.
No text, no wordmark, no additional icon, no border, no rounded outer-square corners, no texture, no lighting, no gradients, no shadow, no 3D, no mockup or watermark.
```

## Archived identity: return-arrow mark (v1)

The following files and prompts are retained as history. They are no longer the active frontend identity.

Generated for RecallCam on 2026-10-20 using the built-in imagegen tool. These are project assets, not sourced surveillance footage. No external stock image is used.

- `recallcam-mark.png`: transparent logo symbol for the wordmark and login branding.
- `recallcam-icon.png`: square warm-ivory app icon source for browser metadata.

The mark combines viewfinder corners, a return arrow and an amber registration dot. Keep proportions and colors intact. Pair it with live text reading **RecallCam** instead of embedding application text in images. Lucide is the interface icon library; do not generate separate icons for ordinary controls.

## Logo generation prompt

```text
Use case: logo-brand. Asset type: RecallCam app identity and favicon source. Create ONE crisp standalone symbol on a genuinely transparent background, no text. RecallCam is a professional video investigation and timestamped-evidence application used by operators, supervisors and administrators. Design a distinctive minimal flat geometric mark: two offset open viewfinder corners enclosing a small angular rewind/return stroke, suggest revisiting a recorded moment. Strong legibility at 24 pixels, simple 2D silhouette, generous breathing room. Deep forest green #254D3C for the main mark and one tiny muted amber #B48240 registration dot. Balanced compact square composition. No camera illustration, no eye, no security shield, no letter monogram, no circles-within-circles, no gradients, no shadows, no bevels, no mockup, no writing, no extra icons. Polished sober editorial identity suitable for a real engineering tool.
```

## App icon generation prompt

The logo above was the reference image.

```text
Use case: logo-brand. Edit the referenced RecallCam logo into ONE production app icon. Preserve the forest green #254D3C framing corners and rewind return arrow, the small amber #B48240 dot, and the exact flat minimal recognizable symbol. Place it on a solid warm ivory #F6F5F0 square field; no rounded square edge (the OS rounds). Increase the logo to fill approximately 78 percent of the square width, perfectly centered, with clean sharp vector-like flat fills. No extra text, shapes, gradients, textures, shadows or mockups. This is a favicon and app icon source, so legibility is essential.
```
