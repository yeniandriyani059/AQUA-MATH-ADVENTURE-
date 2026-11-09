# Dashboard student status: historical results, not live activity

## Audit

The previous getStudentStatus combined SOLO and Championship scores/locations.
A positive score or any stored location returned `playing`; zero history returned
`joined`. The list said Bermain/Bergabung, the detail said Sedang Bermain/Baru
Bergabung, and the summary claimed AKTIF BERMAIN. These were inferences from
assessment history, not observations of current play. No presence subscription,
heartbeat, active-mission lease or last-seen protocol is implemented in the app.
An existing account's is_active flag is account availability, not online status.
Championship OPEN and participant PLAYING are durable DB state, not live presence.

## Changes

- studentHistoryStatus.ts derives read-only history labels. Empty results =>
  Belum Ada Hasil; any historical result (including a zero-score completed mission)
  => Pernah Bermain; ten distinct completed locations => Selesai 10 Misi.
- SOLO uses only SOLO progress. Timestamps, account-active flags, another mode's
  totals and stale completed-level arrays cannot establish current play or ten
  completed locations.
- Championship uses existing authoritative session/participant/attempt data,
  filtering owner, selected session and explicit Championship mode. Old-session,
  SOLO and other-student attempts cannot determine its completion.
- Unknown Championship data => Belum Terverifikasi; no official session => Belum
  Ada Sesi; missing participant => Belum Terdaftar. These are distinct from an
  enrolled participant with no results. A persistent PLAYING flag is historical
  evidence only and never produces a live-playing badge.
- A small history-mode selector scopes summary counts, status/level filters and
  list score/level context. Both modes have separately labeled badges in details.
  The Pernah Bermain count/filter includes students who completed all ten missions.
- No Sedang Bermain, Bermain, Baru Bergabung or AKTIF BERMAIN presence claim is
  generated. A note states that history is not current activity. The class average
  label explicitly identifies Championship; its numeric calculation is unchanged.

This does not implement real-time features, new Supabase queries, a new season,
new RPCs, schema or policies. Existing Dashboard polling remains result refresh,
not presence detection. Assessment records, scores, progress, login, game logic,
3D assets and all SQL/Game Season work are untouched. New labels become live only
after a separately approved release; this work does not update the candidate.

## Local verification

- 118 Node tests passed (111 existing + 7 historical-status regressions).
- TypeScript and production build passed; existing Vite config/chunk-size warnings
  remain. No dependency/configuration change.
- Local browser tests use intercepted synthetic Supabase responses and block all
  actual remote traffic. Two synthetic SOLO students remain at scores 80/60 while
  showing historical activity; a registered Championship participant with no
  results stays distinct from SOLO. Mode filters count the correct group.
- Read-only Dashboard regression still covers polling, failed reads, stale cache,
  old offline queue preservation and desktop/mobile layouts. Missing Championship
  verification never becomes a false no-result or live-playing claim.
- No production DB read/write, reset, migration, push, merge or deployment.
  No actual score/progress of Afina or Afiz was altered or used as test data.
