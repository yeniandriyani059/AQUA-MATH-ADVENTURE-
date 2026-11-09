export type CharacterId = 'bima' | 'sinta' | 'kirana';

export type GameMode = 'solo' | 'championship';

export type OptionLetter = 'A' | 'B' | 'C' | 'D';

export type MedalTier = 'none' | 'bronze' | 'silver' | 'gold';

export interface CharacterOption {
  id: CharacterId;
  name: string;
  roleTitle: string;
  description: string;
  hijab: boolean;
  gender: 'boy' | 'girl';
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
}

export interface MathQuestion {
  id: string;
  locationId: number;
  levelId: number;
  number: number; // 1 to 10 within location
  questionText: string;
  options: Record<OptionLetter, string>;
  correctOption: OptionLetter;
  explanation: string;
  topic: string;
  competency: string;
  difficultyLevel: 'Mudah' | 'Sedang' | 'Menantang' | 'Sangat Menantang (Final Mission)';
  lkpdReference?: string;
}

export interface MissionLocation {
  id: number; // 1 to 10
  levelId: number; // 1 to 5
  orderInLevel: 1 | 2;
  name: string;
  indonesianName: string;
  levelTheme: string;
  topic: string;
  difficulty:
    | 'Mudah'
    | 'Mudah - Sedang'
    | 'Sedang'
    | 'Sedang - Sulit'
    | 'Kompleks (Final Mission)';
  description: string;
  storyPrompt: string;
  position: { x: number; z: number };
  color: string;
  accentColor: string;
  buildingType:
    | 'water_tank_station'
    | 'fresh_water_pond'
    | 'pipeline_center'
    | 'pumping_station'
    | 'storage_tank'
    | 'aqua_garden'
    | 'school_zone'
    | 'hospital_zone'
    | 'city_reservoir'
    | 'aqua_control_center';
}

export interface LevelMetadata {
  id: number; // 1 to 5
  code: string;
  title: string;
  theme: string;
  difficultyLabel: string;
  locationIds: [number, number];
  badgeColor: string;
}

export interface LocationAttemptDetail {
  questionId: string;
  selectedOption: OptionLetter;
  correctOption: OptionLetter;
  isCorrect: boolean;
  pointsEarned: number;
}

export interface SoloLocationProgress {
  locationId: number;
  completed: boolean;
  latestScore: number; // 0 to 100
  bestScore: number; // 0 to 100
  latestCorrectCount: number; // 0 to 10
  bestCorrectCount: number; // 0 to 10
  bestTimeSeconds: number;
  attemptsCount: number;
  medal: MedalTier;
  lastPlayedAt: string;
}

export interface ChampionshipLocationRecord {
  locationId: number;
  completed: boolean;
  championshipScore: number; // 0 to 100 (Locked official score or latest official session score)
  correctCount: number; // 0 to 10
  timeSpentSeconds: number;
  medal: MedalTier;
  completedAt: string;
}

export interface StudentProfile {
  id: string;
  authUserId?: string | null;
  name: string;
  username?: string;
  normalizedName: string;
  characterId: CharacterId;
  isActive?: boolean;
  profileLinked?: boolean;
  createdAt: string;
  lastActiveAt: string;
  // Strictly isolated Solo Adventure state
  solo: {
    locations: Record<number, SoloLocationProgress>;
    latestTotalScore: number; // sum of latestScore across 10 locations (0 - 1000)
    bestTotalScore: number; // sum of bestScore across 10 locations (0 - 1000)
    academicGrade: number; // bestTotalScore / 10 (scale 0 - 100)
    unlockedLevel: number; // 1 to 5
    completedLevels: number[]; // e.g., [1, 2]
  };
  // Strictly isolated Class Championship state
  championship: {
    locations: Record<number, ChampionshipLocationRecord>;
    totalChampionshipScore: number; // sum of championshipScore across 10 locations (0 - 1000)
    academicGrade: number; // totalChampionshipScore / 10 (scale 0 - 100)
    totalTimeSeconds: number; // Tie-breaker only, never reduces academic grade
    unlockedLevel: number; // 1 to 5
    completedLevels: number[];
  };
}

export interface ClassSettings {
  accessCode: string;
  accessCodeActive: boolean;
  soloAdventureOpen: boolean;
  championshipOpen: boolean;
  championshipSessionName: string;
  teacherName: string;
  className: string;
  updatedAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  studentId: string;
  studentName: string;
  characterId: CharacterId;
  championshipScore: number; // 0 - 1000
  academicGrade: number; // 0 - 100
  completedLocationsCount: number;
  completedLevelsCount: number;
  totalTimeSeconds: number;
  medal: MedalTier;
  isGrandChampion: boolean;
  levelScores: Record<number, number>; // levelId (1-5) -> 0-200
}

export interface MissionResultSummary {
  mode: GameMode;
  locationId: number;
  levelId: number;
  pointsEarned: number; // 0 - 100
  correctCount: number; // 0 - 10
  wrongCount: number; // 0 - 10
  locationGrade: number; // 0 - 100
  timeSpentSeconds: number;
  medal: MedalTier;
  details: LocationAttemptDetail[];
  levelCompletedNow: boolean;
  levelTotalPoints: number; // 0 - 200
  levelGrade: number; // 0 - 100
  adventureTotalPoints: number; // 0 - 1000
  adventureAcademicGrade: number; // 0 - 100 (Total Poin / 10)
  unlockedNextLevel: boolean;
  championshipRank?: number;
  syncedToSupabase?: boolean;
  syncStatusMessage?: string;
}
