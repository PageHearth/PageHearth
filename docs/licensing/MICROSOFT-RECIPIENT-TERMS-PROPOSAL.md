# Microsoft-only recipient terms — PROPOSAL, NOT APPROVED

Current installer-review supplement (November 21, 2026): the replacement Beta 1
candidate now presents `supplemental/microsoft/MICROSOFT_RUNTIME_AGREEMENT.txt`
using a standard NSIS license page. Its final wording awaits the developer's approval.
The earlier outline and delivery recommendation below are retained as historical
evidence, not the current implementation plan. No individual agreement database,
external consent system or individualized Microsoft permission is required by
this implementation. The existing VC entitlement uncertainty is not a demonstrated
prohibition and this candidate does not claim definitive legal certification.

Distribution permission: BLOCKED pending narrowly targeted licensing clarification.
This informational proposal is not an executed agreement or an assertion that
the owner has accepted Microsoft terms. Do not distribute this internal candidate.

## Confirmed and unresolved facts

The developer's Visual Studio Community 2026 individual eligibility is recorded in the retained review. The bundled
Temurin JRE contains three VC 14.40 DLLs (msvcp140.dll, vcruntime140.dll,
vcruntime140_1.dll) and sixteen application-local UCRT files (ucrtbase.dll and
api-ms-win-crt-* DLLs). They remain unmodified. Windows using its system UCRT
does not remove the conditions on redistributing these application-local copies.

The official 2026 REDIST list covers licensed Visual Studio redist files and
linked redistributable downloads. It does not, on the evidence reviewed, settle
the entitlement chain for the retained Adoptium VC 14.40 copies. The SDK REDIST
list covers the UCRT filenames, subject to its license. Confirm the applicable
SDK agreement and obtain targeted professional licensing clarification of these
exact copies; do not repeat Java provenance or build investigations.

## Specific approval required

Visual Studio Community 2026 section 4 and Windows SDK section 2(a) require
protective agreements from downstream distributors and external end users.
The SDK also places copyright-notice and indemnification obligations on the
distributor. These are not automatically accepted by installing PageHearth,
by possessing a product key, or by reading a notice.

Proposed recipient scope, subject to qualified review and the developer's approval:

- Apply the approved Microsoft component terms only to the identified Microsoft
  runtime binaries, not PageHearth MPL code, Java GPL code, fonts or other libraries.
- Preserve Microsoft copyright, patent and trademark notices; no Microsoft
  endorsement is implied. Do not modify or relicense the Microsoft binaries.
- Use the supplied runtime as part of PageHearth on Windows. Any onward
  distribution must satisfy the applicable Microsoft redistribution conditions
  and require the same protective agreement from recipients.
- Preserve applicable statutory rights and each separately licensed component's
  rights. Do not extend Microsoft restrictions to open-source application code.

These bullets are a drafting outline, NOT a representation that every required
protection has been captured. Final terms must be checked against the actual
applicable agreements, including their limitations and jurisdictional exceptions.
the developer must separately review any distributor indemnity/defense undertaking.

Recommended delivery: after entitlement and wording are settled, present the
approved Microsoft-only addendum and linked/full applicable texts before granting
beta download access, with explicit recorded recipient agreement and a downloadable
copy. Include the same approved text with the installer/source receipt. Do not
rely on an informational README as assent. No installer redesign or agreement
collection has been implemented. the developer must approve wording and delivery mechanism.

## Official sources reviewed

- https://visualstudio.microsoft.com/license-terms/vs2026-ga-community/
- https://visualstudio.microsoft.com/wp-content/uploads/2025/10/Visual_Studio_2026-License-Community_ENU.docx
- https://learn.microsoft.com/en-us/visualstudio/releases/2026/redistribution
- https://learn.microsoft.com/en-us/legal/windows-sdk/license (section 2(a))
- https://learn.microsoft.com/en-us/legal/windows-sdk/redist

Narrow question for professional review: does the owner's licensed VS Community
2026/tooling or an applicable onward grant authorize the exact unmodified VC
14.40.33807 binaries in Temurin 17.0.20.1+1, and which SDK/recipient agreement
must accompany its UCRT 10.0.26100.1742 copies? Confirm the protective addendum
and distributor conditions; no broad dependency opinion is requested.
