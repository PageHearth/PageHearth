# PageHearth 0.1.2 source availability

Copyright © 2026 PixelFF. Original PageHearth application code is MPL-2.0.
PixelFF is the owner's personal development brand, not a separate company.
Branding and third-party components retain their separate rights.

INTERNAL REVIEW ONLY: external distribution remains on HOLD. See
BETA-DISTRIBUTION-STATUS.md and MICROSOFT-RECIPIENT-TERMS-PROPOSAL.md.

## Matching application source

Once distribution is authorized, provide the PageHearth-0.1.2-source-<revision>-beta-review.zip identified in the delivery receipt
alongside the exact installer and RELEASE-RECEIPT.json. The receipt supplies both
SHA-256 hashes; SOURCE-MANIFEST.json in the ZIP identifies the committed revision,
reviewed build/documentation files and per-file hashes. Do not use
an older internal source archive. The designated application release repository is https://github.com/PageHearth/PageHearth; the Beta 1 release remains draft and private pending review.
Request the matching ZIP through the same channel that supplied your installer;
provide it directly with equivalent access, without an NDA or extra MPL restrictions.

The archive includes original application source, lockfile, build configuration,
installer logic, scripts and textual tests, LICENSE and current source/branding
instructions. It excludes Git history, internal audit/acceptance reports, private
evidence, binary test fixtures, runtime binaries and artwork. See its README for
build prerequisites and excluded-resource details; it is not a self-contained
branded installer rebuild kit. Exclusions do not limit MPL rights.

## Included third-party source materials

Paths below are relative to this legal folder. Preserve all upstream notices.
Deliver the complete sources directory beside each installer as well as retaining
its installed copy, with equivalent recipient access. No written source offer is
substituted for the supplied materials.

- Saxon-HE 11.4: sources/saxon11-4source.zip, MPL-2.0. Extract and follow upstream
  instructions. SHA-256 7707309BCBC404775BAC4CB180BD81BF1F40E9512C1A440D9FFDFFAEB92558FB.
- Temurin 17.0.20.1+1: sources/temurin-17.0.20.1+1 contains matching upstream source
  parts, build/certificate scripts, Windows configuration and reconstruction
  instructions. Read README.md; GPLv2 with Classpath Exception plus component terms.
  Existing Microsoft redistribution interpretations remain unresolved; see the
  distribution-status record. No new clearance or violation is asserted.
- NewCM 8.1.1: sources/newcomputermodern-8.1.1.zip contains the complete Work,
  editable SFD sources and FontForge instructions. See sources/NEWCM-SOURCE.md and
  supplemental/newcm. GUST/LPPL and NewCM10-Regular GPLv3-or-later with Font and
  Distribution Exceptions are preserved; no blanket waiver is asserted.
- Canvas: sources/canvas-mpl supplies four matched MPL crate source archives;
  supplemental/canvas-native supplies identified native/transitive notices.
  Skia's permissive terms do not create a general corresponding-source obligation.
- NSIS: sources/nsis contains StdUtils 1.14 source, Nsis7z 19.00 and LZMA SDK19.00
  materials and build instructions. The installer uses the Deflate wrapper and
  existing core/System/nsDialogs/nsExec/UAC/StdUtils/Nsis7z components. WinShell
  is absent. No obsolete WinShell permission is required for this candidate.

Libertinus, DejaVu and all other retained font/component notices remain intact.
No matching-source claim includes rights to independently redistribute excluded
artwork or guide content. The approved branding policy distinguishes these rights.

## Preserved installer documentation

The accepted installer is not rebuilt for this checkpoint. Its installed source
instructions retain an older archive filename. The refreshed RELEASE-RECEIPT.json
and accompanying SOURCE-AVAILABILITY.md identify the matching delivery set and
supersede that filename. Supply both alongside the installer; do not substitute
the older archive. The third-party ZIP preserves installed legal resources exactly
and includes a separate current recipient-documentation supplement.
