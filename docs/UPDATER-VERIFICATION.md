# Official repository updater verification

PageHearth remains 0.1.2; Electron remains 44.11.1. Only the update endpoint, release URL allowlist, repository metadata, tests and packaging/verification support changed. No project schema, settings migration, installer lifecycle or publishing change.

59 focused updater/service tests PASS. Both TypeScript checks and production build PASS. 11 WinShell adapter checks PASS. NSIS packaging PASS; installer and embedded uninstaller payload lists contain no WinShell. Packaged modules pass synthetic v1.0.0 discovery from 0.1.2, Download destination, rejection and HTTP 404/service-state tests. The build verifies all 316 original Temurin files.

Native GUI smoke was attempted using isolated synthetic project/profile state. Playwright Electron control failed with an assertion; a direct CDP attempt failed with ECONNRESET. Neither establishes a native acceptance pass. Disposable test processes were closed. Installed reinstall/upgrade, actual browser opening and manuscript/settings save-reopen remain manual acceptance requirements. Existing native acceptance applies to the prior candidate only. Both installers report 0.1.2, so a native replacement is a same-version reinstall, not proof of a 1.0.0 upgrade.

Installer SHA-256: 542373E3F3FE0BA9351D350005F86F08E8EE1F214905B314524437C1FC8967A7. Prior accepted artifacts remain preserved. Repository and release remain private/draft; Microsoft conditions remain pending.
