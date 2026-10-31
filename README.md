# Wheel Canvas

A static, IPFS-ready independent community artwork built on Squeekchain. Squeektoshi’s wheel paints the canvas; verified Sepolia self-approvals add community-colored strokes. This is a community project, not an official Squeekchain site.

## Install, preview, rebuild

Use Node.js 22.12 or newer and npm.

```sh
npm ci
npm run dev
npm run typecheck
npm run test:model
npm run build
npm run preview
```

The complete production export is in `dist/`. Serve that directory with any static file server, including at a gateway subpath. Vite uses `base: './'`; navigation uses anchors and nightly hashes, with no server rewrites. Fonts, wallet marks, favicon, and social image are bundled locally. The site has no backend, keys, accounts, relay, or project ID to configure.

The checked-in `package.json` and `package-lock.json` are retained unchanged. The normal rebuild uses the existing local social image. To regenerate that 1200×630 image from the canonical renderer and local fonts, install Chromium with `npx playwright install chromium`, run `node scripts/build-social-card.mjs`, then rebuild. The image generator uses the completed October 29 settlement bucket observed in the public API; it does not invent live statistics. Downloaded nightly cards are generated in the visitor’s browser at 1600×1200.

## Data and signing

- Polls `https://api.squeekchain.com/v1/status`, `/settlements?range=24h`, `/settlements?range=30d`, and `/economy/state` every 15 seconds. Each resource keeps its last good result independently. Optional browser storage preserves data across reloads; stale values are labeled.
- Current artwork uses today’s UTC hourly settlement buckets, confirmed block heights, and unique signers. Wheel speed and cumulative work drive a transient live trail; IDLE gradually dims the live view. Pause and reduced-motion settings render a static frame.
- The 30-day API provides daily **noon-to-noon UTC** settlement buckets. Gallery dates label the start of those actual intervals; signatures always use midnight-to-midnight UTC on the labeled date. A past night stays **Waiting for data** until both the current time and the response’s `generatedAt` are after its bucket’s `endAt`. This also prevents cached partial data from turning into an archive after noon during an outage. The waiting viewer retains the actual settlement interval; partial work and blocks remain excluded and PNG/X sharing stays disabled. The archive is a rolling window, not permanent storage.
- Artwork is deterministic at a fixed output size: `wheel-v2`, UTC date, block heights, work and blocks seed the palette, spiral tightness and ring spacing. Canonical stroke counts scale from 300 to 1,200 over 0–15,000 work units, with no work strokes for zero work. Strokes use source-over at 0.35 alpha; only completed-block rings use additive blending, with individual intensity moderated when there are many blocks. Quiet nights are sparse and dim; busy nights are dense and bright. Lowercased signer addresses still determine hue and one accent stroke each. Arrival order and duplicate events do not affect the canonical image. PNGs and gallery views omit the transient live tip and idle fade. “Save artwork data” downloads the complete normalized nightly snapshot and renderer version for reproduction with `paintArt` in `src/lib/art.ts`. The version changed because the canonical rendering algorithm changed.
- The signing transaction is precisely `approve(connectedAddress, 0)` on SQK `0x5501e1fa81be1c3f49225fa7668da0245d07db60`, on **Sepolia, chain ID 11155111**. It sends no ETH value and grants no token allowance. Only testnet gas is needed. The app requests no message signature or other approval.
- Wallets use EIP-6963 discovery and EIP-1193 via wagmi. Phones get MetaMask, Coinbase Wallet, Rabby, and Phantom app links; Coinbase Smart Wallet is also available. No WalletConnect relay or project ID is used.
- Signers are read from public Sepolia RPCs, with exact timestamp-to-block boundary searches. Only SQK `Approval` events where `owner == spender && value == 0` count; duplicate addresses collapse to one stroke. All qualifying transactions count, including ones sent outside this app. Current dates are rescanned every 15 seconds with one confirmation; historical reads load in the background. RPC failure keeps the last verified set and offers retry. A just-confirmed local transaction is also verified against its receipt event.
- Public RPC endpoints are in `src/lib/chain.ts`. Testnet endpoints can rate-limit or become unavailable. No private RPC credential is embedded.
- “Watch on Squeekchain” opens `https://sepolia.squeekchain.com`, the livestream destination specified for this task. The footer keeps “A Squeekchain community artwork.”

## Validation

```sh
npm run typecheck
npm run test:model
npm run build
npx playwright install chromium webkit
npm run validate
```

`npm run validate` serves the real `dist/` under `/preview/`, then tests the primary flows with isolated API/RPC/EIP-1193 fixtures. It never sends an onchain transaction. It writes only to `test/scratch/validation/`, closes its browsers/server, and runs an axe accessibility scan. Browsers may require OS shared libraries; an unavailable WebKit run is recorded as a limitation, not a pass.

Worker results for this revision (2026-10-31): installation from the existing lockfile, production build, typecheck and expanded model checks passed; **25 Chromium interaction checks passed**, with no failed checks; axe reported **zero violations**; the pinned design probe passed **16/16** checks. The actual export was also inspected with live API/RPC data in the browser at 390px and 1440px. The artwork and signing button are visible on the first 390×844 screen, with the action ending at 723px. WebKit could not launch because required host libraries were missing. Native wallet transactions, passkey creation and physical wallet-app flows were not performed. Build warnings about dependency `use client` directives and an existing large bundle remain; they did not prevent the build. Installation and checks used an exact temporary copy of the permitted source and existing lockfile so no dependency or cache directory was created in the repository.

Actual worker results, live-data observations, the Better Interface review across six domains, and remaining limitations are in [`artifacts/validation.md`](artifacts/validation.md). The implemented design system is in [`DESIGN.md`](DESIGN.md). Attribution is in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## Submission path budget

Explicit path budget for `.gitignore`, including this revision’s changes: **512 bytes**. Its two artifact inclusion rules keep the requested validation evidence and license notices in the submission; the following rules still exclude generated dependency/cache/test-output directories at every nesting level and scratch work. It does **not** exclude `dist/`, source, lockfiles, fonts, or required runtime assets. `artifacts/` has its own allocation below.

| Paths | Maximum allocated bytes |
| --- | ---: |
| `src/`, `scripts/`, frontend config, manifests and lockfile | 524,288 |
| `public/` (fonts, marks, favicon, social PNG and font notices) | 1,048,576 |
| `dist/` (complete production export) | 2,097,152 |
| `artifacts/`, root documentation and third-party notices | 3,145,728 |
| `.gitignore` | 512 |
| Reserved headroom | 1,572,352 |
| Total ceiling | **8,388,608** |

Dependencies and package-manager/browser caches were installed outside the repository during worker validation. No dependency archives, registry mirrors, generated caches, or submodules are part of the deliverable.
