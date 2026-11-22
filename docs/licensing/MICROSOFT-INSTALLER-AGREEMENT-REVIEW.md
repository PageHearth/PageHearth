# Microsoft-only installer agreement: final text for approval

The exact text shown by NSIS is `assets/licenses/microsoft/MICROSOFT_RUNTIME_AGREEMENT.txt`.
It is supplied unchanged in the installed offline legal folder under
`supplemental/microsoft`, alongside the component notice. About's existing local
license link opens an index with direct links to both. the developer's approval of the
final wording and native installer retest remain pending.

This is a scoped downstream agreement with the developer, not a claim to speak
for Microsoft or a replacement license for PageHearth's MPL-covered source.
Protection covers permitted use, ownership/notices, modification/reverse-engineering
limits with mandatory-rights exceptions, standalone redistribution limits, export
controls, onward-distribution conditions, Microsoft warranty/liability protections
and regional consumer rights. Distributor obligations are not transferred to
ordinary users. Official VS2026 and Windows SDK texts were consulted only for
this scoped wording. No legal certification or new provenance conclusion is made.

## Installer implementation

Electron-builder's `nsis.license` supplies the standard MUI license page:
I Agree continues, Cancel declines and exits. Existing custom welcome, directory,
shortcut and finish pages remain. An exact-version/hash-checked adaptation removes
only the license page's `--updated` skip; the directory skip remains unchanged.
`customInit` switches silent invocations to interactive mode so `/S` cannot bypass
the terms. Uninstaller construction and operation do not use that installer hook.
No acceptance registry, account, network request or remote consent log is added.

## Verification and limitations

Build and both TypeScript checks PASS. 61 focused license/updater tests and 11
existing WinShell-adapter checks PASS. Focused license wiring, template drift,
updated/silent bypass and scope checks PASS. Application payload stays identical
to the accepted updater candidate; all 415 runtime entries, including 316 JRE
files, are verified. Publishing behavior is not modified.

Native UI attempt: installer welcome accessibility was observed, but the computer
control screenshot showed unrelated foreground content. Interaction stopped;
only the exact replacement installer process was closed. No Agree/Decline or
installation PASS is claimed. the developer must verify those actions in disposable Windows.
Earlier 5/5 native acceptance belongs to the previous updater candidate only.

Retest: decline and confirm installation stops; rerun, read and agree; confirm
normal installation/launch and offline agreement access; same-version reinstall,
project save/reopen and update preferences; PDF/EPUB smoke checks as practical.
Use a disposable guest for `/S` or `--updated` checks: both must still expose
the license choice. No genuine cross-version upgrade is claimed.

Existing VC provenance uncertainty remains recorded, not treated as a proven
prohibition. This change addresses recipient presentation and acceptance only.
Private draft, no publication until text approval and native review.
