# Wheel Canvas revision validation

Worker record, 2026-10-31. This records checks performed for this revision; it is not independent certification.

## Scope and result

Complete for the stated implementation scope. The existing React/TypeScript/Vite site, signing transaction, wallet configuration and responsive CSS were retained. The final production export is `dist/`, with local fonts, favicon, social image and relative asset URLs. It was tested under `/preview/`, including live public API/RPC reads. No deployment or real wallet transaction was performed.

| Requested change | Result | Implementation |
| --- | --- | --- |
| “built on Squeekchain” in title, header, share card and meta tags | Met | `index.html:7`, `src/App.tsx:39`, `src/App.tsx:354`, `src/lib/art.ts:237`, `public/social-card.png` |
| Keep “A Squeekchain community artwork” | Met | Existing footer preserved; metadata/social image identify the independent community project |
| Distinct past nights; work-scaled strokes, source-over, seeded variation | Met | `src/lib/art.ts:76`: renderer version `wheel-v2`, per-night stroke budget, palette/spiral/ring variation, activity-based lightness, additive blending scoped to block rings |
| Exclude open buckets and show “Waiting for data” | Met | `src/lib/data.ts:173`, `src/App.tsx:174`: bucket must end before both current time and snapshot generation; actual interval retained; partial totals excluded; sharing disabled |
| “Watch on Squeekchain” → requested Sepolia site | Met | `src/App.tsx:730` links to `https://sepolia.squeekchain.com` |
| Preserve live canvas, signing, signer list, sharing and mobile layout | Met in performed checks | 25 Chromium interaction checks, live browser walkthrough and screenshots; native wallet/device limitations below |
| Export, source, existing lockfile, README and DESIGN.md | Met | Complete `dist/`, unchanged manifest/lockfile/config, root documentation and compact evidence in `artifacts/` |

Visual idea: a wheel of seeded work strokes and community signatures carries the detail, framed by a quiet dark interface and a small pixel hamster.

## Commands and actual results

Dependencies and browser binaries were installed outside the repository. The existing manifest/lockfile, build configuration, `src/`, `scripts/`, `public/` and `index.html` were copied exactly into a temporary build directory. These commands ran there; the completed export was copied back and compared byte for byte. No repository dependency directory, manifest change or dependency archive was added.

| Command | Actual outcome |
| --- | --- |
| `npm ci --no-audit --no-fund` with external install/cache locations | Passed, 51 packages installed from the existing lockfile |
| `npm run typecheck` | Passed, exit 0, `tsc --noEmit` |
| `npm run test:model` | Passed, exit 0; strict parsing/units, UTC rollover, canonical rendering and archive regression assertions |
| `npx playwright install chromium webkit` using external browser storage | Downloaded browsers; reported missing host libraries for WebKit |
| `node scripts/build-social-card.mjs` | Passed; generated the actual local 1200×630 branded image with the current renderer and local fonts |
| `npm run build` after the last source correction | Passed, exit 0; Vite 7.3.7, 1,655 transformed modules, approximately 4.7 seconds |
| `npm run validate` against that production build | Passed, exit 0; **25 Chromium checks passed, zero failed; one WebKit limitation** |
| `IMD_PLAYWRIGHT=<external module> node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste` from the repository root after the final build | Passed, exit 0; **16/16 taste@1 checks** |
| `git diff --check` | Passed |

Final integrity checks confirmed byte-identical build inputs/export, complete relative entry assets and documentation links, unchanged protected files, and no dependency/cache directories, archives or symlinks in the submission file set. The entire candidate submission measured approximately **5.31 MiB**, below the **8 MiB** ceiling. The `.gitignore` change uses **239 / 512** explicitly budgeted bytes and includes evidence artifacts while retaining cache exclusions.

The build reports nonblocking warnings about dependency `use client` directives and a JavaScript chunk above 500 kB. The live browser reports unused font-preload warnings; all four local font faces were confirmed loaded, local resource requests succeeded, and no script errors were observed. These warnings do not establish a broken interaction.

The model checks cover six work levels (0, 150, 4,000, 10,891, 15,000 and 30,000), the 1,200-stroke budget across multiple buckets, 0.35-alpha source-over strokes, and one additive ring plus accent per completed block. They check exclusion immediately before and exactly at `endAt`, admission strictly afterward with a completed snapshot, cached partial data after closure, clock skew, retained waiting intervals, preserved live hourly data, and stable completed-night heights as an open bucket grows. Input reorder and duplicate/case-varied signers remain deterministic.

The interaction runner uses isolated API/RPC/EIP-1193 fixtures and sends no real transaction. It checks:

- Product and primary action on the first 390×844 screen; action ends at **723px**.
- Reflow without horizontal overflow at **320, 390, 650, 720, 900 and 1440px**, plus separate 200% root-text enlargement at 390px.
- Metadata, footer branding, livestream destination, open-night viewer and disabled share controls.
- Named EIP-6963 discovery, generic-row suppression, keyboard dialog containment, Escape and focus return.
- Wrong-chain switch/add-chain fallback; rejected transaction retry; disabled pending state; exact zero-value SQK self-approval calldata and receipt confirmation; signer deduplication.
- Genuine 1600×1200 PNG download with the updated title, signed X text/nightly hash, full gallery, earlier/later navigation and JSON download.
- Pause/resume, reduced-motion context, 15-second polling, cached outage retention/reload, API/RPC recovery and malformed-cache rejection.
- Open snapshot still excluded after noon; a fresh completed snapshot makes the night/share controls available without reload.
- Four phone wallet links and Coinbase Smart Wallet row; zero axe violations, zero script errors and zero missing local assets.

At the same thumbnail dimensions, the fixture night with 13,297 work / 1,141 blocks measured mean pixel brightness **32.00**, versus **21.15** for 150 work / 12 blocks. Pixels with luminance above 50 numbered **19,880** versus **839**. This validates activity differences in that fixture; screenshots and live data inspection establish visible palette and ring-spacing variation. These are artwork metrics, not text contrast ratios.

Compact actual reports: [`checks/interactions.json`](checks/interactions.json), [`checks/taste.json`](checks/taste.json), [`checks/accessibility.json`](checks/accessibility.json). Full raw output and temporary screenshots remain scratch data and are not shipped.

## Better Interface review: all six domains

Applied the pinned Better Interface workflow and core principles for accessibility, layout, writing, typography, colors and UI while implementing the changes, then reviewed the final export. Existing deliberate visual choices were preserved.

| Domain | Coverage and evidence | Limits |
| --- | --- | --- |
| Accessibility — Checked | Native controls/links and canvas descriptions reviewed; keyboard dialog/focus-return tests passed; visibly focused wallet row inspected; zero axe violations | No screen-reader session, physical assistive technology or exhaustive focus-background audit |
| Layout — Checked | Existing DOM/grid/breakpoints reviewed; automated six-width reflow and 200% text enlargement; browser screenshots inspected at 320, 390 and 1440; artwork/action visible together on phone; waiting dialog scrolls | Text enlargement is not native browser zoom; no physical-device/RTL test |
| Writing — Checked | “built on Squeekchain” consistent across requested surfaces; waiting text states only available knowledge; actual pending bucket interval exposed; livestream label names destination; existing transaction disclosure preserved | No user research or additional language versions |
| Typography — Checked | Existing six-step scale, two font families, three weights and tabular figures retained; font faces confirmed loaded; probe passed size/face/tracking checks; narrow wrapping inspected | OS-specific rasterization and all possible content lengths not exhaustively tested |
| Colors — Checked | Existing role tokens retained; current CSS token-pair measurements repeated; probe passed all measured solid-background text; artwork palettes reviewed independently of status colors | Probe excludes six text boxes over media/gradients; not every composite state measured |
| UI — Checked | Existing component states preserved; connect/loading/wrong-chain/rejection/pending/confirmation/error/retry paths exercised with fixtures; actual gallery/viewer/signers walked; pause and reduced motion tested; native modal remains | No physical wallet-app/passkey test, forced-colors rendering or 10%-speed animation-panel review |

Measured current CSS pairs: `--text / --bg` **16.26:1**; `--muted / --surface` **8.08:1**; `--on-accent / --accent` **9.60:1**; `--muted / --bg` **8.68:1**; `--subtle / --bg` **6.87:1**. These identify the measured declared pairs; the probe separately measures resolved solid-background text. The artwork itself is not interface text. Light theme/localization variants are not applicable because the existing product provides neither.

## Findings, corrections and rechecks

1. **Medium — branding implied site authorship.** `src/App.tsx:354`, `index.html:7`, `src/lib/art.ts:237`.
   Now in the input: the header said “by Squeekchain”; page/social/export surfaces lacked the requested community byline.
   Change: “built on Squeekchain” across those surfaces and X text; independent-community descriptions; regenerate the local social image; preserve the community footer.
   Why: explicit branding requirement. Recheck: metadata assertions passed; desktop header, social PNG and downloaded PNG inspected.

2. **High — archive art saturated into similar gold discs.** `src/lib/art.ts:76`, `src/lib/art.ts:85`, `src/lib/art.ts:116`.
   Now in the input: up to 1,200 strokes per bucket used additive blending, with a narrow fixed palette and geometry.
   Change: allocate 300–1,200 strokes across an entire nonzero-work night, source-over at 0.35 alpha; seed palette/spiral/ring distribution from nightly data; brighten with work; reserve additive drawing for block rings and moderate individual rings when there are thousands.
   Why: explicit gallery fidelity requirement. Recheck: deterministic model checks, pixel-density/brightness assertion and real-data gallery screenshots passed. Live gallery shows green, purple and yellow palettes with different ring concentrations; the zero-work night remains empty.

3. **High — an open daily bucket appeared as past artwork.** `src/lib/data.ts:173`, `src/App.tsx:174`, `src/App.tsx:200`.
   Now in the input: daily history was assigned without checking its end; a previous calendar date could still include unfinished noon-to-noon work.
   Change: require `endAt < min(now, generatedAt)`, preserve only pending interval metadata, and show “Waiting for data” in the card/viewer. Disable sharing until complete and explain the completed-snapshot requirement.
   Why: explicit stability requirement. Recheck: boundary/cache/clock-skew/model tests, clock-controlled admission tests and actual October 30 waiting viewer all passed. A cached partial snapshot cannot become archival just because local time advances.

4. **Medium — livestream control named the hamster and opened the general site.** `src/App.tsx:730`.
   Now in the input: “Watch Squeektoshi” linked to the general Squeekchain homepage.
   Change: “Watch on Squeekchain” linking to `https://sepolia.squeekchain.com`.
   Why: explicit destination/label requirement. Recheck: production DOM link assertion passed. The external player itself was not controlled or tested.

No unresolved implementation finding from these four changes remains. The probe has no failed checks. Unused font-preload warnings remain a low-impact observation; the original font-loading setup was preserved.

## Browser evidence and remaining limitations

The browser tool inspected the actual production export with live public data, separately from the fixture runner. The tool did not provide its documented preview sidecar, so a foreground local static server served the export at `/preview/` for the walkthrough and was stopped afterward. The browser confirmed loaded local fonts, live data, twelve actual current-night signers, expansion of the signer list, wallet sheet keyboard focus/return, gallery navigation and full-size views. The final waiting viewer showed the actual October 30 noon to October 31 noon interval and disabled downloads. Script errors and missing local resources were not observed.

Retained screenshots:

- [`screenshots/live-mobile-390.png`](screenshots/live-mobile-390.png) and [`screenshots/live-desktop-1440.png`](screenshots/live-desktop-1440.png): product and signing action with live data.
- [`screenshots/gallery-mobile-390.png`](screenshots/gallery-mobile-390.png) and [`screenshots/gallery-desktop-1440.png`](screenshots/gallery-desktop-1440.png): distinct completed-night palettes, empty quiet night and waiting open bucket.
- [`screenshots/viewer-desktop-1440.png`](screenshots/viewer-desktop-1440.png): completed canonical artwork and share controls.
- [`screenshots/waiting-mobile-390.png`](screenshots/waiting-mobile-390.png): pending interval disclosure; the native modal scrolls to the remaining content.
- [`screenshots/wallet-focus-mobile-390.png`](screenshots/wallet-focus-mobile-390.png): visible keyboard focus in the wallet sheet at a narrow desktop-browser viewport.
- [`screenshots/signed-card-fixture.png`](screenshots/signed-card-fixture.png): genuine downloaded PNG using the isolated signing fixture; it is not a claimed real transaction.

WebKit could not launch because host libraries including `libgtk-4.so.1` and `libgstreamer-1.0.so.0` are unavailable. Safari/iOS behavior therefore remains unverified. No native wallet connection, real signing, Coinbase passkey creation, physical phone wallet deep-link flow, screen-reader session, native 200% browser zoom or forced-colors rendering was performed. Simulated wallet interactions and viewport checks do not establish those results. Public API/RPC services and the external livestream can change independently of this static export. The archive remains a rolling API window and can reflect upstream corrections; this revision specifically prevents unfinished buckets from being presented as completed nights.
