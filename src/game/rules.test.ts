import test from 'node:test';
import assert from 'node:assert/strict';
import { QUESTIONS_BANK, getQuestionsByLocation } from '../data/questions';
import { LEVELS, MISSION_LOCATIONS } from '../data/locations';
import {
  applyMissionResultToProfile,
  buildChampionshipLeaderboard,
  calculateAdventureAcademicGrade,
  computeLevelUnlockState,
  createEmptyStudentProfile,
  getLevelChampion,
} from './rules';
import { OptionLetter } from '../types/game';

test('Question bank has 100 unique contextual questions with valid competencies, distinct options, and all 10 LKPD anchor problems', () => {
  assert.equal(QUESTIONS_BANK.length, 100, 'Total questions must be 100');
  assert.equal(MISSION_LOCATIONS.length, 10, 'Total locations must be 10');
  assert.equal(LEVELS.length, 5, 'Total levels must be 5');

  const ids = new Set<string>();
  const texts = new Set<string>();

  for (let locId = 1; locId <= 10; locId++) {
    const locQuestions = getQuestionsByLocation(locId);
    assert.equal(locQuestions.length, 10, `Location ${locId} must have 10 questions`);
    for (const q of locQuestions) {
      assert.equal(ids.has(q.id), false, `Duplicate question id: ${q.id}`);
      assert.equal(texts.has(q.questionText), false, `Duplicate question text: ${q.questionText}`);
      ids.add(q.id);
      texts.add(q.questionText);

      // Verify required fields
      assert.ok(q.competency && q.competency.length > 10, `Missing competency on ${q.id}`);
      assert.ok(
        ['Mudah', 'Sedang', 'Menantang', 'Sangat Menantang (Final Mission)'].includes(
          q.difficultyLevel,
        ),
        `Invalid difficultyLevel on ${q.id}`,
      );

      // Verify 4 choices A, B, C, D and no duplicate option values in a question
      const optVals = [q.options.A, q.options.B, q.options.C, q.options.D];
      assert.equal(optVals.every(Boolean), true, `Missing option on ${q.id}`);
      const uniqueOptVals = new Set(optVals);
      assert.equal(uniqueOptVals.size, 4, `Duplicate option values in ${q.id}: ${optVals.join(', ')}`);

      assert.ok(['A', 'B', 'C', 'D'].includes(q.correctOption));
      const correctVal = q.options[q.correctOption];
      assert.ok(
        q.explanation.includes(correctVal.split(' ')[0]),
        `Explanation for ${q.id} must mention the correct answer number (${correctVal})`,
      );
    }
  }

  // Verify the 10 mandatory LKPD reference problems in Location 10 (Level 5)
  const expectedLkpd = [
    { ref: '850 − 275 + 150 = 725 liter', answer: '725 liter' },
    { ref: '3 × 75 = 225 liter', answer: '225 liter' },
    { ref: '420 ÷ 6 = 70 liter', answer: '70 liter' },
    { ref: '(4 × 19) + (2 × 19) = 114 liter', answer: '114 liter' },
    { ref: '300 + 175 = 475 liter', answer: '475 liter' },
    { ref: '(720 − 420) ÷ 3 = 100 liter', answer: '100 liter' },
    { ref: '(85 × 5) + 400 = 825 liter', answer: '825 liter' },
    { ref: '950 − 325 − 275 = 350 liter', answer: '350 liter' },
    { ref: '560 − 230 − 185 = 145 liter', answer: '145 liter' },
    { ref: '500 + (120 × 3) = 860 liter', answer: '860 liter' },
  ];

  const loc10Questions = getQuestionsByLocation(10);
  expectedLkpd.forEach((item, idx) => {
    const q = loc10Questions[idx];
    assert.equal(q.lkpdReference, item.ref, `LKPD #${idx + 1} reference mismatch`);
    assert.equal(
      q.options[q.correctOption],
      item.answer,
      `LKPD #${idx + 1} correct option value must be ${item.answer}`,
    );
  });
});

test('Solo Adventure and Class Championship scores remain strictly separated', () => {
  let profile = createEmptyStudentProfile('stu_1', 'Rizky Pratama', 'bima');

  // Answer all 10 questions in Location 1 correctly in SOLO mode
  const loc1Questions = getQuestionsByLocation(1);
  const perfectLoc1Answers: Record<string, OptionLetter> = {};
  for (const q of loc1Questions) {
    perfectLoc1Answers[q.id] = q.correctOption;
  }

  const soloRun1 = applyMissionResultToProfile(profile, 'solo', 1, perfectLoc1Answers, 65);
  profile = soloRun1.updatedProfile;

  assert.equal(profile.solo.latestTotalScore, 100);
  assert.equal(profile.solo.bestTotalScore, 100);
  assert.equal(profile.solo.academicGrade, 10); // 100 / 10 = 10
  // Verify Championship score is still 0!
  assert.equal(profile.championship.totalChampionshipScore, 0);
  assert.equal(Object.keys(profile.championship.locations).length, 0);

  // Replay Location 1 in SOLO mode with only 6 correct answers -> latestScore becomes 60, bestScore stays 100
  const partialLoc1Answers: Record<string, OptionLetter> = {};
  loc1Questions.forEach((q, idx) => {
    partialLoc1Answers[q.id] = idx < 6 ? q.correctOption : (q.correctOption === 'A' ? 'B' : 'A');
  });

  const soloRun2 = applyMissionResultToProfile(profile, 'solo', 1, partialLoc1Answers, 50);
  profile = soloRun2.updatedProfile;

  assert.equal(profile.solo.locations[1].latestScore, 60);
  assert.equal(profile.solo.locations[1].bestScore, 100);
  assert.equal(profile.solo.latestTotalScore, 60);
  assert.equal(profile.solo.bestTotalScore, 100);

  // Now play Location 1 in CLASS CHAMPIONSHIP mode with 8 correct answers (80 points)
  const champLoc1Answers: Record<string, OptionLetter> = {};
  loc1Questions.forEach((q, idx) => {
    champLoc1Answers[q.id] = idx < 8 ? q.correctOption : (q.correctOption === 'A' ? 'B' : 'A');
  });

  const champRun = applyMissionResultToProfile(profile, 'championship', 1, champLoc1Answers, 70);
  profile = champRun.updatedProfile;

  assert.equal(profile.championship.totalChampionshipScore, 80);
  assert.equal(profile.championship.academicGrade, 8);
  // Solo scores must remain untouched
  assert.equal(profile.solo.latestTotalScore, 60);
  assert.equal(profile.solo.bestTotalScore, 100);
});

test('Level unlock progression requires both locations in a level to be completed', () => {
  const state0 = computeLevelUnlockState(new Set([]));
  assert.equal(state0.unlockedLevel, 1);
  assert.deepEqual(state0.completedLevels, []);

  // Only Location 1 done -> still Level 1 unlocked
  const state1 = computeLevelUnlockState(new Set([1]));
  assert.equal(state1.unlockedLevel, 1);
  assert.deepEqual(state1.completedLevels, []);

  // Both Location 1 and Location 2 done -> Level 1 completed, Level 2 unlocked!
  const state2 = computeLevelUnlockState(new Set([1, 2]));
  assert.equal(state2.unlockedLevel, 2);
  assert.deepEqual(state2.completedLevels, [1]);
});

test('Championship leaderboard ranks by score first and uses completion time strictly as tie-breaker', () => {
  let s1 = createEmptyStudentProfile('s1', 'Alya', 'sinta');
  let s2 = createEmptyStudentProfile('s2', 'Bagas', 'bima');
  let s3 = createEmptyStudentProfile('s3', 'Citra', 'kirana');

  const loc1Questions = getQuestionsByLocation(1);
  const allCorrect: Record<string, OptionLetter> = {};
  for (const q of loc1Questions) allCorrect[q.id] = q.correctOption;

  // Alya and Bagas both get 100 points, but Bagas finishes faster (45s vs 60s)
  s1 = applyMissionResultToProfile(s1, 'championship', 1, allCorrect, 60).updatedProfile;
  s2 = applyMissionResultToProfile(s2, 'championship', 1, allCorrect, 45).updatedProfile;

  // Citra gets 90 points in 30s (faster, but lower score)
  const nineCorrect: Record<string, OptionLetter> = { ...allCorrect };
  nineCorrect[loc1Questions[0].id] = loc1Questions[0].correctOption === 'A' ? 'B' : 'A';
  s3 = applyMissionResultToProfile(s3, 'championship', 1, nineCorrect, 30).updatedProfile;

  const board = buildChampionshipLeaderboard([s1, s2, s3]);
  assert.equal(board.length, 3);
  assert.equal(board[0].studentName, 'Bagas');
  assert.equal(board[0].rank, 1);
  assert.equal(board[0].academicGrade, calculateAdventureAcademicGrade(100)); // Time does not reduce academic grade!
  assert.equal(board[1].studentName, 'Alya');
  assert.equal(board[1].rank, 2);
  assert.equal(board[2].studentName, 'Citra');
  assert.equal(board[2].rank, 3);

  const lvl1Champ = getLevelChampion([s1, s2, s3], 1);
  assert.equal(lvl1Champ?.studentName, 'Bagas');
});
