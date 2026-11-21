# PageHearth

PageHearth is a free, open-source, local-first writing and publishing application. This source snapshot corresponds to PageHearth 0.1.2 Beta 1, including manuscript organization, Print Preview, PDF and EPUB publishing.

Original application source is licensed under MPL-2.0. Copyright © 2026 PixelFF. PixelFF is the developer's personal brand, not a separate company. See [LICENSE](LICENSE), [LICENSING.md](LICENSING.md), and the [approved branding policy](docs/licensing/BRANDING-POLICY-DRAFT.md). Third-party components retain their own terms.

## Source and builds

This is a curated snapshot of accepted development revision `736e6a7cd818c13a13000c972abb15d9e0073059`, without development Git history. A new repository commit will have a different identity. File correspondence is recorded in `SOURCE-MANIFEST.json`; this README is repository preparation documentation added afterward.

Read [SOURCE-PACKAGE-README.md](SOURCE-PACKAGE-README.md) for build prerequisites and resource exclusions. Node 24 and npm are required. After providing the documented, separately authorized resources, use `npm ci` and `npm run build`. The source package excludes artwork, runtime binaries and generated guides; it is not a complete branded installer rebuild kit. Do not assume the default packaging command reproduces the accepted WinShell-free installer: follow the supplied packaging documentation and adapter.

## Beta testing

Use copies or disposable projects initially, maintain independent backups, and wait for Saved before closing. Report reproducible issues using synthetic examples, Windows version and expected/actual behavior. Do not upload private manuscripts, credentials or unsanitized logs.

The accepted Beta 1 application still checks the legacy development repository for stable releases. It does not discover releases from this new repository or prerelease tags. Check this repository's release page manually for subsequent beta downloads. No application update-routing change is included in this snapshot.

Publication is pending final review. See the accompanying release notes for exact installer/source filenames and hashes. Existing review-status statements and unresolved recipient-term records are not replaced by a claim of legal clearance.
