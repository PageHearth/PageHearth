# Native canvas 1.0.11 materials

The upstream sbom.cdx.json identifies skia.win32-x64-msvc.node with SHA-256
4296AB1F770556C55077B44929F684EF180065EBEFFDFFCA7EB3A29E8FF715A6.
These materials use that producer component list, not compiler-level attestation.

LICENSE is canvas MIT; ../skia/LICENSE is Skia BSD. skia-dependencies contains
exact-revision notices for twelve identified native dependencies. This software
is based in part on the work of the Independent JPEG Group. Portions use the
FreeType Project, copyright 1996-2002, 2006, David Turner, Robert Wilhelm and
Werner Lemberg; all rights reserved.

rust contains notices from 93 hash-matched crate archives, conservatively including
listed build/platform dependencies. rust-workspace supplies the seven omitted
workspace MIT notices at the exact crate source commits. This does not assert
that every listed crate is Windows runtime code.

Matching source for cssparser 0.38.0, cssparser-color 0.6.0, cssparser-macros 0.7.0
and dtoa-short 0.3.5 is provided under sources/canvas-mpl. Extract .crate archives
as gzip tar files. Preserve their MPL notices and supply the archives with the
binary. No changes made. Permissive components have no invented blanket source
requirement. Existing patent terms/license alternatives remain in upstream texts.
