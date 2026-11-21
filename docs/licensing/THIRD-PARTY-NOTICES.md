# PageHearth third-party notice index

Internal beta review: see BETA-DISTRIBUTION-STATUS.md. External distribution HOLD.
Current source access is described in SOURCE-AVAILABILITY.md. The legal folder
contains matching source materials and original notices; historical audit reports
are deliberately excluded. Paths in the table are relative to the installation
unless stated otherwise. WinShell is absent from this candidate.

| Component | Terms and retained material |
|---|---|
| Electron 44.11.1 / Chromium / Node | LICENSE.electron.txt and LICENSES.chromium.html beside PageHearth.exe; mixed upstream licenses retained. |
| Tiptap/ProseMirror, React, CSpell, docx and other JS packages | Individual original licenses in resources/app.asar/node_modules; accessible copies and exact versions in this folder's npm/ and npm-inventory.json. MIT/ISC/BSD and other notices remain component-specific. |
| saxes 6.0.0 | supplemental/saxes-ISC.txt includes the upstream ISC and inherited notices, fetched from the v6.0.0 LICENSE. |
| isarray 1.0.0 | supplemental/isarray-MIT.txt is the license section of its installed upstream README. |
| PDF.js 6.4.299 | Apache-2.0 and standard_fonts/LICENSE_FOXIT and LICENSE_LIBERATION retained in npm/pdfjs-dist. |
| SQLite | Node built-in node:sqlite; SQLite public-domain dedication, Node/component notices retained in LICENSES.chromium.html. |
| EPUBCheck 5.3.0 and 5.4.0 | BSD-3-Clause; resources/epub/epubcheck-*/LICENSE.txt, THIRD-PARTY.txt and licenses/; preserve notices within JARs too. |
| Saxon-HE 11.4 | MPL-2.0; local source archive and instructions in SOURCE-AVAILABILITY.md. |
| Temurin 17.0.20.1+1 | resources/epub/java/legal and NOTICE; GPLv2+Classpath Exception and other terms. Matching source/build materials are in legal/sources/temurin-17.0.20.1+1; Microsoft conditions remain BLOCKED. |
| Typst 0.15.1 | resources/typst/LICENSE and NOTICE; Apache-2.0 plus upstream third-party terms. |
| Embedded Typst fonts/assets | supplemental/typst-assets/LICENSE and NOTICE; complete upstream collection retained, including fonts. No blanket Apache license for fonts. See SOURCE-AVAILABILITY.md for complete NewCM Work/source delivery. |
| @napi-rs/canvas 1.0.11 / Windows x64 native binary | MIT parent notice retained. Upstream v1.0.11 points to Skia commit 95ee33d7ec7791ab9c071675710a14fe6408ae4f. Identified Skia/Rust/transitive notices are in supplemental/canvas-native, with MPL sources in sources/canvas-mpl. |
| NSIS 3.0.4.1 / resources 3.4.1 | supplemental/NSIS-COPYING.txt copied from the actual build cache; covers core and compression terms. Extra plugins are not automatically covered. UAC/StdUtils/Nsis7z notices and matched source materials are supplied in supplemental/nsis and sources/nsis. WinShell is absent. |

Permissive licenses generally require preserving their applicable copyright,
permission and disclaimer texts; Apache NOTICE obligations are retained where
applicable. JSZip's MIT alternative is available; it is not automatically a GPL
dependency. Development tools are not assumed shipped merely because they are
in package-lock.json. The generated npm inventory describes the installed
production tree used for this candidate, not a certification of native internals.

PageHearth branding provenance is documented separately; no third-party font or
artwork is claimed as PageHearth-owned. See LICENSING.md and the approved branding
policy. No new restrictions on MPL-covered application code are imposed here.

## Ko-fi support-link artwork

The About support link uses an unmodified official Ko-fi cup, displayed locally
at 20px. Ko-fi branding belongs to its respective rights holders, not PixelFF;
it is not MPL-covered artwork. Source, file hash and the narrowly scoped official
creator-kit use guidance are recorded in `assets/licenses/Ko-fi-brand-use.md`
(installed as `supplemental/Ko-fi-brand-use.md`). No endorsement is implied.
