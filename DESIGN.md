# Wheel Canvas design system

## Overview

Wheel Canvas is an independent community artwork and signing tool built on Squeekchain. The live wheel uses orange and gold marks on a near-black field; completed nights have seeded palettes that range across hues. A small pixel hamster gives the interface a recognizable point of origin; the artwork carries the visual detail, while the surrounding interface stays flat and quiet.

Use “built on Squeekchain” in the header, page/share titles, social metadata and exported cards. The footer retains “A Squeekchain community artwork.” The site’s independent community identity is explicit in the metadata, social image and README. The desktop header shows its byline; the existing compact phone header hides the byline to preserve its layout. The livestream link reads “Watch on Squeekchain” and opens `https://sepolia.squeekchain.com`.

The first section places the artwork, signing action and live measurements together. The gallery follows, then a short explanation and the exact transaction disclosure. The mobile layout keeps the artwork and signing action on the first screen. This is a dark, English-language interface; no light theme or localization system is implemented.

The source of truth is [`src/styles.css`](src/styles.css), with renderer colors and export typography in [`src/lib/art.ts`](src/lib/art.ts).

## Colors

The CSS uses semantic hex tokens, defined on `:root`.

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#101112` | Page and artwork caption backgrounds |
| `--surface` | `#18191a` | Stats strip, secondary controls, dialogs |
| `--surface-inset` | `#141516` | Signing panel and wallet rows |
| `--surface-hover` | `#222324` | Hovered neutral controls |
| `--text` | `#f4ede3` | Headings and primary text |
| `--muted` | `#b5afa5` | Supporting copy and units |
| `--subtle` | `#a29b91` | Artwork annotations |
| `--border` | `#343330` | Structural dividers and secondary button boundaries |
| `--accent` | `#f6b65b` | Primary action and warm brand details |
| `--accent-hover` | `#ffc775` | Primary action hover |
| `--accent-pressed` | `#e8a349` | Primary action pressed |
| `--on-accent` | `#231a0e` | Text and icons on the filled primary action |
| `--gold` | `#e9cc91` | Links, feedback and signer counts |
| `--success` | `#b5d2a2` | Connected/spinning dots, always paired with text |
| `--error` | `#f3b7a3` | Wallet connection errors |
| `--focus` | `#f9d69b` | Keyboard focus outline |

Measured declared CSS pairs: body text on the page is **16.26:1**, muted text on the surface **8.08:1**, primary button text **9.60:1**, artwork caption text **8.68:1**, and the subdued artwork annotation **6.87:1**. The canvas captions have an opaque `--bg` background. The design probe independently passed measured solid-background text; its canvas/image exclusions and remaining verification limits are in the validation record.

The renderer uses a warm radial field (`#271b14` → `#181613` → `#101112`), orange live strokes, golden block rings and address-derived HSL signer accents. Completed-night work strokes use a palette hue seeded from the renderer version, date, first block height, work and block count, plus a 44° spread within each palette. Their HSL lightness rises with activity, and they use source-over at 0.35 alpha. Only block rings use additive blending; ring intensity scales down beyond 32 blocks to preserve the work colors. These are artwork colors, separate from interface status colors. Keep signer hues derived from the address hash and nightly palettes deterministically seeded.

## Typography

All fonts are local WOFF2 files in `public/fonts/`, loaded with `font-display: swap`.

- **DM Sans**, fallback `sans-serif`, provides regular 400, medium 500 and semibold 600. It is used for prose, controls, headings and changing values.
- **Silkscreen**, fallback `monospace`, provides regular 400. It is used for short retro labels through `.pixel` and the desktop measurement labels. Long copy stays in DM Sans. Silkscreen’s letterforms supply the pixel character without authored all-caps copy or extra tracking.

| Token | Size at a 16px root | Role |
| --- | ---: | --- |
| `--text-xs` | 12px | Labels, units, captions, metadata |
| `--text-sm` | 14px | Controls and supporting interface copy |
| `--text-base` | 16px | Body, card titles, live values |
| `--text-lg` | 24px | Signing/dialog headings, mobile section headings |
| `--text-xl` | 36px | Section headings, smaller-screen main heading |
| `--text-display` | 56px | Wide-screen main heading |

Headings use weight 600, line-height 1.15 and balanced wrapping. The main display tracking is `-.055em`; smaller headings use `-.035em` or `-.025em`. At 1180px and below the main heading uses the 36px step; on phones its line-height is 1.12 and tracking `-.045em`. Prose uses 1.6 line-height, with the document default at 1.5. Numbers use tabular figures globally. Addresses in transaction details wrap with `overflow-wrap: anywhere`; they are not clipped. Short signer addresses link to their full address on the explorer.

PNG export uses the same loaded fonts at explicit output sizes in `downloadCard`: 36px titles/values, 24px pixel date, and 22px supporting text. These print-like canvas sizes are separate from the interface type scale.

## Layout

`.page-width` is the shared section container: at most 1320px, normally viewport width minus 96px. At 1180px it uses 32px side margins; at 650px, 16px. The header has its own full-width alignment and wraps when enlarged text requires it.

Spacing tokens are `4, 8, 12, 16, 24, 32, 48, 64px` (`--space-1` through `--space-8`). Components also use explicit 20px/28px insets and 40px/80px section spacing where specified in the stylesheet. Related controls use tighter spacing than separate content groups.

| Breakpoint | Implemented behavior |
| --- | --- |
| Above 1180px | Artwork and 314px signing column; five-column live stats; three-column gallery |
| 1180px | 36px main heading, 290px signing column, reduced outer margins |
| 900px | 270px signing column, three-column stats with wide progress cell, two-column gallery, share controls on a separate line |
| 650px | 76px minimum wrapping header; artwork above signing action; two-column stats and a full-row minted value; two-column gallery; stacked explanation; bottom-sheet dialogs |
| 360px | 270px artwork height and one-column gallery |

The normal phone artwork is 310px tall. Text panels grow with content; there are no fixed heights on their copy. The gallery thumbnails use a 1.6 aspect ratio on wide screens and 1.2 on phones, returning to 1.6 in the narrow single-column layout. At 390×844 the primary action ends around **723px**; the artwork and action are visible together. No horizontal overflow was measured at 320, 390, 650, 720, 900 or 1440px. A separate 200% text enlargement check at 390px also reflowed without horizontal overflow. This does not claim native browser zoom or a physical-device test.

## Elevation & Depth

The interface uses tonal surfaces and 1px structural borders, with no CSS box shadows. The artwork supplies its own glow. A dialog backdrop uses black at 78% opacity; native modal top-layer behavior separates it from the inert background. The canvas frame, stats strip and signing divider are structural parts of one surface, rather than nested cards.

## Shapes

- `--radius: 8px`: buttons, wallet rows, thumbnails and viewer artwork.
- 12px: the outer live canvas frame.
- 16px: dialogs, with only the top corners rounded for the phone sheet.
- 2px: signer swatches; circular 6px dots indicate wheel/connection status.
- Pixel hamster artwork uses crisp SVG geometry; utility icons use a consistent 1.6px stroke and `currentColor`.

Media clipping is limited to intentional artwork frames. Critical text and addresses remain in normal wrapping layout.

## Components

| Component / source | Reuse and behavior |
| --- | --- |
| `.button` in `src/styles.css` | `primary`, `secondary`, `quiet` variants. Primary is reserved for signing. Minimum 44px controls; signing is 48px. Distinct hover, pressed, disabled and focus states. |
| `Artwork` in `src/components/Artwork.tsx` | Accepts `night`, optional `live`, `paused`, `thumbnail`. ResizeObserver scales the canvas up to 2× device pixel ratio while geometry stays in CSS pixels. Accessible artwork summary describes real data or an unavailable state. |
| `paintArt` / `downloadCard` in `src/lib/art.ts` | Version `wheel-v2` canonical renderer and 1600×1200 PNG export. Nonzero work receives `round(300 + 900 × min(1, work / 15000))` strokes across all buckets combined. Seeded palette, 5–21 spiral turns and ring-spacing exponent 0.65–1.85 vary each night. Each completed block has a seeded ring; unique addresses have one accent stroke. The live view retains its work-driven trail and speed-driven tip. Canonical gallery/downloads omit transient animation. PNG titles include “built on Squeekchain”; dates, totals and signed-address footer remain. |
| Live stats / signing panel in `src/App.tsx` | Native `dl` and `progress`; status labels accompany colors. Signing states cover disconnected, wrong network, wallet prompt, pending, rejection, confirmation and retry. Unknown counts are not displayed as zero. |
| `WalletSheet` in `src/components/WalletSheet.tsx` | Named EIP-6963 rows, generic browser-wallet fallback, Coinbase, and phone app links. Rows are at least 56px. Per-row pending labels, disabled peers and recoverable inline errors. |
| `Modal` in `src/components/Modal.tsx` | Native `dialog` with named heading, autofocus close control, Escape/backdrop close and focus return. The background is inert while modal. Its contents scroll within a bounded viewport height. |
| Night cards / `NightViewer` in `src/App.tsx` | Entire card is a native button. Opens a hash-addressable full-size view, with earlier/later navigation, signatures, exact bucket interval and JSON data download. Open daily buckets remain “Waiting for data” until a snapshot generated after their end arrives. Their viewer preserves the actual interval, explains the wait and disables PNG/X sharing. |
| Static social image / `scripts/build-social-card.mjs` | Local 1200×630 image generated with `paintArt` and local fonts. Uses the completed October 29 API bucket. Brand byline says “built on Squeekchain”; supporting copy says “Independent community artwork”. Used by both Open Graph and Twitter metadata. |
| `ShareControls` in `src/App.tsx` | Pattern for PNG download/loading/error feedback and a prefilled X link. “I signed it” requires a matching verified address. Unavailable settlement data disables sharing/download. |
| `SignerList` in `src/App.tsx` | Address-colored swatches, short explorer links and progressive disclosure. Pending, empty and failed-read states remain distinct. |
| `Icon` / `Hamster` in `src/components/Icon.tsx` | Decorative SVGs are hidden from assistive technology. Icon-only controls supply their own accessible name. |

Every keyboard focusable control receives a 2px `--focus` outline with 4px offset. Forced-color mode retains system focus and button boundaries. Hover styles are restricted to devices that support hover. UI color transitions last 140ms. Press scale `.96` and smooth scroll run only when reduced motion is not requested. Canvas tip drawing lasts 1.6 seconds; an idle wheel dims over 12 seconds and then stops rendering animation. Reduced motion and the explicit pause control render a static state.

## Do’s and Don’ts

- Start new content with `.page-width` and existing type steps. Match the section heading and supporting-line pattern.
- Use a filled orange control for the one primary action; use neutral controls for downloads, navigation and utilities.
- Keep real data and unknown states distinct. Do not seed sample signers or show unavailable counts as zero.
- Keep the canonical renderer free of clock-based or unseeded randomness. Version any intentional change to its algorithm.
- Preserve the existing transaction address, chain, ABI and zero/self arguments when styling the signing UI.
- Keep explanatory text outside the artwork pixels so it remains readable, selectable and accessible.
- When adding a view, reuse native links/buttons, the existing modal and share patterns, then test its narrow layout, keyboard path, loading and failure states.

Design guidance attribution and licenses are recorded in `THIRD_PARTY_NOTICES.md` and `artifacts/licenses/`.
