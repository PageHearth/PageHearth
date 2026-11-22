# PageHearth

PageHearth is a free, open-source, local-first writing and publishing application. This source snapshot corresponds to PageHearth 0.1.2 Beta 1, including manuscript organization, Print Preview, PDF and EPUB publishing.

Original application source is licensed under MPL-2.0. Copyright © 2026 PixelFF. PixelFF is the developer's personal brand, not a separate company. See [LICENSE](LICENSE), [LICENSING.md](LICENSING.md), and the [approved branding policy](docs/licensing/BRANDING-POLICY-DRAFT.md). Third-party components retain their own terms.

## Source and builds

This is a curated snapshot, with the official-repository updater correction, based on accepted development revision `736e6a7cd818c13a13000c972abb15d9e0073059`, without development Git history. A new repository commit will have a different identity. File correspondence is recorded in `SOURCE-MANIFEST.json`; this README is repository preparation documentation added afterward.

Read [SOURCE-PACKAGE-README.md](SOURCE-PACKAGE-README.md) for build prerequisites and resource exclusions. Node 24 and npm are required. After providing the documented, separately authorized resources, use `npm ci` and `npm run build`. The source package excludes artwork, runtime binaries and generated guides; it is not a complete branded installer rebuild kit. Do not assume the default packaging command reproduces the accepted WinShell-free installer: follow the supplied packaging documentation and adapter.

## Beta testing

Use copies or disposable projects initially, maintain independent backups, and wait for Saved before closing. Report reproducible issues using synthetic examples, Windows version and expected/actual behavior. Do not upload private manuscripts, credentials or unsanitized logs.

The updated Beta 1 checks https://api.github.com/repos/PageHearth/PageHearth/releases/latest for stable releases only. A future stable v1.0.0 is detected from installed 0.1.2; Download opens the official GitHub release page in the external browser. Drafts and prereleases are excluded. Before a stable release exists, a GitHub 404 is shown as no published release. There are no automatic installer downloads or installation and no website dependency.

Publication is pending final review. See the accompanying release notes for exact installer/source filenames and hashes. Existing review-status statements and unresolved recipient-term records are not replaced by a claim of legal clearance.
