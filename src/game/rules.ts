import { LEVELS, MISSION_LOCATIONS } from '../data/locations';
import { getQuestionsByLocation } from '../data/questions';
import {
  CharacterId,
  GameMode,
  LeaderboardEntry,
  LocationAttemptDetail,
  MedalTier,
  MissionResultSummary,
  OptionLetter,
  StudentProfile,
} from '../types/game';

export const POINTS_PER_CORRECT_ANSWER = 10;
export const MAX_POINTS_PER_LOCATION = 100;
export const MAX_POINTS_PER_LEVEL = 200;
export const MAX_POINTS_ADVENTURE = 1000;

export function normalizePlayerName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function calculateMedal(score: number, maxScore = 100): MedalTier {
  const ratio = maxScore > 0 ? (score / maxScore) * 100 : 0;
  if (ratio >= 85) return 'gold';
  if (ratio >= 70) return 'silver';
  if (ratio >= 50) return 'bronze';
  return 'none';
}

/**
 * Nilai akademik skala 100 dihitung dengan membagi total poin petualangan (maks 1000) dengan 10.
 */
export function calculateAdventureAcademicGrade(totalAdventurePoints: number): number {
  return Math.round((Math.max(0, Math.min(MAX_POINTS_ADVENTURE, totalAdventurePoints)) / 10) * 10) / 10;
}

export function createEmptyStudentProfile(
  id: string,
  name: string,
  characterId: CharacterId,
  nowIso = new Date().toISOString(),
): StudentProfile {
  return {
    id,
    name: name.trim().replace(/\s+/g, ' '),
    normalizedName: normalizePlayerName(name),
    characterId,
    createdAt: nowIso,
    lastActiveAt: nowIso,
    solo: {
      locations: {},
      latestTotalScore: 0,
      bestTotalScore: 0,
      academicGrade: 0,
      unlockedLevel: 1,
      completedLevels: [],
    },
    championship: {
      locations: {},
      totalChampionshipScore: 0,
      academicGrade: 0,
      totalTimeSeconds: 0,
      unlockedLevel: 1,
      completedLevels: [],
    },
  };
}

/**
 * Determines which levels are completed and what the highest unlocked level (1..5) is.
 * Level 1 is always unlocked. Level N+1 unlocks once both locations in Level N are completed.
 */
export function computeLevelUnlockState(completedLocationIds: Set<number>): {
  completedLevels: number[];
  unlockedLevel: number;
} {
  const completedLevels: number[] = [];
  let unlockedLevel = 1;

  for (const level of LEVELS) {
    const [locA, locB] = level.locationIds;
    const isBothDone = completedLocationIds.has(locA) && completedLocationIds.has(locB);
    if (isBothDone) {
      completedLevels.push(level.id);
      if (level.id === unlockedLevel && unlockedLevel < 5) {
        unlockedLevel = level.id + 1;
      }
    }
  }

  return { completedLevels, unlockedLevel };
}

export function isLocationUnlockedForProfile(
  profile: StudentProfile,
  locationId: number,
  mode: GameMode,
): boolean {
  const loc = MISSION_LOCATIONS.find((l) => l.id === locationId);
  if (!loc) return false;
  const unlockedLevel =
    mode === 'solo' ? profile.solo.unlockedLevel : profile.championship.unlockedLevel;
  return loc.levelId <= unlockedLevel;
}

export function evaluateLocationAnswers(
  locationId: number,
  selectedAnswers: Record<string, OptionLetter>,
): {
  pointsEarned: number;
  correctCount: number;
  wrongCount: number;
  details: LocationAttemptDetail[];
} {
  const questions = getQuestionsByLocation(locationId);
  let correctCount = 0;
  const details: LocationAttemptDetail[] = [];

  for (const q of questions) {
    const chosen = selectedAnswers[q.id];
    const isCorrect = chosen === q.correctOption;
    const pointsEarned = isCorrect ? POINTS_PER_CORRECT_ANSWER : 0;
    if (isCorrect) correctCount += 1;
    details.push({
      questionId: q.id,
      selectedOption: chosen,
      correctOption: q.correctOption,
      isCorrect,
      pointsEarned,
    });
  }

  const totalQuestions = questions.length;
  const wrongCount = totalQuestions - correctCount;
  const pointsEarned = correctCount * POINTS_PER_CORRECT_ANSWER;

  return {
    pointsEarned,
    correctCount,
    wrongCount,
    details,
  };
}

/**
 * Applies a mission result strictly to either SOLO ADVENTURE or CLASS CHAMPIONSHIP.
 * Never mixes, adds, or transfers points between the two modes.
 */
export function applyMissionResultToProfile(
  profile: StudentProfile,
  mode: GameMode,
  locationId: number,
  selectedAnswers: Record<string, OptionLetter>,
  timeSpentSeconds: number,
  nowIso = new Date().toISOString(),
): {
  updatedProfile: StudentProfile;
  summary: MissionResultSummary;
} {
  const locationMeta = MISSION_LOCATIONS.find((l) => l.id === locationId);
  if (!locationMeta) {
    throw new Error(`Invalid locationId: ${locationId}`);
  }

  const evalResult = evaluateLocationAnswers(locationId, selectedAnswers);
  const clampedTime = Math.max(1, Math.round(timeSpentSeconds));
  const medal = calculateMedal(evalResult.pointsEarned, MAX_POINTS_PER_LOCATION);
  const levelMeta = LEVELS.find((lvl) => lvl.id === locationMeta.levelId)!;

  // Clone profile deeply to avoid mutations
  const nextProfile: StudentProfile = JSON.parse(JSON.stringify(profile));
  nextProfile.lastActiveAt = nowIso;

  if (mode === 'solo') {
    const prevLoc = nextProfile.solo.locations[locationId];
    const bestScore = prevLoc
      ? Math.max(prevLoc.bestScore, evalResult.pointsEarned)
      : evalResult.pointsEarned;
    const bestCorrectCount = prevLoc
      ? Math.max(prevLoc.bestCorrectCount, evalResult.correctCount)
      : evalResult.correctCount;
    const bestTimeSeconds = prevLoc
      ? evalResult.pointsEarned > prevLoc.bestScore
        ? clampedTime
        : evalResult.pointsEarned === prevLoc.bestScore
          ? Math.min(prevLoc.bestTimeSeconds, clampedTime)
          : prevLoc.bestTimeSeconds
      : clampedTime;

    nextProfile.solo.locations[locationId] = {
      locationId,
      completed: true,
      latestScore: evalResult.pointsEarned,
      bestScore,
      latestCorrectCount: evalResult.correctCount,
      bestCorrectCount,
      bestTimeSeconds,
      attemptsCount: (prevLoc?.attemptsCount || 0) + 1,
      medal: calculateMedal(bestScore, MAX_POINTS_PER_LOCATION),
      lastPlayedAt: nowIso,
    };

    const allSoloLocs = Object.values(nextProfile.solo.locations);
    const latestTotalScore = allSoloLocs.reduce((acc, item) => acc + item.latestScore, 0);
    const bestTotalScore = allSoloLocs.reduce((acc, item) => acc + item.bestScore, 0);
    const completedSet = new Set(
      allSoloLocs.filter((item) => item.completed).map((item) => item.locationId),
    );
    const prevUnlocked = nextProfile.solo.unlockedLevel;
    const { completedLevels, unlockedLevel } = computeLevelUnlockState(completedSet);

    nextProfile.solo.latestTotalScore = latestTotalScore;
    nextProfile.solo.bestTotalScore = bestTotalScore;
    nextProfile.solo.academicGrade = calculateAdventureAcademicGrade(bestTotalScore);
    nextProfile.solo.completedLevels = completedLevels;
    nextProfile.solo.unlockedLevel = Math.max(prevUnlocked, unlockedLevel);

    const [l1, l2] = levelMeta.locationIds;
    const loc1Score = nextProfile.solo.locations[l1]?.bestScore || 0;
    const loc2Score = nextProfile.solo.locations[l2]?.bestScore || 0;
    const levelTotalPoints = loc1Score + loc2Score;
    const levelCompletedNow = completedLevels.includes(levelMeta.id);

    const summary: MissionResultSummary = {
      mode: 'solo',
      locationId,
      levelId: levelMeta.id,
      pointsEarned: evalResult.pointsEarned,
      correctCount: evalResult.correctCount,
      wrongCount: evalResult.wrongCount,
      locationGrade: evalResult.pointsEarned,
      timeSpentSeconds: clampedTime,
      medal,
      details: evalResult.details,
      levelCompletedNow,
      levelTotalPoints,
      levelGrade: Math.round(levelTotalPoints / 2),
      adventureTotalPoints: bestTotalScore,
      adventureAcademicGrade: nextProfile.solo.academicGrade,
      unlockedNextLevel: nextProfile.solo.unlockedLevel > prevUnlocked,
    };

    return { updatedProfile: nextProfile, summary };
  } else {
    // MODE: CLASS CHAMPIONSHIP (Strictly isolated from Solo Adventure!)
    const prevChampLoc = nextProfile.championship.locations[locationId];
    // Official Championship record: if already completed in current championship session, keep official first/best or update only if not locked
    const championshipScore = prevChampLoc
      ? Math.max(prevChampLoc.championshipScore, evalResult.pointsEarned)
      : evalResult.pointsEarned;
    const correctCount = prevChampLoc
      ? Math.max(prevChampLoc.correctCount, evalResult.correctCount)
      : evalResult.correctCount;
    const timeForLoc = prevChampLoc
      ? evalResult.pointsEarned > prevChampLoc.championshipScore
        ? clampedTime
        : prevChampLoc.timeSpentSeconds
      : clampedTime;

    nextProfile.championship.locations[locationId] = {
      locationId,
      completed: true,
      championshipScore,
      correctCount,
      timeSpentSeconds: timeForLoc,
      medal: calculateMedal(championshipScore, MAX_POINTS_PER_LOCATION),
      completedAt: nowIso,
    };

    const allChampLocs = Object.values(nextProfile.championship.locations);
    const totalChampionshipScore = allChampLocs.reduce(
      (acc, item) => acc + item.championshipScore,
      0,
    );
    const totalTimeSeconds = allChampLocs.reduce((acc, item) => acc + item.timeSpentSeconds, 0);
    const completedSet = new Set(
      allChampLocs.filter((item) => item.completed).map((item) => item.locationId),
    );
    const prevUnlocked = nextProfile.championship.unlockedLevel;
    const { completedLevels, unlockedLevel } = computeLevelUnlockState(completedSet);

    nextProfile.championship.totalChampionshipScore = totalChampionshipScore;
    nextProfile.championship.academicGrade =
      calculateAdventureAcademicGrade(totalChampionshipScore);
    nextProfile.championship.totalTimeSeconds = totalTimeSeconds;
    nextProfile.championship.completedLevels = completedLevels;
    nextProfile.championship.unlockedLevel = Math.max(prevUnlocked, unlockedLevel);

    const [l1, l2] = levelMeta.locationIds;
    const loc1Score = nextProfile.championship.locations[l1]?.championshipScore || 0;
    const loc2Score = nextProfile.championship.locations[l2]?.championshipScore || 0;
    const levelTotalPoints = loc1Score + loc2Score;
    const levelCompletedNow = completedLevels.includes(levelMeta.id);

    const summary: MissionResultSummary = {
      mode: 'championship',
      locationId,
      levelId: levelMeta.id,
      pointsEarned: evalResult.pointsEarned,
      correctCount: evalResult.correctCount,
      wrongCount: evalResult.wrongCount,
      locationGrade: evalResult.pointsEarned,
      timeSpentSeconds: clampedTime,
      medal,
      details: evalResult.details,
      levelCompletedNow,
      levelTotalPoints,
      levelGrade: Math.round(levelTotalPoints / 2),
      adventureTotalPoints: totalChampionshipScore,
      adventureAcademicGrade: nextProfile.championship.academicGrade,
      unlockedNextLevel: nextProfile.championship.unlockedLevel > prevUnlocked,
    };

    return { updatedProfile: nextProfile, summary };
  }
}

/**
 * Builds the official Class Championship leaderboard.
 * Priority 1: championshipScore (higher is better)
 * Priority 2 (Tie-breaker only): totalTimeSeconds (lower is faster, only among players who have played)
 */
export function buildChampionshipLeaderboard(students: StudentProfile[]): LeaderboardEntry[] {
  const entries: Omit<LeaderboardEntry, 'rank' | 'isGrandChampion'>[] = students
    .filter((s) => Object.keys(s.championship.locations).length > 0)
    .map((student) => {
      const locs = student.championship.locations;
      const completedLocationsCount = Object.values(locs).filter((l) => l.completed).length;
      const completedLevelsCount = student.championship.completedLevels.length;

      const levelScores: Record<number, number> = {};
      for (const lvl of LEVELS) {
        const [a, b] = lvl.locationIds;
        levelScores[lvl.id] = (locs[a]?.championshipScore || 0) + (locs[b]?.championshipScore || 0);
      }

      return {
        studentId: student.id,
        studentName: student.name,
        characterId: student.characterId,
        championshipScore: student.championship.totalChampionshipScore,
        academicGrade: student.championship.academicGrade,
        completedLocationsCount,
        completedLevelsCount,
        totalTimeSeconds: student.championship.totalTimeSeconds,
        medal: calculateMedal(student.championship.totalChampionshipScore, MAX_POINTS_ADVENTURE),
        levelScores,
      };
    });

  entries.sort((a, b) => {
    if (b.championshipScore !== a.championshipScore) {
      return b.championshipScore - a.championshipScore;
    }
    return a.totalTimeSeconds - b.totalTimeSeconds;
  });

  return entries.map((item, idx) => ({
    ...item,
    rank: idx + 1,
    isGrandChampion: idx === 0 && item.completedLevelsCount === 5 && item.championshipScore > 0,
  }));
}

/**
 * Finds the Level Champion for a specific level (1..5) in Class Championship mode.
 */
export function getLevelChampion(
  students: StudentProfile[],
  levelId: number,
): { studentName: string; score: number; timeSeconds: number; characterId: CharacterId } | null {
  const levelMeta = LEVELS.find((l) => l.id === levelId);
  if (!levelMeta) return null;
  const [locA, locB] = levelMeta.locationIds;

  const candidates = students
    .map((s) => {
      const recA = s.championship.locations[locA];
      const recB = s.championship.locations[locB];
      const score = (recA?.championshipScore || 0) + (recB?.championshipScore || 0);
      const timeSeconds = (recA?.timeSpentSeconds || 0) + (recB?.timeSpentSeconds || 0);
      const bothCompleted = Boolean(recA?.completed && recB?.completed);
      return {
        studentName: s.name,
        characterId: s.characterId,
        score,
        timeSeconds,
        bothCompleted,
      };
    })
    .filter((c) => c.score > 0);

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.timeSeconds - b.timeSeconds;
  });

  return candidates[0];
}
