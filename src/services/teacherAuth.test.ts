import test from 'node:test';
import assert from 'node:assert/strict';
import {
  acquireIsolatedAnonymousAuthSession,
  applySupabaseAttemptsAndProgressToProfile,
  buildStudentProfileInsertPayload,
  buildTeacherProfilePayload,
  executeResetStudentScoresAndProgress,
  exportResetGameDataBackup,
  findOfficialStudentSpec,
  formatStudentInsertError,
  generateStudentUuid,
  getResetGameDataPreview,
  isValidUuid,
  isVerifiedTeacherAuthUser,
  mapCharacterIdToDbCharacter,
  mapDbCharacterToCharacterId,
  mapDbRowToStudentProfile,
  normalizeStudentUsername,
  OFFICIAL_14_STUDENTS,
  studentUsernameToInternalEmail,
} from './supabaseService';

test('isVerifiedTeacherAuthUser rejects null, undefined, or missing id', () => {
  assert.equal(isVerifiedTeacherAuthUser(null), false);
  assert.equal(isVerifiedTeacherAuthUser(undefined), false);
  assert.equal(isVerifiedTeacherAuthUser({ email: 'guru@sekolah.id' }), false);
  assert.equal(isVerifiedTeacherAuthUser({ id: '', email: 'guru@sekolah.id' }), false);
});

test('isVerifiedTeacherAuthUser strictly rejects anonymous and student sessions', () => {
  assert.equal(
    isVerifiedTeacherAuthUser({
      id: 'anon-123',
      email: 'guru@sekolah.id',
      is_anonymous: true,
    }),
    false,
  );
  assert.equal(
    isVerifiedTeacherAuthUser({
      id: 'anon-456',
      email: 'guru@sekolah.id',
      app_metadata: { provider: 'anonymous' },
    }),
    false,
  );
  assert.equal(
    isVerifiedTeacherAuthUser({
      id: 'cae44b10-9331-4e44-bc28-7e737a62a49c',
      email: 'afina01@student.aquamath.id',
      is_anonymous: false,
    }),
    false,
  );
  assert.equal(
    isVerifiedTeacherAuthUser({
      id: 'cae44b10-9331-4e44-bc28-7e737a62a49c',
      email: 'siswa@sekolah.id',
      user_metadata: { role: 'student' },
    }),
    false,
  );
});

test('isVerifiedTeacherAuthUser accepts verified non-anonymous teacher user with valid email', () => {
  assert.equal(
    isVerifiedTeacherAuthUser({
      id: 'dc3feaf-09e3-47eb-9273-5f3b8591f05f',
      email: 'yeniandriyani059@gmail.com',
      is_anonymous: false,
      app_metadata: { provider: 'email' },
    }),
    true,
  );
});

test('OFFICIAL_14_STUDENTS contains all 14 Class 5 accounts with valid Auth UUIDs and characters', () => {
  assert.equal(OFFICIAL_14_STUDENTS.length, 14);

  const usernames = new Set<string>();
  const authIds = new Set<string>();

  for (const spec of OFFICIAL_14_STUDENTS) {
    assert.equal(isValidUuid(spec.authUserId), true);
    assert.equal(spec.character === 'BIMA' || spec.character === 'SINTA', true);
    assert.equal(
      studentUsernameToInternalEmail(spec.username),
      `${spec.username}@student.aquamath.id`,
    );
    usernames.add(spec.username);
    authIds.add(spec.authUserId);
  }

  assert.equal(usernames.size, 14);
  assert.equal(authIds.size, 14);

  const afina = findOfficialStudentSpec({ username: 'afina01' });
  assert.equal(afina?.displayName, 'Afina Felisia Putri');
  assert.equal(afina?.character, 'SINTA');
  assert.equal(afina?.authUserId, 'cae44b10-9331-4e44-bc28-7e737a62a49c');

  const afiz = findOfficialStudentSpec({ username: 'afiz02' });
  assert.equal(afiz?.displayName, 'Afiz El Haddadi');
  assert.equal(afiz?.character, 'BIMA');
  assert.equal(afiz?.authUserId, 'be935b72-73a2-4429-955e-965168bed5ce');

  const tiwi = findOfficialStudentSpec({ username: 'tiwi14' });
  assert.equal(tiwi?.displayName, 'Tiwi Safitri');
  assert.equal(tiwi?.character, 'SINTA');
  assert.equal(tiwi?.authUserId, '261109d3-2fa2-4cb1-94f1-953c540738a5');
});

test('normalizeStudentUsername and studentUsernameToInternalEmail map consistently', () => {
  assert.equal(normalizeStudentUsername('  Afina01  '), 'afina01');
  assert.equal(normalizeStudentUsername('afina01@student.aquamath.id'), 'afina01');
  assert.equal(studentUsernameToInternalEmail('Afina01'), 'afina01@student.aquamath.id');
});

test('character mapping between frontend CharacterId and Supabase student_profiles.character is accurate', () => {
  assert.equal(mapCharacterIdToDbCharacter('bima'), 'BIMA');
  assert.equal(mapCharacterIdToDbCharacter('BIMA'), 'BIMA');
  assert.equal(mapCharacterIdToDbCharacter('sinta'), 'SINTA');
  assert.equal(mapCharacterIdToDbCharacter('SINTA'), 'SINTA');
  assert.equal(mapCharacterIdToDbCharacter(undefined), 'SINTA');

  assert.equal(mapDbCharacterToCharacterId('BIMA'), 'bima');
  assert.equal(mapDbCharacterToCharacterId('bima'), 'bima');
  assert.equal(mapDbCharacterToCharacterId('SINTA'), 'sinta');
  assert.equal(mapDbCharacterToCharacterId('sinta'), 'sinta');
  assert.equal(mapDbCharacterToCharacterId(null), 'sinta');
});

test('buildStudentProfileInsertPayload omits id and created_at for DB defaults and requires real auth_user_id UUID', () => {
  const realAuthUid = 'be935b72-73a2-4429-955e-965168bed5ce';
  const payload = buildStudentProfileInsertPayload({
    authUserId: realAuthUid,
    displayName: '  Afiz   El Haddadi  ',
    characterId: 'bima',
  });

  const keys = Object.keys(payload).sort();
  assert.deepEqual(keys, ['auth_user_id', 'character', 'display_name', 'is_active']);
  assert.equal('id' in payload, false);
  assert.equal('created_at' in payload, false);
  assert.equal('character_id' in payload, false);
  assert.equal('name' in payload, false);
  assert.equal('username' in payload, false);

  assert.equal(payload.auth_user_id, realAuthUid);
  assert.equal(payload.display_name, 'Afiz El Haddadi');
  assert.equal(payload.character, 'BIMA');
  assert.equal(payload.is_active, true);

  assert.throws(() =>
    buildStudentProfileInsertPayload({
      authUserId: '',
      displayName: 'Invalid Student',
    }),
  );
});

test('buildTeacherProfilePayload uses valid UUID for both id and auth_user_id and role=teacher (never tch_ prefix)', () => {
  const teacherAuthUid = generateStudentUuid();
  const payload = buildTeacherProfilePayload({
    authUserId: teacherAuthUid,
    displayName: 'Ibu Yeni Andriyani',
  });

  assert.equal(isValidUuid(payload.id), true);
  assert.equal(payload.id.startsWith('tch_'), false);
  assert.equal(payload.id, teacherAuthUid);
  assert.equal(payload.auth_user_id, teacherAuthUid);
  assert.equal(payload.display_name, 'Ibu Yeni Andriyani');
  assert.equal(payload.role, 'teacher');
});

test('acquireIsolatedAnonymousAuthSession never creates temporary anonymous sessions to bypass RLS', async () => {
  const res = await acquireIsolatedAnonymousAuthSession();
  assert.equal(res.authUserId, null);
  assert.equal(res.ephemeralClient, null);
});

test('formatStudentInsertError produces clear Indonesian diagnostic for 42501 RLS errors', () => {
  const msg = formatStudentInsertError({
    code: '42501',
    message: 'new row violates row-level security policy for table "student_profiles"',
  });
  assert.equal(msg.includes('Row-Level Security (RLS)'), true);
  assert.equal(msg.includes('jangan memperluas RLS'), true);
  assert.equal(msg.includes('Jalankan SQL'), false);
});

test('mapDbRowToStudentProfile maps Supabase student_profiles row to StudentProfile with official username', () => {
  const profile = mapDbRowToStudentProfile({
    id: 'cae44b10-9331-4e44-bc28-7e737a62a49c',
    auth_user_id: 'cae44b10-9331-4e44-bc28-7e737a62a49c',
    display_name: 'Afina Felisia Putri',
    character: 'SINTA',
    is_active: true,
    created_at: '2026-11-06T00:00:00.000Z',
  });

  assert.equal(profile.id, 'cae44b10-9331-4e44-bc28-7e737a62a49c');
  assert.equal(profile.authUserId, 'cae44b10-9331-4e44-bc28-7e737a62a49c');
  assert.equal(profile.name, 'Afina Felisia Putri');
  assert.equal(profile.username, 'afina01');
  assert.equal(profile.characterId, 'sinta');
  assert.equal(profile.solo.unlockedLevel, 1);
  assert.equal(profile.championship.unlockedLevel, 1);
});

test('applySupabaseAttemptsAndProgressToProfile hydrates student scores and unlocked levels strictly from game_attempts and game_progress', () => {
  const suciBase = mapDbRowToStudentProfile({
    id: '87592235-ebb6-4244-9460-e5d421ad8632',
    auth_user_id: 'b063ade8-5267-4c36-88fb-5b485f54c228',
    display_name: 'Suci Mulia Sari',
    character: 'SINTA',
    is_active: true,
    created_at: '2026-11-06T16:00:36.40897+00:00',
  });

  // When game_attempts and game_progress are empty, scores must be 0
  const emptyHydrated = applySupabaseAttemptsAndProgressToProfile(suciBase, [], []);
  assert.equal(emptyHydrated.solo.bestTotalScore, 0);
  assert.equal(emptyHydrated.championship.totalChampionshipScore, 0);
  assert.equal(Object.keys(emptyHydrated.solo.locations).length, 0);

  // When game_attempts and game_progress have rows, scores and unlocked levels match DB
  const hydrated = applySupabaseAttemptsAndProgressToProfile(
    suciBase,
    [
      {
        id: '1ec31aa8-bd77-4e3f-8ddb-24636a99dbf3',
        student_id: '87592235-ebb6-4244-9460-e5d421ad8632',
        mode: 'SOLO',
        level_number: 1,
        location_id: '1',
        correct_count: 3,
        wrong_count: 7,
        score: 30,
        duration_seconds: 45,
        completed_at: '2026-11-06T16:14:31.7614+00:00',
      },
      {
        id: '75bdf10a-d53a-4276-a11c-6026558039ea',
        student_id: '87592235-ebb6-4244-9460-e5d421ad8632',
        mode: 'SOLO',
        level_number: 1,
        location_id: '2',
        correct_count: 8,
        wrong_count: 2,
        score: 80,
        duration_seconds: 52,
        completed_at: '2026-11-06T16:20:18.233624+00:00',
      },
    ],
    [
      {
        id: '1d10ba86-afa7-4c19-b2c7-9b3a69865d7e',
        student_id: '87592235-ebb6-4244-9460-e5d421ad8632',
        mode: 'SOLO',
        unlocked_level: 2,
        last_level: 1,
        last_location: '2',
        completed_locations: ['1', '2'],
      },
    ],
  );

  assert.equal(hydrated.id, '87592235-ebb6-4244-9460-e5d421ad8632');
  assert.equal(hydrated.solo.bestTotalScore, 110);
  assert.equal(hydrated.solo.latestTotalScore, 110);
  assert.equal(hydrated.solo.unlockedLevel, 2);
  assert.equal(hydrated.solo.locations[1]?.bestScore, 30);
  assert.equal(hydrated.solo.locations[2]?.bestScore, 80);
  assert.equal(hydrated.championship.totalChampionshipScore, 0);
});

test('reset preview requires teacher session and destructive execution remains unavailable', async () => {
  const preview = await getResetGameDataPreview({ studentId: 'ALL', modeScope: 'ALL' });
  assert.equal(preview.ok, false);
  assert.match(preview.message || '', /Sesi.*guru/i);

  const backup = await exportResetGameDataBackup({ studentId: 'ALL', modeScope: 'ALL' });
  assert.equal(backup.ok, true);
  assert.ok(backup.backupJson);
  assert.ok(backup.fileName?.includes('AQUA_MATH_BACKUP'));

  const reset = await executeResetStudentScoresAndProgress({ studentId: 'ALL', modeScope: 'ALL' });
  assert.equal(reset.ok, false);
  assert.match(reset.message || '', /dinonaktifkan/i);
});

