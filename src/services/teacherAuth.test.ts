import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStudentProfileInsertPayload,
  generateStudentUuid,
  isValidUuid,
  isVerifiedTeacherAuthUser,
  mapCharacterIdToDbCharacter,
  mapDbCharacterToCharacterId,
  mapDbRowToStudentProfile,
} from './supabaseService';

test('isVerifiedTeacherAuthUser rejects null, undefined, or missing id', () => {
  assert.equal(isVerifiedTeacherAuthUser(null), false);
  assert.equal(isVerifiedTeacherAuthUser(undefined), false);
  assert.equal(isVerifiedTeacherAuthUser({ email: 'guru@sekolah.id' }), false);
  assert.equal(isVerifiedTeacherAuthUser({ id: '', email: 'guru@sekolah.id' }), false);
});

test('isVerifiedTeacherAuthUser strictly rejects anonymous student sessions', () => {
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
      id: 'anon-789',
      email: '',
      is_anonymous: false,
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

test('buildStudentProfileInsertPayload produces only exact student_profiles columns and valid UUID', () => {
  const payload = buildStudentProfileInsertPayload({
    displayName: '  Ahmad   Rizky  ',
    characterId: 'bima',
  });

  const keys = Object.keys(payload).sort();
  assert.deepEqual(keys, [
    'auth_user_id',
    'character',
    'created_at',
    'display_name',
    'id',
    'is_active',
  ]);
  assert.equal('character_id' in payload, false);
  assert.equal('name' in payload, false);
  assert.equal('username' in payload, false);
  assert.equal('normalized_name' in payload, false);
  assert.equal('solo_data' in payload, false);
  assert.equal('last_active_at' in payload, false);

  assert.equal(isValidUuid(payload.id), true);
  assert.equal(payload.auth_user_id, null);
  assert.equal(payload.display_name, 'Ahmad Rizky');
  assert.equal(payload.character, 'BIMA');
  assert.equal(payload.is_active, true);
});

test('mapDbRowToStudentProfile maps Supabase student_profiles row to StudentProfile', () => {
  const uid = generateStudentUuid();
  const profile = mapDbRowToStudentProfile({
    id: uid,
    auth_user_id: null,
    display_name: 'Siti Aminah',
    character: 'SINTA',
    is_active: true,
    created_at: '2026-11-06T00:00:00.000Z',
  });

  assert.equal(profile.id, uid);
  assert.equal(profile.name, 'Siti Aminah');
  assert.equal(profile.characterId, 'sinta');
  assert.equal(profile.solo.unlockedLevel, 1);
  assert.equal(profile.championship.unlockedLevel, 1);
});

