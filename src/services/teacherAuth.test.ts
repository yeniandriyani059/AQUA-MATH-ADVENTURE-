import test from 'node:test';
import assert from 'node:assert/strict';
import { isVerifiedTeacherAuthUser } from './supabaseService';

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
