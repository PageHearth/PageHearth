# Offline EPUB validation runtime

PageHearth targets EPUB 3.3. EPUBCheck 5.3.0 is the baseline validator; 5.4.0 is an additional forward-compatibility check, not a change of production target.

- EPUBCheck: https://github.com/w3c/epubcheck/releases/tag/v5.3.0 and https://github.com/w3c/epubcheck/releases/tag/v5.4.0
- Original distribution licenses are retained in each validator directory (LICENSE.txt, THIRD-PARTY.txt, licenses/).
- Java: Eclipse Temurin JRE 17.0.20.1+1, Windows x64. Distribution release metadata and complete legal notices are retained under java/. OpenJDK is distributed under GPLv2 with the Classpath Exception; individual third-party components have their own notices.
- Corresponding source: https://github.com/adoptium/jdk17u (the exact source revision is recorded in java/release: 79597447bd94); build tooling https://github.com/adoptium/temurin-build at e6ba7dec3d07654074559310376a3ae89da5f4ac.

These are copies of the offline renderer-feasibility gate distributions. runtime.json records the SHA-256 of every bundled file. The application invokes the bundled Java executable with an absolute path, without a shell or user Java configuration. No system Java installation is needed. The validators and Java run as separate processes; they are not linked into the renderer.

Distribution/legal source-offer review remains required before a public release. This development candidate is not a statement of retailer or accessibility certification.
