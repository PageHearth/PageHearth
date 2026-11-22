# PageHearth 0.1.2 matching application source

Copyright © 2026 PixelFF. Original source: MPL-2.0. PixelFF is the owner's personal development brand, not a company. Third-party notices and separately protected branding remain distinct.

Based on development revision 736e6a7cd818c13a13000c972abb15d9e0073059 plus the official-repository updater correction; the source files are listed and hashed in SOURCE-MANIFEST.json. Installer SHA-256 382339363260A085876728CA14868E315ED5344D24C628CF8C0C56CB427C987D. All 144 freshly compiled application files match the candidate app.asar. This is source/output correspondence, not a byte-reproducible installer guarantee.

INTERNAL REVIEW ONLY: external beta HOLD; retained Microsoft redistribution interpretations unresolved. This label is a release hold, not a limitation on MPL or third-party license rights. See docs/licensing/BETA-DISTRIBUTION-STATUS.md.

Build prerequisites: Node 24/npm; npm ci; npm run build. Electron remains 44.11.1. Artwork is deliberately excluded: supply locally authorized artwork or replacements at referenced paths before Vite/installer builds (notably assets/branding/pagehearth/PageHearth_App_Icon.png and assets/branding/kofi/cup.avif). Full installer assembly additionally requires the publishing tools, branding, generated documentation and legal resources declared in package.json. This archive is not a self-contained branded rebuild kit. The WinShell adapter and NSIS source are included; default dist:win does not enable it. The internal packaging harness consumes an accepted prepackaged runtime and refuses overwriting prior candidates.

No Git history, personal data, acceptance reports, private evidence, caches, generated application files, runtime binaries, artwork or guide content are included. Six optional host-specific QA scripts and binary test fixtures are excluded; some tests require their separately documented fixtures. No application src/ file is omitted. Pattern scanning is not a guarantee that every possible secret format is detected.

Deliver this ZIP and its receipt beside the exact installer after approval. Deliver the version-matched PageHearth third-party-materials ZIP from the receipt with equivalent access too; it contains upstream source/build materials, NOT PageHearth application source. Installed legal notices explain each component. No NDA or extra restriction on MPL source rights. The private draft release is in PageHearth/PageHearth; publication remains pending approval.


Microsoft-only installer agreement review: see docs/licensing/MICROSOFT-INSTALLER-AGREEMENT-REVIEW.md and assets/licenses/microsoft/MICROSOFT_RUNTIME_AGREEMENT.txt. Replacement installer acceptance remains pending; prior 5/5 native acceptance applies to the updater baseline. No legal certification is asserted.
