# PageHearth 0.1.2 Windows beta — instructions draft

Not a release authorization. Final download locations, checksums and system
requirements must accompany the approved candidate before these instructions
are supplied to testers.

## Install and start

Use the Windows installer supplied directly with the approved beta invitation.
Compare its SHA-256 with the release receipt. Do not use an older internal
candidate. Choose an installation location, finish setup and open PageHearth.
This internal candidate targets Windows x64. Native installer acceptance used Windows 11 Sandbox; wider Windows coverage is not claimed. Java/EPUBCheck and Typst are bundled; no separate Java or Visual C++ installation is required by this restored self-contained package.
Do not bypass a Windows security warning without verifying the source with us.

The Quick Start Guide is in the PageHearth Start menu folder. Use disposable
projects or copies of your work for initial testing. Keep an independent backup
outside the beta installation before opening valuable manuscripts.

## Save, backup and restore

Wait for Saved before closing. Select a backup location explicitly in Project
protection and verify a backup succeeds. Test Restore Backup from ZIP on a copy,
into a separate location; do not overwrite your only working project. Save is
not a replacement for an independent backup. Copies/restored projects can require
renewed permission for external backup destinations and Research files.

## Local data and network activity

Project files are stored in the location you select. Local application settings
and temporary publishing files also exist outside the project. GitHub and
authorized PageHearth update/release requests are legitimate network activity;
choosing an external link opens your browser. Do not interpret local-first as a
claim that the application never uses the network.

Publishing can create temporary files containing manuscript text. Owned temporary
sessions have lifecycle cleanup; forced termination can leave content until later
cleanup. Intentional exports remain where you saved them. Do not promise secure
erasure or instant cleanup after every crash. Isolated network and active-validator
termination verification still have documented limits; this beta is not a privacy
certification. Avoid sensitive manuscripts during initial testing.

## Known limitations

- EPUB font support varies by reader. Kindle showed a missing-glyph rectangle for
  U+2728 (sparkles) in testing despite preservation of the character; the tested
  PDF displayed it. This is not a confirmed EPUB corruption defect.
- The separately bundled Libertinus Serif EPUB resource is the Regular face;
  authentic bold/italic faces are not implied.
- Restore native acceptance recorded three passing groups; missing-folder fallback
  and valid/invalid ZIP scenarios were skipped in that native retest. Automated
  evidence does not replace those skipped native observations.

## Report a bug

Use https://github.com/PageHearth/PageHearth/issues when tester access is granted. Include
PageHearth version, Windows version, steps, expected/actual behavior and whether
the issue repeats in a disposable project. Prefer a short synthetic example.
Do not send personal manuscripts, backup archives or unsanitized logs. Review
screenshots for private names, text and filesystem paths before sharing.

## License and source

Original PageHearth application code is MPL-2.0. Public attribution is
Copyright © 2026 PixelFF; PixelFF is the developer's personal brand, not a separate
company. Branding and third-party components have separate terms.

The approved distribution must include a matching PageHearth source ZIP alongside
each installer, a receipt identifying the revision and hashes, and instructions
for applicable third-party source materials. Consult the bundled legal notices.
Do not substitute the old internal source archive for the matching release source.

Internal review limitations: cross-version upgrades, populated Jump Lists, shortcut relocation and all-users installation remain unverified. Same-version installer lifecycle is Hush-reported PASS. Microsoft-only recipient terms remain a proposal, not an accepted agreement; no external beta may be distributed yet.

Internal verification note (2026-11-21): Typst uses the bundled Java runtime
directory through its child-process PATH on Windows. No separate Visual C++
installation or system PATH change is required. Hush reported all five focused native acceptance groups PASS for the replacement
internal candidate. Distribution still requires separate approval.

Beta 1 still checks ThatsHush/StoryLoom for stable updates and does not discover
prereleases or updates in the new application repository. Check the new repository
release page manually. The original development repository is not the beta delivery
endpoint; no update-routing change or rebuild is part of this preparation.
