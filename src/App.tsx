import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUp,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Droplets,
  Home,
  LogOut,
  Map,
  Menu,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Target,
  User,
  Volume2,
  VolumeX,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { MISSION_LOCATIONS } from './data/locations';
import {
  buildChampionshipLeaderboard,
  isLocationUnlockedForProfile,
} from './game/rules';
import {
  getActiveGameMode,
  getActiveStudentId,
  loadClassSettings,
  loadStudents,
  recordMissionCompletion,
  setActiveGameMode,
  setActiveStudentId,
} from './services/gameStorage';
import {
  ClassSettings,
  GameMode,
  MissionLocation,
  MissionResultSummary,
  OptionLetter,
  StudentProfile,
} from './types/game';
import { soundManager } from './utils/sound';
import { useTransparentCharacterCutout } from './utils/characterCutout';
import {
  AquaCityCanvas,
  CameraControlActions,
  CameraViewDistancePreset,
  JoystickVector,
} from './components/AquaCityCanvas';
import { AquaLogoSvg, CharacterAvatarSvg, MedalBadgeSvg } from './components/AquaLogoSvg';
import { VirtualJoystick } from './components/VirtualJoystick';
import { CameraRadialMenu } from './components/CameraRadialMenu';
import { StudentOnboardingModal } from './components/StudentOnboardingModal';
import { MissionQuizModal } from './components/MissionQuizModal';
import { MissionResultModal } from './components/MissionResultModal';
import { WorldMapModal } from './components/WorldMapModal';
import { TeacherDashboard } from './components/TeacherDashboard';

type AppShellState = 'title' | 'onboarding' | 'playing' | 'paused' | 'gameover' | 'teacher';

export default function App() {
  const [settings, setSettings] = useState<ClassSettings>(() => loadClassSettings());
  const [students, setStudents] = useState<StudentProfile[]>(() => loadStudents());

  // Transparent full-body 3D Chibi character cutouts from official reference renders
  const bimaCutoutUrl = useTransparentCharacterCutout('bima');
  const sintaCutoutUrl = useTransparentCharacterCutout('sinta');

  // Determine initial active student (or fallback to first demo student if ?autostart=1)
  const [activeStudent, setActiveStudent] = useState<StudentProfile | null>(() => {
    const list = loadStudents();
    const savedId = getActiveStudentId();
    if (savedId) {
      const found = list.find((s) => s.id === savedId);
      if (found) return found;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1' && list.length > 0) {
      return list[0];
    }
    return null;
  });

  const [gameMode, setGameMode] = useState<GameMode>(() => getActiveGameMode());

  const [shellState, setShellState] = useState<AppShellState>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      return 'playing';
    }
    return 'title';
  });

  // Active modals & overlays during gameplay
  const [activeQuizLocation, setActiveQuizLocation] = useState<MissionLocation | null>(null);
  const [missionResult, setMissionResult] = useState<MissionResultSummary | null>(null);
  const [showWorldMap, setShowWorldMap] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [pauseMenuConfirm, setPauseMenuConfirm] = useState<'title' | 'exit' | null>(null);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerHeight < 520 || window.innerWidth < 960 : false,
  );
  const [soundMuted, setSoundMuted] = useState<boolean>(() => soundManager.isMuted());
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  // Portrait orientation hint
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);
  const [portraitDismissed, setPortraitDismissed] = useState(false);

  // 3D character locomotion, 360° Free Orbit Camera & proximity state
  const joystickRef = useRef<JoystickVector>({ x: 0, y: 0 });
  const cameraControlRef = useRef<CameraControlActions | null>(null);
  const [cameraPreset, setCameraPreset] = useState<CameraViewDistancePreset>('normal');
  const [cameraRadialOpen, setCameraRadialOpen] = useState(false);
  const [isSprinting, setIsSprinting] = useState(false);
  const [jumpSignal, setJumpSignal] = useState(0);
  const [celebrateSignal, setCelebrateSignal] = useState(0);
  const [teleportTarget, setTeleportTarget] = useState<{
    locationId: number;
    timestamp: number;
  } | null>(null);
  const [nearbyLocation, setNearbyLocation] = useState<MissionLocation | null>(null);

  // Sync document.body.dataset.state for ultra-mode verification contract
  useEffect(() => {
    if (shellState === 'title' || shellState === 'onboarding' || shellState === 'teacher') {
      document.body.dataset.state = 'title';
    } else if (shellState === 'paused') {
      document.body.dataset.state = 'paused';
    } else if (shellState === 'gameover' || missionResult) {
      document.body.dataset.state = 'gameover';
    } else {
      document.body.dataset.state = 'playing';
    }
  }, [shellState, missionResult]);

  // Check portrait orientation & compact viewport
  useEffect(() => {
    const checkOrientation = () => {
      const portrait = window.innerHeight > window.innerWidth && window.innerWidth < 768;
      setIsPortraitMobile(portrait);
      if (window.innerHeight < 520 || window.innerWidth < 960) {
        setDockCollapsed(true);
      }
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  // Auto-hide toast notice
  useEffect(() => {
    if (!toastNotice) return;
    const t = window.setTimeout(() => setToastNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [toastNotice]);

  const currentProfile = activeStudent || students[0];
  const unlockedLevel = currentProfile
    ? gameMode === 'solo'
      ? currentProfile.solo.unlockedLevel
      : currentProfile.championship.unlockedLevel
    : 1;

  const completedLocationIds = currentProfile
    ? Object.values(
        gameMode === 'solo'
          ? currentProfile.solo.locations
          : currentProfile.championship.locations,
      )
        .filter((l) => l.completed)
        .map((l) => l.locationId)
    : [];

  const handleStartFromTitle = useCallback(() => {
    soundManager.playClick();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setShellState('onboarding');
  }, []);

  const handleQuickStartAdventure = useCallback(() => {
    soundManager.playMissionComplete();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    const studentToUse = activeStudent || students[0];
    if (studentToUse) {
      setActiveStudent(studentToUse);
      setActiveStudentId(studentToUse.id);
      setShellState('playing');
    } else {
      setShellState('onboarding');
    }
  }, [activeStudent, students]);

  // Global keyboard shortcuts (Title start, Pause [P/Esc], Map [M], Dock [H])
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (shellState === 'title' && !showHowToPlay) {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          handleStartFromTitle();
          return;
        }
      }

      if (shellState === 'playing' && !activeQuizLocation && !missionResult) {
        if (e.code === 'KeyP' || e.code === 'Escape') {
          e.preventDefault();
          setShellState('paused');
        } else if (e.code === 'KeyM') {
          e.preventDefault();
          setShowWorldMap((v) => !v);
        } else if (e.code === 'KeyH') {
          e.preventDefault();
          setDockCollapsed((v) => !v);
        } else if (e.code === 'KeyR') {
          e.preventDefault();
          soundManager.playClick();
          cameraControlRef.current?.resetCamera();
        }
      } else if (shellState === 'paused') {
        if (e.code === 'KeyP' || e.code === 'Escape') {
          e.preventDefault();
          setShellState('playing');
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shellState, showHowToPlay, activeQuizLocation, missionResult, handleStartFromTitle]);

  const handleTriggerInteract = useCallback(
    (loc: MissionLocation) => {
      if (!currentProfile) return;
      if (gameMode === 'solo' && !settings.soloAdventureOpen) {
        setToastNotice('Mode Solo Adventure sedang ditutup oleh Guru.');
        return;
      }
      if (gameMode === 'championship' && !settings.championshipOpen) {
        setToastNotice('Sesi Class Championship sedang ditutup oleh Guru.');
        return;
      }
      const isUnlocked = isLocationUnlockedForProfile(currentProfile, loc.id, gameMode);
      if (!isUnlocked) {
        setToastNotice(
          `Lokasi ${loc.name} (Level ${loc.levelId}) masih terkunci! Selesaikan kedua lokasi di Level ${loc.levelId - 1} terlebih dahulu.`,
        );
        return;
      }
      soundManager.playClick();
      joystickRef.current = { x: 0, y: 0 };
      setShowWorldMap(false);
      setActiveQuizLocation(loc);
    },
    [currentProfile, gameMode, settings],
  );

  const handleMissionSubmit = (
    locationId: number,
    answers: Record<string, OptionLetter>,
    timeSpentSeconds: number,
  ) => {
    if (!currentProfile) return;
    const { updatedStudent, allStudents, summary } = recordMissionCompletion(
      currentProfile.id,
      gameMode,
      locationId,
      answers,
      timeSpentSeconds,
    );

    if (gameMode === 'championship') {
      const board = buildChampionshipLeaderboard(allStudents);
      const myEntry = board.find((b) => b.studentId === updatedStudent.id);
      if (myEntry) {
        summary.championshipRank = myEntry.rank;
      }
    }

    setActiveStudent(updatedStudent);
    setStudents(allStudents);
    setActiveQuizLocation(null);
    setMissionResult(summary);
    setShellState('gameover');
  };

  const handleContinueFromResult = (nextLocationId?: number) => {
    setMissionResult(null);
    setShellState('playing');
    setCelebrateSignal((n) => n + 1);
    if (nextLocationId) {
      const nextLoc = MISSION_LOCATIONS.find((l) => l.id === nextLocationId);
      if (nextLoc && currentProfile && isLocationUnlockedForProfile(currentProfile, nextLocationId, gameMode)) {
        setTeleportTarget({ locationId: nextLocationId, timestamp: Date.now() });
      } else if (nextLoc) {
        setToastNotice(
          `Selesaikan lokasi lainnya di Level ${nextLoc.levelId - 1} untuk membuka ${nextLoc.name}!`,
        );
      }
    }
  };

  const handleToggleSound = () => {
    const muted = soundManager.toggleMute();
    setSoundMuted(muted);
  };

  // Next recommended unlocked location for the student
  const nextRecommendedLocation =
    MISSION_LOCATIONS.find(
      (loc) =>
        loc.levelId <= unlockedLevel && !completedLocationIds.includes(loc.id),
    ) || MISSION_LOCATIONS[0];

  const currentPosLocation = nearbyLocation || nextRecommendedLocation;

  return (
    <main className="relative w-screen h-screen overflow-hidden select-none bg-sky-950">
      {/* Persistent Full-Bleed 3D WebGL World of Aqua City */}
      <AquaCityCanvas
        sceneMode={shellState === 'playing' ? 'playing' : 'tour'}
        characterId={currentProfile?.characterId || 'sinta'}
        unlockedLevel={unlockedLevel}
        completedLocationIds={completedLocationIds}
        joystickRef={joystickRef}
        isSprinting={isSprinting}
        jumpSignal={jumpSignal}
        celebrateSignal={celebrateSignal}
        teleportTarget={teleportTarget}
        cameraControlRef={cameraControlRef}
        onCameraPresetChange={setCameraPreset}
        onNearbyLocationChange={(loc) => setNearbyLocation(loc)}
        onTriggerInteract={handleTriggerInteract}
      />

      {/* Portrait Orientation Advisory Banner for Mobile Devices */}
      {isPortraitMobile && !portraitDismissed && (
        <div className="fixed top-2 inset-x-3 z-50 bg-amber-400 text-sky-950 px-4 py-2.5 rounded-2xl border-2 border-white shadow-xl flex items-center justify-between gap-3 pointer-events-auto">
          <div className="flex items-center gap-2 text-xs font-bold leading-snug">
            <Smartphone className="w-4 h-4 shrink-0 text-sky-950" />
            <span>
              <strong>Tips Layar:</strong> Putar smartphone ke posisi <strong>Landscape (Miring)</strong> agar dunia 3D Aqua City terlihat lebih luas!
            </span>
          </div>
          <button
            type="button"
            onClick={() => setPortraitDismissed(true)}
            className="px-2.5 py-1 rounded-lg bg-sky-950 text-yellow-300 text-xs font-bold shrink-0 cursor-pointer"
          >
            Oke
          </button>
        </div>
      )}

      {/* Toast Notification */}
      {toastNotice && (
        <div
          role="status"
          className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-sky-950 border-2 border-yellow-400 text-white px-5 py-2.5 rounded-2xl shadow-xl text-xs sm:text-sm font-bold pointer-events-auto"
        >
          {toastNotice}
        </div>
      )}

      {/* =====================================================================
          SCREEN 1: PREMIUM 3D CHIBI GAME MAIN MENU
          Top: Identity Badge (Left) + AQUA MATH ADVENTURE Logo (Center) + Suara & Portal Guru (Right)
          Middle: Full-Body 3D Chibi Bima & Sinta Hero Stage over Live 3D Aqua City
          Bottom: Primary MULAI PETUALANGAN + LANJUTKAN PETUALANGAN + CARA BERMAIN
          ===================================================================== */}
      {shellState === 'title' && (
        <div className="fixed inset-0 z-20 flex flex-col justify-between px-3 py-2 sm:px-6 sm:py-3.5 bg-gradient-to-b from-sky-950/55 via-sky-950/10 to-sky-950/85 pointer-events-none">
          {/* BAGIAN ATAS: Identity Badge (Kiri), Logo Utama (Tengah), Suara & Portal Guru (Kanan) */}
          <div className="grid grid-cols-2 md:grid-cols-3 items-start gap-2 sm:gap-3 w-full shrink-0">
            {/* Top-Left Identity Badge (No Grade Level, No Emoji) */}
            <div className="hidden md:flex items-center justify-self-start gap-2.5 bg-sky-950/90 border-2 border-cyan-400/80 rounded-2xl px-3.5 py-2 shadow-lg pointer-events-auto">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-400 to-sky-600 flex items-center justify-center border border-white/60 shadow-inner shrink-0">
                <Droplets className="w-4 h-4 text-white stroke-[2.5]" />
              </div>
              <div className="leading-tight">
                <div className="font-['Fredoka'] font-bold text-xs text-white tracking-wide">
                  AQUA MATH ADVENTURE
                </div>
                <div className="text-[10px] font-extrabold tracking-widest text-cyan-300 uppercase">
                  3D EDUCATIONAL ADVENTURE
                </div>
              </div>
            </div>

            {/* Top-Center Official AQUA MATH ADVENTURE Logo */}
            <div className="flex flex-col items-start md:items-center justify-self-start md:justify-self-center pointer-events-auto">
              <AquaLogoSvg className="w-[155px] sm:w-[195px] md:w-[270px] lg:w-[320px] max-h-[16vh] w-auto drop-shadow-[0_10px_20px_rgba(3,43,67,0.65)]" />
            </div>

            {/* Top-Right Utility & Administrator Access: Suara + Portal Guru */}
            <div className="flex items-center justify-end justify-self-end gap-1.5 sm:gap-2 pointer-events-auto">
              <button
                type="button"
                onClick={handleToggleSound}
                aria-label={soundMuted ? 'Aktifkan Suara' : 'Matikan Suara'}
                className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-2xl bg-sky-950/90 hover:bg-sky-900 text-cyan-100 border-2 border-cyan-400/75 font-['Fredoka'] text-[11px] sm:text-xs font-bold shadow-lg cursor-pointer transition-transform active:scale-95 whitespace-nowrap"
              >
                {soundMuted ? (
                  <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-300 stroke-[2.5]" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-300 stroke-[2.5]" />
                )}
                <span>{soundMuted ? 'Suara: Mati' : 'Suara: Aktif'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundManager.playClick();
                  setShellState('teacher');
                }}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-2xl bg-sky-950/95 hover:bg-sky-900 text-yellow-300 border-2 border-yellow-400/90 font-['Fredoka'] text-[11px] sm:text-xs font-bold shadow-lg cursor-pointer transition-transform active:scale-95 whitespace-nowrap"
              >
                <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-300 stroke-[2.5]" />
                <span>Portal Guru</span>
              </button>
            </div>
          </div>

          {/* BAGIAN TENGAH: Full-Body 3D Chibi BIMA & SINTA Hero Stage in Foreground of Aqua City */}
          <div className="flex-1 flex items-center justify-center min-h-0 py-1 pointer-events-none">
            <div className="grid grid-cols-2 gap-4 sm:gap-10 md:gap-16 lg:gap-24 items-end max-w-4xl w-full px-2 sm:px-6">
              {/* HERO 1: BIMA (Left Foreground Stage) */}
              <div
                onClick={handleStartFromTitle}
                className="group relative flex flex-col items-center pointer-events-auto cursor-pointer select-none"
              >
                {/* Soft Aqua Ambient Rim Glow behind Character */}
                <div className="absolute -inset-2 bg-radial from-cyan-400/30 via-sky-500/10 to-transparent rounded-full blur-xl opacity-80 group-hover:opacity-100 transition-opacity pointer-events-none" />

                {/* Full-Body 3D Chibi Bima Render */}
                <div className="relative z-10 flex items-end justify-center transition-transform duration-300 group-hover:-translate-y-1.5">
                  <img
                    src={bimaCutoutUrl}
                    alt="Bima - Kapten Teknisi Air Aqua City"
                    draggable={false}
                    className="h-[34vh] sm:h-[38vh] md:h-[43vh] lg:h-[46vh] max-h-[350px] w-auto object-contain drop-shadow-[0_14px_20px_rgba(3,43,67,0.75)]"
                  />
                </div>

                {/* 3D Isometric Glowing Aqua Podium */}
                <div className="relative -mt-2.5 sm:-mt-3.5 w-32 sm:w-48 md:w-56 h-5 sm:h-7 rounded-full bg-gradient-to-b from-cyan-300 via-sky-600 to-sky-950 border-2 border-yellow-300 shadow-[0_8px_22px_rgba(2,132,199,0.75)] flex items-center justify-center">
                  <div className="w-[86%] h-[58%] rounded-full bg-gradient-to-r from-sky-900 via-cyan-400/50 to-sky-900 border border-cyan-200/70" />
                </div>

                {/* Character Nameplate Badge */}
                <div className="-mt-2 relative z-20 bg-sky-950/95 border-2 border-yellow-400 rounded-2xl px-2.5 sm:px-4 py-0.5 sm:py-1 shadow-xl flex items-center gap-1.5 sm:gap-2">
                  <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-yellow-400 shadow-[0_0_8px_#facc15]" />
                  <div className="text-left leading-tight">
                    <div className="font-['Fredoka'] font-bold text-[11px] sm:text-sm text-yellow-300 tracking-wide">
                      BIMA
                    </div>
                    <div className="text-[9px] sm:text-[11px] font-bold text-cyan-100 whitespace-nowrap">
                      Kapten Teknisi Air
                    </div>
                  </div>
                </div>
              </div>

              {/* HERO 2: SINTA (Right Foreground Stage) */}
              <div
                onClick={handleStartFromTitle}
                className="group relative flex flex-col items-center pointer-events-auto cursor-pointer select-none"
              >
                {/* Soft Aqua Ambient Rim Glow behind Character */}
                <div className="absolute -inset-2 bg-radial from-cyan-400/30 via-sky-500/10 to-transparent rounded-full blur-xl opacity-80 group-hover:opacity-100 transition-opacity pointer-events-none" />

                {/* Full-Body 3D Chibi Sinta Render */}
                <div className="relative z-10 flex items-end justify-center transition-transform duration-300 group-hover:-translate-y-1.5">
                  <img
                    src={sintaCutoutUrl}
                    alt="Sinta - Penjaga Air Bersih Aqua City"
                    draggable={false}
                    className="h-[34vh] sm:h-[38vh] md:h-[43vh] lg:h-[46vh] max-h-[350px] w-auto object-contain drop-shadow-[0_14px_20px_rgba(3,43,67,0.75)]"
                  />
                </div>

                {/* 3D Isometric Glowing Aqua Podium */}
                <div className="relative -mt-2.5 sm:-mt-3.5 w-32 sm:w-48 md:w-56 h-5 sm:h-7 rounded-full bg-gradient-to-b from-cyan-300 via-sky-600 to-sky-950 border-2 border-yellow-300 shadow-[0_8px_22px_rgba(2,132,199,0.75)] flex items-center justify-center">
                  <div className="w-[86%] h-[58%] rounded-full bg-gradient-to-r from-sky-900 via-cyan-400/50 to-sky-900 border border-cyan-200/70" />
                </div>

                {/* Character Nameplate Badge */}
                <div className="-mt-2 relative z-20 bg-sky-950/95 border-2 border-cyan-300 rounded-2xl px-2.5 sm:px-4 py-0.5 sm:py-1 shadow-xl flex items-center gap-1.5 sm:gap-2">
                  <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-cyan-300 shadow-[0_0_8px_#67e8f9]" />
                  <div className="text-left leading-tight">
                    <div className="font-['Fredoka'] font-bold text-[11px] sm:text-sm text-cyan-300 tracking-wide">
                      SINTA
                    </div>
                    <div className="text-[9px] sm:text-[11px] font-bold text-cyan-100 whitespace-nowrap">
                      Penjaga Air Bersih
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* BAGIAN BAWAH: Hierarki Tombol Utama (MULAI PETUALANGAN, LANJUTKAN PETUALANGAN, CARA BERMAIN) */}
          <div className="flex flex-col items-center pb-0.5 sm:pb-1 pointer-events-auto shrink-0 w-full">
            <div className="flex flex-wrap sm:flex-nowrap items-center justify-center gap-2 sm:gap-2.5 lg:gap-3.5 max-w-5xl mx-auto px-2">
              {/* 1. Tombol Utama: MULAI PETUALANGAN */}
              <button
                type="button"
                data-start="true"
                onClick={handleStartFromTitle}
                className="group flex items-center justify-center gap-2 px-4 sm:px-5 lg:px-7 py-2 sm:py-2.5 lg:py-3 rounded-2xl bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-500 hover:from-yellow-200 hover:via-yellow-300 hover:to-amber-400 text-sky-950 font-['Fredoka'] font-bold text-xs sm:text-sm lg:text-lg border-2 border-white shadow-[0_4px_0_#b45309,0_8px_16px_rgba(3,43,67,0.45)] hover:shadow-[0_2px_0_#b45309,0_5px_12px_rgba(3,43,67,0.45)] hover:translate-y-0.5 active:translate-y-1 transition-all cursor-pointer whitespace-nowrap"
              >
                <span className="w-6 h-6 lg:w-7 lg:h-7 rounded-xl bg-sky-950/15 flex items-center justify-center shrink-0">
                  <Play className="w-3.5 h-3.5 lg:w-4 lg:h-4 fill-sky-950 text-sky-950 ml-0.5" />
                </span>
                <span>MULAI PETUALANGAN</span>
              </button>

              {/* 2. Tombol Kedua: LANJUTKAN PETUALANGAN */}
              {currentProfile && (
                <button
                  type="button"
                  onClick={handleQuickStartAdventure}
                  className="flex items-center justify-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 lg:px-5 py-2 sm:py-2.5 lg:py-3 rounded-2xl bg-gradient-to-b from-cyan-300 via-cyan-400 to-sky-500 hover:from-cyan-200 hover:to-sky-400 text-sky-950 font-['Fredoka'] font-bold text-xs sm:text-xs lg:text-base border-2 border-white shadow-[0_4px_0_#0369a1,0_8px_16px_rgba(3,43,67,0.4)] hover:shadow-[0_2px_0_#0369a1] hover:translate-y-0.5 active:translate-y-1 transition-all cursor-pointer whitespace-nowrap"
                >
                  <ArrowRight className="w-4 h-4 lg:w-5 lg:h-5 text-sky-950 stroke-[2.75] shrink-0" />
                  <span>LANJUTKAN PETUALANGAN ({currentProfile.name.toUpperCase()})</span>
                </button>
              )}

              {/* 3. Tombol Tambahan: CARA BERMAIN */}
              <button
                type="button"
                onClick={() => {
                  soundManager.playClick();
                  setShowHowToPlay(true);
                }}
                className="flex items-center justify-center gap-1.5 px-3.5 sm:px-4 lg:px-5 py-2 sm:py-2.5 lg:py-3 rounded-2xl bg-sky-900/95 hover:bg-sky-800 text-white font-['Fredoka'] font-bold text-xs sm:text-xs lg:text-base border-2 border-cyan-300/90 shadow-[0_4px_0_#082f49,0_8px_16px_rgba(3,43,67,0.4)] hover:translate-y-0.5 active:translate-y-1 transition-all cursor-pointer whitespace-nowrap"
              >
                <BookOpen className="w-4 h-4 text-cyan-300 stroke-[2.5] shrink-0" />
                <span>CARA BERMAIN</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SCREEN 2: STUDENT ONBOARDING (Access Code, Name, Character, Mode, Map)
          ===================================================================== */}
      {shellState === 'onboarding' && (
        <StudentOnboardingModal
          settings={settings}
          initialProfile={activeStudent}
          initialMode={gameMode}
          onCompleteOnboarding={(profile, chosenMode) => {
            setActiveStudent(profile);
            setStudents(loadStudents());
            setGameMode(chosenMode);
            setActiveGameMode(chosenMode);
            setShellState('playing');
          }}
          onCancelToTitle={() => setShellState('title')}
        />
      )}

      {/* =====================================================================
          SCREEN 3: TEACHER DASHBOARD (ADMIN)
          ===================================================================== */}
      {shellState === 'teacher' && (
        <TeacherDashboard
          settings={settings}
          students={students}
          onUpdateSettings={(next) => setSettings(next)}
          onUpdateStudents={(next) => {
            setStudents(next);
            if (activeStudent) {
              const updatedMe = next.find((s) => s.id === activeStudent.id);
              if (updatedMe) setActiveStudent(updatedMe);
            }
          }}
          onCloseToTitle={() => setShellState('title')}
        />
      )}

      {/* =====================================================================
          SCREEN 4: 3D PLAYING HUD (Unobstructed Center Viewport, Solid/RGBA)
          ===================================================================== */}
      {shellState === 'playing' && currentProfile && (
        <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3 sm:p-4">
          {/* TOP PERIMETER ROW: Left Profile & POS + Center Location Banner + Right Audio & Menu */}
          <div className="flex items-start justify-between gap-2 sm:gap-3">
            {/* Top-Left: Player Profile + Current POS Indicator */}
            <div className="flex items-center gap-2 pointer-events-auto shrink-0">
              {/* Compact Player Card */}
              <div className="bg-sky-950/90 border-2 border-cyan-400 rounded-2xl px-2.5 py-1.5 sm:px-3 sm:py-2 shadow-xl flex items-center gap-2 sm:gap-2.5">
                <CharacterAvatarSvg
                  characterId={currentProfile.characterId}
                  className="w-9 h-9 sm:w-11 sm:h-11 shrink-0"
                />
                <div className="leading-tight">
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className="font-['Fredoka'] font-bold text-xs sm:text-base text-white">
                      {currentProfile.name}
                    </span>
                    <span
                      className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md ${
                        gameMode === 'solo'
                          ? 'bg-cyan-400 text-sky-950'
                          : 'bg-yellow-400 text-sky-950'
                      }`}
                    >
                      {gameMode === 'solo' ? 'SOLO' : 'CHAMPIONSHIP'}
                    </span>
                  </div>

                  <div className="text-[11px] sm:text-xs text-cyan-200 mt-0.5 tabular-nums whitespace-nowrap">
                    {gameMode === 'solo' ? (
                      <span>
                        Skor:{' '}
                        <strong className="text-yellow-300 font-mono font-bold">
                          {currentProfile.solo.bestTotalScore}
                        </strong>
                      </span>
                    ) : (
                      <span>
                        Skor Resmi:{' '}
                        <strong className="text-yellow-300 font-mono font-bold">
                          {currentProfile.championship.totalChampionshipScore}
                        </strong>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* POS Indicator: POS X / 10 */}
              <div
                data-testid="hud-pos-indicator"
                className="bg-sky-950/90 border-2 border-yellow-400 rounded-2xl px-2.5 sm:px-3 py-1.5 sm:py-2 shadow-xl flex items-center gap-1.5 text-center"
              >
                <div className="text-left leading-tight">
                  <div className="text-[8px] sm:text-[9px] font-extrabold tracking-wider text-yellow-300 uppercase">
                    LOKASI
                  </div>
                  <div className="font-mono font-extrabold text-xs sm:text-sm text-white">
                    POS {currentPosLocation.id} <span className="text-cyan-300 font-normal">/ 10</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Top-Center: Location Banner & Contextual Interactive Mission Trigger */}
            <div className="flex flex-col items-center pointer-events-auto max-w-[200px] sm:max-w-xs md:max-w-md text-center">
              <div className="bg-sky-950/95 border-2 border-cyan-400/80 rounded-2xl px-3 sm:px-4 py-1.5 shadow-xl flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
                <div className="leading-tight truncate">
                  <div className="text-[9px] sm:text-[10px] font-extrabold text-cyan-300 uppercase tracking-wider">
                    POS {currentPosLocation.id} · LEVEL {currentPosLocation.levelId}
                  </div>
                  <div className="text-xs sm:text-sm font-bold font-['Fredoka'] text-white truncate">
                    {currentPosLocation.name}
                  </div>
                </div>
                {nearbyLocation && (
                  <button
                    type="button"
                    tabIndex={-1}
                    data-testid="proximity-interact-button"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      handleTriggerInteract(nearbyLocation);
                    }}
                    className="ml-1 sm:ml-2 flex items-center gap-1 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-sky-950 font-['Fredoka'] font-bold text-xs border-2 border-white shadow-lg cursor-pointer whitespace-nowrap active:scale-95 transition-transform shrink-0"
                  >
                    <Play className="w-3 h-3 fill-sky-950 text-sky-950" />
                    <span>MULAI [E]</span>
                  </button>
                )}
              </div>
            </div>

            {/* Top-Right: Clean Utility Controls (Only Volume & Menu) */}
            <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto shrink-0">
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  handleToggleSound();
                }}
                aria-label={soundMuted ? 'Aktifkan Suara' : 'Matikan Suara'}
                title={soundMuted ? 'Suara Mati' : 'Suara Aktif'}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-sky-950/90 hover:bg-sky-800 text-cyan-200 border-2 border-cyan-400/70 flex items-center justify-center text-sm font-bold cursor-pointer transition-transform active:scale-95 shadow-lg"
              >
                {soundMuted ? (
                  <VolumeX className="w-4 h-4 text-rose-300 stroke-[2.5]" />
                ) : (
                  <Volume2 className="w-4 h-4 text-cyan-200 stroke-[2.5]" />
                )}
              </button>

              <button
                type="button"
                tabIndex={-1}
                data-testid="hud-menu-button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  soundManager.playClick();
                  setPauseMenuConfirm(null);
                  setShellState('paused');
                }}
                aria-label="Buka Menu Permainan"
                title="Menu Permainan [P]"
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-sky-950/90 hover:bg-sky-800 text-cyan-100 border-2 border-cyan-400/70 flex items-center justify-center text-sm font-bold cursor-pointer transition-transform active:scale-95 shadow-lg"
              >
                <Menu className="w-4 h-4 text-cyan-200 stroke-[2.5]" />
              </button>
            </div>
          </div>

          {/* BOTTOM PERIMETER ROW: Left Virtual Joystick + Unobstructed Center Viewport + Right Action Buttons */}
          <div className="flex items-end justify-between gap-3">
            {/* Bottom-Left Virtual Joystick (Clean, no text) */}
            <VirtualJoystick joystickRef={joystickRef} />

            {/* Bottom-Right Mobile Adventure Controls: LARI, LOMPAT & Circular 3D Camera Radial Menu */}
            <div className="flex items-end gap-2.5 sm:gap-3 pointer-events-auto">
              {/* Circular Sprint (LARI) Button */}
              <button
                type="button"
                tabIndex={-1}
                data-testid="hud-sprint-button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  soundManager.playClick();
                  setIsSprinting((s) => !s);
                }}
                aria-label={isSprinting ? 'Matikan Lari' : 'Aktifkan Lari Cepat'}
                title={isSprinting ? 'Lari Cepat: Aktif [Shift]' : 'Lari Cepat [Shift]'}
                className={`w-12 h-12 sm:w-13 sm:h-13 rounded-full flex flex-col items-center justify-center border-2 transition-all cursor-pointer shadow-xl active:scale-90 ${
                  isSprinting
                    ? 'bg-emerald-400 text-sky-950 border-white shadow-[0_0_14px_rgba(52,211,153,0.7)] scale-105'
                    : 'bg-sky-950/90 hover:bg-sky-900 text-cyan-200 border-cyan-400/80 shadow-[0_4px_12px_rgba(3,43,67,0.6)]'
                }`}
              >
                <Zap className="w-4 h-4 stroke-[2.75]" />
                <span className="text-[9px] font-['Fredoka'] font-bold uppercase tracking-wider mt-0.5">
                  {isSprinting ? 'ON' : 'LARI'}
                </span>
              </button>

              {/* Circular Jump (LOMPAT) Button */}
              <button
                type="button"
                tabIndex={-1}
                data-testid="hud-jump-button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  setJumpSignal((n) => n + 1);
                }}
                aria-label="Lompat"
                title="Lompat [Space]"
                className="w-13 h-13 sm:w-15 sm:h-15 rounded-full bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-500 hover:from-yellow-200 hover:to-amber-400 text-sky-950 border-2 border-white flex flex-col items-center justify-center shadow-[0_0_16px_rgba(250,204,21,0.55)] cursor-pointer active:scale-90 transition-transform"
              >
                <ArrowUp className="w-5 h-5 stroke-[3]" />
                <span className="text-[9px] font-['Fredoka'] font-extrabold uppercase tracking-wider mt-0.5">
                  LOMPAT
                </span>
              </button>

              {/* Circular Camera Button & Radial Menu */}
              <CameraRadialMenu
                cameraControlRef={cameraControlRef}
                cameraPreset={cameraPreset}
                onPresetChange={setCameraPreset}
                isOpen={cameraRadialOpen}
                onToggleOpen={() => setCameraRadialOpen((v) => !v)}
              />
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: GAME MENU / SISTEM NAVIGASI KEMBALI ('paused')
          ===================================================================== */}
      {shellState === 'paused' && currentProfile && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu Permainan"
          className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-sky-950/85 backdrop-blur-xs pointer-events-auto"
        >
          <div className="w-full max-w-md bg-sky-900 border-4 border-cyan-400 rounded-3xl p-6 shadow-2xl space-y-5 text-center">
            <AquaLogoSvg compact className="h-12 w-auto mx-auto" />
            <div>
              <h2 className="text-2xl font-bold font-['Fredoka'] text-white">Menu Permainan</h2>
              <p className="text-xs text-cyan-200 mt-1">
                Petualang: <strong className="text-yellow-300">{currentProfile.name}</strong> ·
                Mode:{' '}
                <strong className="text-cyan-300">
                  {gameMode === 'solo' ? 'Solo Adventure' : 'Class Championship'}
                </strong>
              </p>
            </div>

            {/* Status Summary */}
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-sky-950 border border-cyan-500/40 rounded-2xl p-3">
                <div className="text-[10px] font-bold text-cyan-300 uppercase">
                  {gameMode === 'solo' ? 'SKOR TERBAIK SOLO' : 'SKOR RESMI CHAMPIONSHIP'}
                </div>
                <div className="text-lg font-extrabold font-mono text-yellow-300 tabular-nums mt-0.5">
                  {gameMode === 'solo'
                    ? currentProfile.solo.bestTotalScore
                    : currentProfile.championship.totalChampionshipScore}{' '}
                  / 1000
                </div>
              </div>
              <div className="bg-sky-950 border border-cyan-500/40 rounded-2xl p-3">
                <div className="text-[10px] font-bold text-cyan-300 uppercase">POSISI SAAT INI</div>
                <div className="text-lg font-extrabold font-mono text-cyan-200 tabular-nums mt-0.5">
                  POS {currentPosLocation.id} / 10
                </div>
              </div>
            </div>

            {/* Menu Options or Confirmation State */}
            {pauseMenuConfirm === 'title' ? (
              <div className="bg-sky-950/90 border-2 border-yellow-400/80 rounded-2xl p-4 space-y-3">
                <p className="text-sm font-bold text-white leading-relaxed">
                  Yakin ingin kembali ke halaman awal? Progres permainanmu tetap tersimpan.
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playClick();
                      setPauseMenuConfirm(null);
                    }}
                    className="py-2.5 rounded-xl bg-sky-800 hover:bg-sky-700 text-cyan-100 font-bold text-xs cursor-pointer border border-cyan-400/40"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    data-testid="confirm-return-title-btn"
                    onClick={() => {
                      soundManager.playClick();
                      setPauseMenuConfirm(null);
                      setShellState('title');
                    }}
                    className="py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-sky-950 font-['Fredoka'] font-bold text-xs cursor-pointer border border-white"
                  >
                    Ya, Kembali
                  </button>
                </div>
              </div>
            ) : pauseMenuConfirm === 'exit' ? (
              <div className="bg-sky-950/90 border-2 border-rose-400/80 rounded-2xl p-4 space-y-3">
                <p className="text-sm font-bold text-white leading-relaxed">
                  Yakin ingin keluar dan mengganti profil petualang atau mode bermain?
                </p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playClick();
                      setPauseMenuConfirm(null);
                    }}
                    className="py-2.5 rounded-xl bg-sky-800 hover:bg-sky-700 text-cyan-100 font-bold text-xs cursor-pointer border border-cyan-400/40"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    data-testid="confirm-exit-btn"
                    onClick={() => {
                      soundManager.playClick();
                      setPauseMenuConfirm(null);
                      setShellState('onboarding');
                    }}
                    className="py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-['Fredoka'] font-bold text-xs cursor-pointer border border-white"
                  >
                    Ya, Ganti Profil
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {/* 1. LANJUTKAN PERMAINAN */}
                <button
                  type="button"
                  data-testid="menu-resume-button"
                  onClick={() => {
                    soundManager.playClick();
                    setShellState('playing');
                  }}
                  className="w-full py-3 rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-sky-950 font-['Fredoka'] font-bold text-base border-2 border-white shadow-lg cursor-pointer flex items-center justify-center gap-2 transition-transform active:scale-95"
                >
                  <Play className="w-4 h-4 fill-sky-950 text-sky-950" />
                  <span>LANJUTKAN PERMAINAN</span>
                </button>

                {/* 2. KEMBALI KE PETA DUNIA */}
                <button
                  type="button"
                  data-testid="menu-map-button"
                  onClick={() => {
                    soundManager.playClick();
                    setShellState('playing');
                    setShowWorldMap(true);
                  }}
                  className="w-full py-2.5 rounded-2xl bg-sky-800 hover:bg-sky-700 text-cyan-100 font-bold text-sm border border-cyan-400/60 cursor-pointer flex items-center justify-center gap-2 transition-transform active:scale-95"
                >
                  <Map className="w-4 h-4 text-cyan-300" />
                  <span>KEMBALI KE PETA DUNIA</span>
                </button>

                {/* 3. KEMBALI KE HALAMAN AWAL */}
                <button
                  type="button"
                  data-testid="menu-title-button"
                  onClick={() => {
                    soundManager.playClick();
                    setPauseMenuConfirm('title');
                  }}
                  className="w-full py-2.5 rounded-2xl bg-sky-950 hover:bg-sky-800 text-cyan-200 font-bold text-sm border border-cyan-500/50 cursor-pointer flex items-center justify-center gap-2 transition-transform active:scale-95"
                >
                  <Home className="w-4 h-4 text-cyan-300" />
                  <span>KEMBALI KE HALAMAN AWAL</span>
                </button>

                {/* 4. KELUAR */}
                <button
                  type="button"
                  data-testid="menu-exit-button"
                  onClick={() => {
                    soundManager.playClick();
                    setPauseMenuConfirm('exit');
                  }}
                  className="w-full py-2 rounded-2xl bg-sky-950/80 hover:bg-rose-950/70 text-slate-300 hover:text-rose-200 font-bold text-xs border border-slate-700 hover:border-rose-500/60 cursor-pointer flex items-center justify-center gap-2 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>KELUAR / GANTI PROFIL</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: MISSION QUIZ (10 Multiple-Choice Questions per Location)
          ===================================================================== */}
      {activeQuizLocation && (
        <MissionQuizModal
          location={activeQuizLocation}
          mode={gameMode}
          onSubmitMission={handleMissionSubmit}
          onCancelMission={() => setActiveQuizLocation(null)}
        />
      )}

      {/* =====================================================================
          MODAL: MISSION RESULT & EXPLANATIONS ('gameover')
          ===================================================================== */}
      {missionResult && (
        <MissionResultModal
          summary={missionResult}
          onContinueAdventure={handleContinueFromResult}
          onOpenWorldMap={() => {
            setMissionResult(null);
            setShellState('playing');
            setShowWorldMap(true);
          }}
        />
      )}

      {/* =====================================================================
          MODAL: WORLD MAP & CLASS LEADERBOARD
          ===================================================================== */}
      {showWorldMap && currentProfile && (
        <WorldMapModal
          profile={currentProfile}
          allStudents={students}
          mode={gameMode}
          onTeleportToLocation={(locId) => {
            setTeleportTarget({ locationId: locId, timestamp: Date.now() });
            setShowWorldMap(false);
          }}
          onStartMissionDirectly={(loc) => {
            setShowWorldMap(false);
            handleTriggerInteract(loc);
          }}
          onSwitchMode={(nextMode) => {
            if (nextMode === 'solo' && !settings.soloAdventureOpen) {
              setToastNotice('Mode Solo Adventure sedang ditutup oleh Guru.');
              return;
            }
            if (nextMode === 'championship' && !settings.championshipOpen) {
              setToastNotice('Sesi Class Championship sedang ditutup oleh Guru.');
              return;
            }
            setGameMode(nextMode);
            setActiveGameMode(nextMode);
          }}
          onClose={() => setShowWorldMap(false)}
        />
      )}

      {/* =====================================================================
          MODAL: HOW TO PLAY GUIDE (Contains All Control Instructions)
          ===================================================================== */}
      {showHowToPlay && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Petunjuk Cara Bermain Aqua Math Adventure"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-sky-950/90 pointer-events-auto"
        >
          <div className="w-full max-w-2xl bg-sky-900 border-4 border-cyan-400 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-cyan-500/40 pb-3">
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-5 h-5 text-yellow-300 stroke-[2.5]" />
                <h2 className="text-xl font-bold font-['Fredoka'] text-yellow-300">
                  Petunjuk Bermain Aqua Math Adventure
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowHowToPlay(false)}
                className="px-3 py-1 rounded-xl bg-sky-800 text-xs font-bold text-white cursor-pointer"
              >
                Tutup
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-cyan-100 leading-relaxed">
              <p>
                <strong>1. Masuk dengan Kode Kelas:</strong> Gunakan Kode Akses dari Guru (contoh:{' '}
                <code className="text-yellow-300 font-bold">{settings.accessCode}</code>) dan
                ketik namamu sendiri. Pilih karakter petualangmu: <strong>Bima</strong>,{' '}
                <strong>Sinta</strong> (berhijab), atau <strong>Kirana</strong>!
              </p>
              <p>
                <strong>2. Dua Mode dengan Poin Terpisah:</strong>
                <br />• <strong>Solo Adventure:</strong> Bermain mandiri dan ulangi misi untuk
                meningkatkan <em>Best Score</em> dan <em>Latest Score</em>.
                <br />• <strong>Class Championship:</strong> Kompetisi resmi kelas untuk meraih{' '}
                <em>Championship Score</em>, Juara Level, dan <em>Grand Champion</em>!
              </p>
              <p>
                <strong>3. Kendali Petualangan 3D & Kamera Orbit 360°:</strong>
                <br />• Di <strong>Smartphone/Tablet</strong>: Gunakan <strong>Joystick Kiri</strong>{' '}
                untuk menggerakkan karakter, <strong>sentuh & geser layar kanan</strong> untuk memutar kamera 360° (melihat depan, belakang, kiri, kanan karakter), serta <strong>cubit 2 jari (pinch)</strong> untuk Zoom In/Out.
                <br />• Di <strong>Komputer/Laptop</strong>: Gunakan <strong>WASD</strong>{' '}
                atau <strong>Panah</strong> untuk bergerak mengikuti arah kamera, <strong>Klik Kiri + Geser Mouse</strong> untuk memutar kamera 360°, <strong>Scroll Wheel</strong> untuk Zoom In/Out, dan tombol <strong>R</strong> untuk Reset Kamera.
                <br />• Tekan <strong>Tombol Kamera Bulat</strong> di kanan bawah untuk membuka <strong>Menu Radial</strong> (Zoom In, Zoom Out, Wide View, Normal View, dan Reset Kamera).
              </p>
              <p>
                <strong>4. 5 Level & 10 Lokasi Misi (100 Soal Unik):</strong> Setiap lokasi memiliki
                10 soal pilihan ganda (A, B, C, D). Setiap jawaban benar bernilai 10 poin (Maksimal
                100 poin per lokasi, 200 poin per level, 1.000 poin untuk seluruh petualangan).
              </p>
            </div>

            <div className="text-right pt-2">
              <button
                type="button"
                onClick={() => setShowHowToPlay(false)}
                className="px-6 py-2.5 rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-sky-950 font-['Fredoka'] font-bold text-sm cursor-pointer"
              >
                Mengerti, Ayo Mulai!
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
