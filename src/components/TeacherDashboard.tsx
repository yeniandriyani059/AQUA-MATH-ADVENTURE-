import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Crown,
  Database,
  Download,
  Eye,
  Filter,
  KeyRound,
  Map,
  Medal,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { CHARACTERS, LEVELS, MISSION_LOCATIONS } from '../data/locations';
import { buildChampionshipLeaderboard, getLevelChampion } from '../game/rules';
import {
  deleteStudentProfile,
  isTeacherAdminLoggedIn,
  loginTeacherAdmin,
  logoutTeacherAdmin,
  registerTeacherAdmin,
  resetAllChampionshipScores,
  resetToDemoSeedData,
  saveClassSettings,
  saveStudents,
} from '../services/gameStorage';
import {
  adminAddBatchStudents,
  adminAddSingleStudent,
  adminDeleteStudent,
  adminToggleStudentActive,
  ensureActiveChampionshipSession,
  executeResetStudentScoresAndProgress,
  exportResetGameDataBackup,
  findOfficialStudentSpec,
  flushOfflineSyncQueue,
  getResetGameDataPreview,
  getTeacherDashboardData,
  mapCharacterIdToDbCharacter,
  OFFICIAL_14_STUDENTS,
  requestTeacherPasswordReset,
  ResetGameDataOptions,
  ResetGameDataPreview,
  resetStudentPasswordByTeacher,
  studentUsernameToInternalEmail,
  syncOfficial14StudentAccounts,
  updateTeacherNewPassword,
  verifyTeacherRecoverySession,
} from '../services/supabaseService';
import { supabase, isSupabaseConfigured, SUPABASE_SCHEMA_SQL } from '../services/supabaseClient';
import { CharacterId, ClassSettings, StudentProfile } from '../types/game';
import { soundManager } from '../utils/sound';
import { AquaLogoSvg, CharacterAvatarSvg, MedalBadgeSvg } from './AquaLogoSvg';

interface TeacherDashboardProps {
  settings: ClassSettings;
  students: StudentProfile[];
  initialRecoveryMode?: boolean;
  onCompletePasswordRecovery?: () => void;
  onUpdateSettings: (next: ClassSettings) => void;
  onUpdateStudents: (next: StudentProfile[]) => void;
  onCloseToTitle: () => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  settings,
  students,
  initialRecoveryMode = false,
  onCompletePasswordRecovery,
  onUpdateSettings,
  onUpdateStudents,
  onCloseToTitle,
}) => {
  const [authenticated, setAuthenticated] = useState<boolean>(false);
  useEffect(() => {
    if (initialRecoveryMode) return;
    let alive = true;
    let revision = 0;
    const check = async () => {
      const current = ++revision;
      const valid = await isTeacherAdminLoggedIn();
      if (alive && current === revision) setAuthenticated(valid);
    };
    void check();
    const onFocus = () => { void check(); };
    window.addEventListener('focus', onFocus);
    const timer = window.setInterval(onFocus, 30000);
    const subscription = supabase?.auth.onAuthStateChange(() => {
      // Supabase Auth callbacks must not await another Auth operation.
      queueMicrotask(onFocus);
    });
    return () => {
      alive = false;
      window.removeEventListener('focus', onFocus);
      window.clearInterval(timer);
      subscription?.data.subscription.unsubscribe();
    };
  }, [initialRecoveryMode]);
  const [authTab, setAuthTab] = useState<
    'login' | 'register' | 'forgot_password' | 'update_password'
  >(initialRecoveryMode ? 'update_password' : 'login');
  const [teacherNameInput, setTeacherNameInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [resetEmailInput, setResetEmailInput] = useState('');
  const [loginPasswordInput, setLoginPasswordInput] = useState('');
  const [newTeacherPasswordInput, setNewTeacherPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSuccessMessage, setLoginSuccessMessage] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Verified recovery session state (populated exclusively from supabase.auth.getUser())
  const [isVerifyingRecovery, setIsVerifyingRecovery] = useState<boolean>(initialRecoveryMode);
  const [verifiedRecoveryEmail, setVerifiedRecoveryEmail] = useState<string | null>(null);
  const [verifiedRecoveryUserId, setVerifiedRecoveryUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const runVerifyRecovery = async () => {
      setAuthenticated(false);
      setAuthTab('update_password');
      setLoginError(null);
      setLoginSuccessMessage(null);
      setIsVerifyingRecovery(true);
      setVerifiedRecoveryEmail(null);
      setVerifiedRecoveryUserId(null);

      const res = await verifyTeacherRecoverySession();
      if (!active) return;

      setIsVerifyingRecovery(false);
      if (res.ok && res.email && res.userId) {
        setVerifiedRecoveryEmail(res.email);
        setVerifiedRecoveryUserId(res.userId);
      } else {
        setLoginError(
          res.message ||
            'Identitas akun untuk pemulihan password tidak dapat diverifikasi. Silakan kirim ulang tautan pemulihan password.',
        );
      }
    };

    if (initialRecoveryMode) {
      runVerifyRecovery();
    }

    return () => {
      active = false;
    };
  }, [initialRecoveryMode]);

  const [activeTab, setActiveTab] = useState<
    | 'monitoring'
    | 'controls'
    | 'assessments'
    | 'progress'
    | 'leaderboard'
    | 'accounts'
  >('monitoring');

  // Password reset modal state for teacher
  const [resetTargetStudent, setResetTargetStudent] = useState<StudentProfile | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetModalError, setResetModalError] = useState<string | null>(null);

  // Reset Game Data Modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetOptions, setResetOptions] = useState<ResetGameDataOptions>({
    studentId: 'ALL',
    modeScope: 'ALL',
  });
  const [resetPreview, setResetPreview] = useState<ResetGameDataPreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isExecutingReset, setIsExecutingReset] = useState(false);
  const [isDownloadingBackup, setIsDownloadingBackup] = useState(false);
  const [confirmCheckbox, setConfirmCheckbox] = useState(false);
  const [confirmInputText, setConfirmInputText] = useState('');
  const [resetErrorMsg, setResetErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!showResetModal) return;
    let isSubscribed = true;
    setIsLoadingPreview(true);
    setResetErrorMsg(null);
    getResetGameDataPreview(resetOptions)
      .then((res) => {
        if (isSubscribed) {
          if (res.ok && res.preview) {
            setResetPreview(res.preview);
          } else if (res.message) {
            setResetErrorMsg(res.message);
          }
          setIsLoadingPreview(false);
        }
      })
      .catch((err) => {
        if (isSubscribed) {
          setResetErrorMsg(err?.message || 'Gagal memuat preview reset data.');
          setIsLoadingPreview(false);
        }
      });
    return () => {
      isSubscribed = false;
    };
  }, [showResetModal, resetOptions.studentId, resetOptions.modeScope]);

  const handleDownloadBackup = async () => {
    soundManager.playClick();
    setIsDownloadingBackup(true);
    setResetErrorMsg(null);
    try {
      const res = await exportResetGameDataBackup(resetOptions);
      if (res.ok && res.backupJson) {
        const blob = new Blob([res.backupJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.fileName || 'AQUA_MATH_BACKUP.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setStatusBanner(`File cadangan ${res.fileName} berhasil diunduh!`);
      } else {
        setResetErrorMsg(res.message || 'Gagal membuat file cadangan.');
      }
    } catch (err: any) {
      setResetErrorMsg(err?.message || 'Terjadi kesalahan saat mengunduh cadangan.');
    } finally {
      setIsDownloadingBackup(false);
    }
  };

  const handleExecuteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.playClick();
    if (!confirmCheckbox) {
      setResetErrorMsg('Anda harus mencentang persetujuan terlebih dahulu.');
      return;
    }
    if (confirmInputText.trim().toUpperCase() !== 'RESET') {
      setResetErrorMsg('Ketik "RESET" dengan huruf besar untuk mengonfirmasi.');
      return;
    }

    setIsExecutingReset(true);
    setResetErrorMsg(null);

    try {
      const res = await executeResetStudentScoresAndProgress(resetOptions);
      if (res.ok) {
        if (res.updatedStudents) {
          onUpdateStudents(res.updatedStudents);
        }
        setStatusBanner(res.message);
        setShowResetModal(false);
        setConfirmCheckbox(false);
        setConfirmInputText('');
        setResetPreview(null);
      } else {
        setResetErrorMsg(res.message || 'Gagal mereset data permainan.');
      }
    } catch (err: any) {
      setResetErrorMsg(err?.message || 'Terjadi kesalahan saat mereset data.');
    } finally {
      setIsExecutingReset(false);
    }
  };

  // Student roster registration state (Tab 6)
  const [addStudentFormMode, setAddStudentFormMode] = useState<'none' | 'single' | 'batch'>('none');
  const [singleStudentNameInput, setSingleStudentNameInput] = useState('');
  const [singleStudentUsernameInput, setSingleStudentUsernameInput] = useState('');
  const [singleStudentPasswordInput, setSingleStudentPasswordInput] = useState('');
  const [batchStudentNamesInput, setBatchStudentNamesInput] = useState('');
  const [newStudentCharacter, setNewStudentCharacter] = useState<CharacterId>('sinta');
  const [isAddingStudents, setIsAddingStudents] = useState(false);
  const [isSyncing14Students, setIsSyncing14Students] = useState(false);
  const [studentFormError, setStudentFormError] = useState<string | null>(null);
  const [deleteConfirmStudentId, setDeleteConfirmStudentId] = useState<string | null>(null);
  const [showCredentialSheetModal, setShowCredentialSheetModal] = useState(false);
  const [showRlsSqlModal, setShowRlsSqlModal] = useState(false);

  const [participantSearch, setParticipantSearch] = useState('');
  const [participantLevelFilter, setParticipantLevelFilter] = useState<number | 'all'>('all');
  const [participantStatusFilter, setParticipantStatusFilter] = useState<
    'all' | 'finished' | 'playing' | 'joined'
  >('all');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(students[0]?.id || null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [accessCodeDraft, setAccessCodeDraft] = useState(settings.accessCode);
  const [sessionNameDraft, setSessionNameDraft] = useState(settings.championshipSessionName);
  const [classNameDraft, setClassNameDraft] = useState(settings.className);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadRealSupabaseData = async () => {
    setIsRefreshing(true);
    await flushOfflineSyncQueue().catch(() => {});
    const data = await getTeacherDashboardData();
    if (data.supabaseConnected) {
      saveStudents(data.students);
      onUpdateStudents(data.students);
      if (data.students.length > 0) {
        setStatusBanner(
          `Data berhasil disinkronkan dari database Supabase! (${data.students.length} siswa, ${data.totalAttemptsCount} riwayat percobaan).`,
        );
      } else {
        setStatusBanner('Terhubung ke Supabase. Belum ada data siswa tersimpan.');
      }
    }
    setIsRefreshing(false);
  };

  useEffect(() => {
    if (authenticated) {
      loadRealSupabaseData();
    }
  }, [authenticated]);

  const leaderboard = buildChampionshipLeaderboard(students);

  const getStudentStatus = (s: StudentProfile): 'finished' | 'playing' | 'joined' => {
    const totalCompleted = Math.max(
      Object.keys(s.solo.locations).length,
      Object.keys(s.championship.locations).length,
    );
    if (totalCompleted >= 10 || s.championship.completedLevels.length >= 5) {
      return 'finished';
    }
    if (
      s.solo.latestTotalScore > 0 ||
      s.championship.totalChampionshipScore > 0 ||
      totalCompleted > 0
    ) {
      return 'playing';
    }
    return 'joined';
  };

  const filteredStudents = students.filter((s) => {
    if (participantSearch.trim()) {
      const q = participantSearch.toLowerCase();
      if (!s.name.toLowerCase().includes(q)) return false;
    }
    const maxLvl = Math.max(s.solo.unlockedLevel, s.championship.unlockedLevel);
    if (participantLevelFilter !== 'all' && maxLvl < participantLevelFilter) {
      return false;
    }
    const status = getStudentStatus(s);
    if (participantStatusFilter !== 'all' && status !== participantStatusFilter) {
      return false;
    }
    return true;
  });

  const selectedStudent =
    students.find((s) => s.id === selectedStudentId) || students[0] || null;

  const finishedCount = students.filter((s) => getStudentStatus(s) === 'finished').length;
  const playingCount = students.filter((s) => getStudentStatus(s) === 'playing').length;
  const joinedCount = students.filter((s) => getStudentStatus(s) === 'joined').length;

  const totalChampScore = students.reduce(
    (acc, s) => acc + s.championship.totalChampionshipScore,
    0,
  );
  const avgChampScore = students.length > 0 ? Math.round(totalChampScore / students.length) : 0;
  const avgGrade = Math.round(avgChampScore / 10);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.playClick();
    setLoginError(null);
    setLoginSuccessMessage(null);
    setIsLoggingIn(true);

    try {
      if (authTab === 'forgot_password') {
        if (!resetEmailInput.trim() || !resetEmailInput.includes('@')) {
          setLoginError('Masukkan alamat email guru yang valid.');
          return;
        }
        const res = await requestTeacherPasswordReset(resetEmailInput.trim());
        if (res.ok) {
          setLoginSuccessMessage(res.message);
          setResetEmailInput('');
        } else {
          setLoginError(res.message);
        }
        return;
      }

      if (authTab === 'update_password') {
        if (!verifiedRecoveryEmail || !verifiedRecoveryUserId) {
          setLoginError(
            'Identitas akun belum terverifikasi. Tidak diizinkan memperbarui password tanpa sesi pemulihan Supabase yang sah.',
          );
          return;
        }
        if (newTeacherPasswordInput.length < 6) {
          setLoginError('Password baru minimal harus terdiri dari 6 karakter.');
          return;
        }
        if (newTeacherPasswordInput !== confirmPasswordInput) {
          setLoginError('Konfirmasi password tidak cocok dengan password baru.');
          return;
        }
        const res = await updateTeacherNewPassword(
          newTeacherPasswordInput,
          verifiedRecoveryEmail,
          verifiedRecoveryUserId,
        );
        if (res.ok) {
          setNewTeacherPasswordInput('');
          setConfirmPasswordInput('');
          onCompletePasswordRecovery?.();
          if (
            typeof window !== 'undefined' &&
            (window.location.hash.includes('type=recovery') ||
              window.location.hash.includes('access_token=') ||
              window.location.search.includes('code=') ||
              window.location.search.includes('token_hash='))
          ) {
            window.history.replaceState(null, '', window.location.pathname);
          }
          if (res.profileSyncWarning) {
            setStatusBanner(res.profileSyncWarning);
          } else {
            setStatusBanner(res.message);
          }
          // Password recovery does not itself grant administrative authorization.
          const authorized = await isTeacherAdminLoggedIn();
          setAuthenticated(authorized);
          if (!authorized) {
            setAuthTab('login');
            setLoginError('Password diperbarui, tetapi kewenangan guru belum dapat diverifikasi. Silakan login kembali.');
          }
        } else {
          setLoginError(res.message);
        }
        return;
      }

      if (authTab === 'register') {
        if (!teacherNameInput.trim()) {
          setLoginError('Nama lengkap guru wajib diisi.');
          return;
        }
        if (!usernameInput.trim()) {
          setLoginError('Email atau Username guru wajib diisi.');
          return;
        }
        if (newTeacherPasswordInput !== confirmPasswordInput) {
          setLoginError('Konfirmasi password tidak cocok dengan password.');
          return;
        }
        const res = await registerTeacherAdmin({
          name: teacherNameInput,
          username: usernameInput,
          password: newTeacherPasswordInput,
          confirmPassword: confirmPasswordInput,
        });
        if (res.ok) {
          setAuthenticated(true);
          setNewTeacherPasswordInput('');
          setConfirmPasswordInput('');
        } else {
          setLoginError(res.message || 'Pendaftaran guru gagal. Silakan coba lagi.');
        }
      } else {
        if (!usernameInput.trim() || !loginPasswordInput) {
          setLoginError('Email/Username dan password guru wajib diisi.');
          return;
        }
        const res = await loginTeacherAdmin(usernameInput, loginPasswordInput);
        if (res.ok) {
          setAuthenticated(true);
          setLoginPasswordInput('');
        } else {
          setLoginError(
            res.message || 'Login guru gagal. Silakan periksa kembali email dan password.',
          );
        }
      }
    } catch (err: any) {
      setLoginError(err?.message || 'Terjadi kesalahan sistem pada autentikasi guru.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSaveAccessSettings = (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.playClick();
    const cleanedCode = accessCodeDraft.trim().toUpperCase() || 'AQUA2026';
    const next = saveClassSettings({
      ...settings,
      accessCode: cleanedCode,
      championshipSessionName: sessionNameDraft.trim() || settings.championshipSessionName,
      className: classNameDraft.trim() || settings.className,
    });
    onUpdateSettings(next);
    ensureActiveChampionshipSession(next.championshipSessionName).catch(() => {});
    setStatusBanner('Pengaturan Kode Akses & Kelas berhasil disimpan!');
  };

  const toggleSettingFlag = (
    key: 'accessCodeActive' | 'soloAdventureOpen' | 'championshipOpen',
  ) => {
    soundManager.playClick();
    const next = saveClassSettings({
      ...settings,
      [key]: !settings[key],
    });
    onUpdateSettings(next);
    if (key === 'championshipOpen' && next.championshipOpen) {
      ensureActiveChampionshipSession(next.championshipSessionName).catch(() => {});
    }
    setStatusBanner('Status akses permainan berhasil diperbarui.');
  };

  const handleExportCsv = () => {
    soundManager.playClick();
    const headers = [
      'Nama Siswa',
      'Karakter',
      'Solo Latest Score (1000)',
      'Solo Best Score (1000)',
      'Nilai Akademik Solo (100)',
      'Level Terbuka Solo',
      'Championship Score (1000)',
      'Nilai Akademik Championship (100)',
      'Waktu Championship (Detik)',
      'Level Selesai Championship',
    ];
    const rows = students.map((s) => [
      `"${s.name}"`,
      s.characterId,
      s.solo.latestTotalScore,
      s.solo.bestTotalScore,
      s.solo.academicGrade,
      s.solo.unlockedLevel,
      s.championship.totalChampionshipScore,
      s.championship.academicGrade,
      s.championship.totalTimeSeconds,
      s.championship.completedLevels.length,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Asesmen_Aqua_Math_Adventure_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!authenticated) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Portal Guru"
        className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-sky-950/90 pointer-events-auto"
      >
        <div className="w-full max-w-[500px] bg-sky-900 border-4 border-cyan-400 rounded-3xl shadow-2xl overflow-hidden my-auto">
          {/* Header */}
          <div className="bg-sky-950 px-6 py-4 border-b border-cyan-500/40 flex items-center justify-between">
            <AquaLogoSvg compact className="h-10 w-auto" />
            <button
              type="button"
              onClick={() => {
                soundManager.playClick();
                onCloseToTitle();
              }}
              className="px-3.5 py-1.5 rounded-xl bg-sky-800 hover:bg-sky-700 text-xs font-bold text-cyan-100 cursor-pointer border border-cyan-400/30"
            >
              Tutup
            </button>
          </div>

          {/* Tab Switcher: LOGIN GURU vs DAFTAR AKUN GURU */}
          <div className="flex border-b border-cyan-500/30 bg-sky-950/60 p-1.5 gap-1.5">
            <button
              type="button"
              onClick={() => {
                soundManager.playClick();
                setAuthTab('login');
                setLoginError(null);
                setLoginSuccessMessage(null);
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-['Fredoka'] font-bold cursor-pointer transition-colors ${
                authTab === 'login'
                  ? 'bg-yellow-400 text-sky-950 shadow-md'
                  : 'text-cyan-200 hover:bg-sky-900/60'
              }`}
            >
              MASUK GURU
            </button>
            <button
              type="button"
              onClick={() => {
                soundManager.playClick();
                setAuthTab('register');
                setLoginError(null);
                setLoginSuccessMessage(null);
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-['Fredoka'] font-bold cursor-pointer transition-colors ${
                authTab === 'register'
                  ? 'bg-yellow-400 text-sky-950 shadow-md'
                  : 'text-cyan-200 hover:bg-sky-900/60'
              }`}
            >
              DAFTAR AKUN GURU
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleLoginSubmit} className="p-6 sm:p-7 space-y-4">
            <div>
              <h2 className="text-xl font-bold font-['Fredoka'] text-white">
                {authTab === 'register'
                  ? 'PENDAFTARAN AKUN GURU'
                  : authTab === 'forgot_password'
                    ? 'PEMULIHAN PASSWORD GURU'
                    : authTab === 'update_password'
                      ? 'ATUR PASSWORD BARU GURU'
                      : 'PORTAL MASUK GURU'}
              </h2>
              <p className="text-xs text-cyan-200 mt-1">
                {authTab === 'register'
                  ? 'Buat akun guru permanen untuk mengelola kelas dan asesmen.'
                  : authTab === 'forgot_password'
                    ? 'Masukkan email akun guru untuk menerima tautan pemulihan password.'
                    : authTab === 'update_password'
                      ? 'Masukkan password baru untuk akun guru Anda.'
                      : 'Silakan masuk untuk mengelola permainan dan melihat hasil asesmen.'}
              </p>
            </div>

            {loginError && (
              <div
                role="alert"
                className="p-3.5 rounded-2xl bg-rose-950 border-2 border-rose-400 text-xs font-bold text-rose-100 flex items-center gap-2.5"
              >
                <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            {loginSuccessMessage && (
              <div
                role="status"
                className="p-3.5 rounded-2xl bg-emerald-950 border-2 border-emerald-400 text-xs font-bold text-emerald-100 flex items-center gap-2.5"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                <span>{loginSuccessMessage}</span>
              </div>
            )}

            {authTab === 'forgot_password' && (
              <div>
                <label
                  htmlFor="teacher-reset-email"
                  className="block text-xs font-bold text-cyan-100 mb-1"
                >
                  Email Akun Guru Terdaftar
                </label>
                <input
                  id="teacher-reset-email"
                  type="email"
                  required
                  value={resetEmailInput}
                  onChange={(e) => setResetEmailInput(e.target.value)}
                  placeholder="Contoh: guru@email.com"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-sky-950 border-2 border-cyan-400/80 text-white font-bold text-sm focus:outline-none focus:border-yellow-400"
                />
              </div>
            )}

            {authTab === 'register' && (
              <div>
                <label
                  htmlFor="teacher-full-name"
                  className="block text-xs font-bold text-cyan-100 mb-1"
                >
                  Nama Lengkap Guru (dengan Gelar)
                </label>
                <input
                  id="teacher-full-name"
                  type="text"
                  required
                  value={teacherNameInput}
                  onChange={(e) => setTeacherNameInput(e.target.value)}
                  placeholder="Contoh: Ibu Ani Rahmawati, S.Pd."
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-sky-950 border-2 border-cyan-400/80 text-white font-bold text-sm focus:outline-none focus:border-yellow-400"
                />
              </div>
            )}

            {(authTab === 'login' || authTab === 'register') && (
              <div>
                <label
                  htmlFor="teacher-username"
                  className="block text-xs font-bold text-cyan-100 mb-1"
                >
                  Email / Username Guru
                </label>
                <input
                  id="teacher-username"
                  type="text"
                  required
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="Masukkan email atau username guru..."
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-sky-950 border-2 border-cyan-400/80 text-white font-bold text-sm focus:outline-none focus:border-yellow-400"
                />
              </div>
            )}

            {authTab === 'update_password' && (
              <div className="p-3.5 rounded-2xl bg-sky-950 border-2 border-cyan-400/70 text-xs font-bold text-cyan-100">
                {isVerifyingRecovery ? (
                  <span>Memverifikasi identitas sesi pemulihan password...</span>
                ) : verifiedRecoveryEmail ? (
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0" />
                    <span>
                      Mengatur password untuk akun:{' '}
                      <strong className="text-yellow-300 font-mono">{verifiedRecoveryEmail}</strong>
                    </span>
                  </div>
                ) : (
                  <span className="text-rose-200">
                    Identitas akun tidak terverifikasi. Silakan minta tautan pemulihan baru melalui menu Lupa Password.
                  </span>
                )}
              </div>
            )}

            {authTab === 'login' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="teacher-login-password"
                    className="block text-xs font-bold text-cyan-100"
                  >
                    Password Guru
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playClick();
                      setAuthTab('forgot_password');
                      setLoginError(null);
                      setLoginSuccessMessage(null);
                    }}
                    className="text-xs font-bold text-yellow-300 hover:text-yellow-200 underline cursor-pointer"
                  >
                    Lupa Password?
                  </button>
                </div>
                <input
                  id="teacher-login-password"
                  name="teacher-login-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={loginPasswordInput}
                  onChange={(e) => setLoginPasswordInput(e.target.value)}
                  placeholder="Masukkan password..."
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-sky-950 border-2 border-cyan-400/80 text-white font-bold text-sm focus:outline-none focus:border-yellow-400"
                />
              </div>
            )}

            {(authTab === 'register' ||
              (authTab === 'update_password' && verifiedRecoveryEmail && !isVerifyingRecovery)) && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="teacher-new-password"
                    className="block text-xs font-bold text-cyan-100"
                  >
                    {authTab === 'update_password' ? 'Password Baru' : 'Password Guru'}
                  </label>
                </div>
                <input
                  id="teacher-new-password"
                  name="teacher-new-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={newTeacherPasswordInput}
                  onChange={(e) => setNewTeacherPasswordInput(e.target.value)}
                  placeholder={
                    authTab === 'update_password'
                      ? 'Masukkan password baru (min. 6 karakter)...'
                      : 'Masukkan password (min. 6 karakter)...'
                  }
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-sky-950 border-2 border-cyan-400/80 text-white font-bold text-sm focus:outline-none focus:border-yellow-400"
                />
              </div>
            )}

            {(authTab === 'register' ||
              (authTab === 'update_password' && verifiedRecoveryEmail && !isVerifyingRecovery)) && (
              <div>
                <label
                  htmlFor="teacher-confirm-password"
                  className="block text-xs font-bold text-cyan-100 mb-1"
                >
                  Konfirmasi Password
                </label>
                <input
                  id="teacher-confirm-password"
                  name="teacher-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  placeholder="Ulangi password..."
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-sky-950 border-2 border-cyan-400/80 text-white font-bold text-sm focus:outline-none focus:border-yellow-400"
                />
              </div>
            )}

            {!(authTab === 'update_password' && (!verifiedRecoveryEmail || isVerifyingRecovery)) && (
              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-3.5 rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-sky-950 font-['Fredoka'] font-bold text-base border-2 border-white shadow-lg cursor-pointer flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50 mt-2"
              >
                <span>
                  {isLoggingIn
                    ? 'Memproses...'
                    : authTab === 'register'
                      ? 'Daftar Akun Guru & Masuk'
                      : authTab === 'forgot_password'
                        ? 'Kirim Tautan Pemulihan Password'
                        : authTab === 'update_password'
                          ? 'Simpan Password Baru'
                          : 'Masuk ke Dashboard Guru'}
                </span>
                <ArrowRight className="w-5 h-5 stroke-[2.75]" />
              </button>
            )}

            {(authTab === 'forgot_password' || authTab === 'update_password') && (
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playClick();
                    setAuthTab('login');
                    setLoginError(null);
                    setLoginSuccessMessage(null);
                  }}
                  className="text-xs font-bold text-cyan-200 hover:text-white underline cursor-pointer"
                >
                  Kembali ke Halaman Login Guru
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Dashboard Guru Pengendali Utama"
      className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-5 bg-sky-950/95 overflow-y-auto pointer-events-auto"
    >
      <div className="w-full max-w-6xl bg-sky-900 border-4 border-cyan-400 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[94vh] flex flex-col">
        {/* Top Bar */}
        <div className="bg-sky-950 px-6 py-4 border-b-2 border-cyan-500/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <AquaLogoSvg compact className="h-11 w-auto" />
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-yellow-300">
                DASHBOARD GURU (ADMIN) · {settings.className}
              </div>
              <h2 className="text-lg sm:text-xl font-bold font-['Fredoka'] text-white">
                Pusat Kendali Akses, Asesmen & Kompetisi Kelas
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                soundManager.playClick();
                loadRealSupabaseData();
              }}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-800 hover:bg-sky-700 text-cyan-200 text-xs font-bold border border-cyan-400/50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-300 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Menyingkronkan...' : 'Sinkron Data'}</span>
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-sky-950 text-xs font-bold cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Unduh Laporan CSV</span>
            </button>
            <button
              type="button"
              onClick={() => {
                soundManager.playClick();
                logoutTeacherAdmin();
                setAuthenticated(false);
              }}
              className="px-3.5 py-2 rounded-xl bg-sky-800 hover:bg-sky-700 text-cyan-100 text-xs font-bold border border-cyan-400/40 cursor-pointer"
            >
              Logout Guru
            </button>
            <button
              type="button"
              onClick={() => {
                soundManager.playClick();
                onCloseToTitle();
              }}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
            >
              Ke Game 3D
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-sky-950/70 px-6 py-2.5 border-b border-cyan-500/30 flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('monitoring')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
              activeTab === 'monitoring'
                ? 'bg-yellow-400 text-sky-950'
                : 'bg-sky-900 text-cyan-100 hover:bg-sky-800'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>1. Pemantauan Siswa & Grafik</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('controls')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
              activeTab === 'controls'
                ? 'bg-yellow-400 text-sky-950'
                : 'bg-sky-900 text-cyan-100 hover:bg-sky-800'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>2. Kontrol Kode Akses & Mode</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('assessments')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
              activeTab === 'assessments'
                ? 'bg-yellow-400 text-sky-950'
                : 'bg-sky-900 text-cyan-100 hover:bg-sky-800'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>3. Hasil Asesmen Siswa ({students.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('progress')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
              activeTab === 'progress'
                ? 'bg-yellow-400 text-sky-950'
                : 'bg-sky-900 text-cyan-100 hover:bg-sky-800'
            }`}
          >
            <Map className="w-3.5 h-3.5" />
            <span>4. Progres 5 Level & 10 Lokasi</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('leaderboard')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
              activeTab === 'leaderboard'
                ? 'bg-yellow-400 text-sky-950'
                : 'bg-sky-900 text-cyan-100 hover:bg-sky-800'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>5. Leaderboard Class Championship</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('accounts')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
              activeTab === 'accounts'
                ? 'bg-yellow-400 text-sky-950'
                : 'bg-sky-900 text-cyan-100 hover:bg-sky-800'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>6. Akun Siswa & Reset Password</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {statusBanner && (
            <div className="p-3 rounded-xl bg-emerald-950 border border-emerald-400 text-emerald-200 text-xs font-bold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{statusBanner}</span>
              </span>
              <button
                type="button"
                onClick={() => setStatusBanner(null)}
                className="text-emerald-300 underline cursor-pointer"
              >
                Tutup
              </button>
            </div>
          )}

          {/* TAB 1: PARTICIPANT MONITORING & CHARTS */}
          {activeTab === 'monitoring' && (
            <div className="space-y-5">
              {/* 4 Real Metric Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-sky-950 border-2 border-cyan-500/50 rounded-2xl p-4">
                  <div className="flex items-center justify-between text-xs font-bold text-cyan-300">
                    <span>TOTAL SISWA</span>
                    <Users className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="text-2xl font-extrabold font-mono text-white mt-1">
                    {students.length} Siswa
                  </div>
                  <div className="text-[11px] text-cyan-200 mt-1">
                    Kelas: <strong className="text-yellow-300">{settings.className}</strong>
                  </div>
                </div>

                <div className="bg-sky-950 border-2 border-yellow-400/50 rounded-2xl p-4">
                  <div className="flex items-center justify-between text-xs font-bold text-yellow-300">
                    <span>AKTIF BERMAIN</span>
                    <Activity className="w-4 h-4 text-yellow-400" />
                  </div>
                  <div className="text-2xl font-extrabold font-mono text-yellow-300 mt-1">
                    {playingCount} Siswa
                  </div>
                  <div className="text-[11px] text-cyan-200 mt-1">
                    Sedang aktif menyelesaikan misi
                  </div>
                </div>

                <div className="bg-sky-950 border-2 border-emerald-400/50 rounded-2xl p-4">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-300">
                    <span>SELESAI 10 MISI</span>
                    <UserCheck className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-extrabold font-mono text-emerald-300 mt-1">
                    {finishedCount} Siswa
                  </div>
                  <div className="text-[11px] text-cyan-200 mt-1">
                    Tuntas seluruh level Aqua City
                  </div>
                </div>

                <div className="bg-sky-950 border-2 border-sky-400/50 rounded-2xl p-4">
                  <div className="flex items-center justify-between text-xs font-bold text-cyan-200">
                    <span>RATA-RATA KELAS</span>
                    <Trophy className="w-4 h-4 text-yellow-300" />
                  </div>
                  <div className="text-2xl font-extrabold font-mono text-white mt-1">
                    {avgChampScore} <span className="text-xs font-normal text-cyan-300">/ 1000</span>
                  </div>
                  <div className="text-[11px] text-emerald-300 mt-1">
                    Nilai Rata-rata: <strong className="font-mono">{avgGrade} / 100</strong>
                  </div>
                </div>
              </div>

              {/* Main Monitoring: Collapsible Sidebar + Charts / Inspector */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Collapsible Participant Sidebar */}
                <div
                  className={`${
                    sidebarCollapsed ? 'lg:col-span-1' : 'lg:col-span-4'
                  } bg-sky-950 border-2 border-cyan-500/40 rounded-2xl p-3.5 space-y-3 transition-all duration-200`}
                >
                  <div className="flex items-center justify-between gap-2 border-b border-cyan-500/30 pb-2.5">
                    {!sidebarCollapsed && (
                      <div>
                        <div className="text-xs font-extrabold uppercase text-yellow-300 tracking-wider">
                          PARTISIPAN SISWA
                        </div>
                        <div className="text-[11px] text-cyan-200">
                          {filteredStudents.length} dari {students.length} ditampilkan
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setSidebarCollapsed((v) => !v)}
                      title={sidebarCollapsed ? 'Buka Sidebar Partisipan' : 'Ciutkan Sidebar'}
                      className="p-1.5 rounded-lg bg-sky-900 hover:bg-sky-800 text-cyan-200 cursor-pointer ml-auto"
                    >
                      {sidebarCollapsed ? (
                        <ChevronRight className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {!sidebarCollapsed && (
                    <>
                      {/* Search Input */}
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-cyan-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={participantSearch}
                          onChange={(e) => setParticipantSearch(e.target.value)}
                          placeholder="Cari nama siswa..."
                          className="w-full pl-8 pr-3 py-1.5 bg-sky-900 border border-cyan-400/50 rounded-xl text-xs text-white placeholder-cyan-300/50 focus:outline-none focus:border-yellow-400 font-bold"
                        />
                      </div>

                      {/* Filter by Level */}
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold uppercase text-cyan-300">
                          Filter Level:
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {(['all', 1, 2, 3, 4, 5] as const).map((lvl) => (
                            <button
                              key={lvl}
                              type="button"
                              onClick={() => setParticipantLevelFilter(lvl)}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer ${
                                participantLevelFilter === lvl
                                  ? 'bg-yellow-400 text-sky-950 font-extrabold'
                                  : 'bg-sky-900/90 text-cyan-200 hover:bg-sky-800'
                              }`}
                            >
                              {lvl === 'all' ? 'Semua' : `Lv.${lvl}`}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Filter by Status */}
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold uppercase text-cyan-300">
                          Filter Status:
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-[10px]">
                          {[
                            { key: 'all', label: 'Semua Status' },
                            { key: 'finished', label: 'Selesai Misi' },
                            { key: 'playing', label: 'Bermain' },
                            { key: 'joined', label: 'Baru Bergabung' },
                          ].map((st) => (
                            <button
                              key={st.key}
                              type="button"
                              onClick={() => setParticipantStatusFilter(st.key as any)}
                              className={`px-2 py-1 rounded-md font-bold cursor-pointer text-center truncate ${
                                participantStatusFilter === st.key
                                  ? 'bg-cyan-400 text-sky-950 font-extrabold'
                                  : 'bg-sky-900/90 text-cyan-200 hover:bg-sky-800'
                              }`}
                            >
                              {st.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Student List */}
                      <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
                        {filteredStudents.length === 0 ? (
                          <div className="text-center py-6 text-xs text-slate-400">
                            Tidak ada siswa yang sesuai filter.
                          </div>
                        ) : (
                          filteredStudents.map((s) => {
                            const status = getStudentStatus(s);
                            const isSelected = selectedStudent?.id === s.id;
                            const maxLvl = Math.max(s.solo.unlockedLevel, s.championship.unlockedLevel);

                            return (
                              <div
                                key={s.id}
                                onClick={() => setSelectedStudentId(s.id)}
                                className={`p-2 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                                  isSelected
                                    ? 'bg-sky-850 border-yellow-400 shadow-md ring-1 ring-yellow-400'
                                    : 'bg-sky-900/70 hover:bg-sky-800 border-cyan-500/30'
                                }`}
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <CharacterAvatarSvg
                                    characterId={s.characterId}
                                    className="w-7 h-7 shrink-0"
                                  />
                                  <div className="leading-tight truncate">
                                    <div className="text-xs font-bold text-white truncate">
                                      {s.name}
                                    </div>
                                    <div className="text-[10px] text-cyan-200 font-mono">
                                      Lv.{maxLvl}/5 · Skor: {s.championship.totalChampionshipScore}
                                    </div>
                                  </div>
                                </div>

                                <span
                                  className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded shrink-0 ${
                                    status === 'finished'
                                      ? 'bg-emerald-400 text-sky-950'
                                      : status === 'playing'
                                        ? 'bg-amber-400 text-sky-950'
                                        : 'bg-cyan-900 text-cyan-200 border border-cyan-400/40'
                                  }`}
                                >
                                  {status === 'finished'
                                    ? 'Selesai'
                                    : status === 'playing'
                                      ? 'Bermain'
                                      : 'Bergabung'}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Right Column: Visual Charts & Selected Student Deep Dive */}
                <div className={`${sidebarCollapsed ? 'lg:col-span-11' : 'lg:col-span-8'} space-y-4`}>
                  {/* Selected Student Detail Card */}
                  {selectedStudent && (
                    <div className="bg-sky-950 border-2 border-cyan-500/50 rounded-2xl p-4.5 space-y-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/30 pb-3">
                        <div className="flex items-center gap-3">
                          <CharacterAvatarSvg
                            characterId={selectedStudent.characterId}
                            className="w-12 h-12"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-base font-bold font-['Fredoka'] text-white">
                                {selectedStudent.name}
                              </h4>
                              <span
                                className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${
                                  getStudentStatus(selectedStudent) === 'finished'
                                    ? 'bg-emerald-400 text-sky-950'
                                    : getStudentStatus(selectedStudent) === 'playing'
                                      ? 'bg-amber-400 text-sky-950'
                                      : 'bg-cyan-900 text-cyan-200 border border-cyan-400/40'
                                }`}
                              >
                                Status:{' '}
                                {getStudentStatus(selectedStudent) === 'finished'
                                  ? 'Selesai Seluruh Misi'
                                  : getStudentStatus(selectedStudent) === 'playing'
                                    ? 'Sedang Bermain'
                                    : 'Baru Bergabung'}
                              </span>
                            </div>
                            <div className="text-xs text-cyan-200 mt-0.5">
                              Karakter 3D:{' '}
                              <strong className="text-yellow-300">
                                {selectedStudent.characterId === 'bima'
                                  ? 'BIMA (Kapten Teknisi Air)'
                                  : 'SINTA (Penjaga Air Bersih)'}
                              </strong>
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-[10px] uppercase font-bold text-cyan-300">
                            LEVEL TERTINGGI
                          </div>
                          <div className="text-xl font-mono font-extrabold text-yellow-300">
                            Level{' '}
                            {Math.max(
                              selectedStudent.solo?.unlockedLevel || 1,
                              selectedStudent.championship?.unlockedLevel || 1,
                            )}{' '}
                            / 5
                          </div>
                        </div>
                      </div>

                      {/* Split Comparison: Solo Adventure vs Class Championship */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Box 1: Solo Adventure History */}
                        <div className="bg-sky-900/60 border border-cyan-500/40 rounded-xl p-3 space-y-2">
                          <div className="text-xs font-bold text-cyan-300 uppercase tracking-wide flex items-center justify-between">
                            <span>1. RIWAYAT SOLO ADVENTURE</span>
                            <span className="text-[10px] bg-sky-950 px-2 py-0.5 rounded text-cyan-200">
                              Latihan
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center pt-1">
                            <div className="bg-sky-950/80 rounded-lg p-2 border border-cyan-500/20">
                              <div className="text-[10px] text-cyan-300">Latest Score</div>
                              <div className="text-sm font-mono font-bold text-white mt-0.5">
                                {selectedStudent.solo?.latestTotalScore || 0}
                              </div>
                            </div>
                            <div className="bg-sky-950/80 rounded-lg p-2 border border-cyan-500/20">
                              <div className="text-[10px] text-yellow-300">Best Score</div>
                              <div className="text-sm font-mono font-bold text-yellow-300 mt-0.5">
                                {selectedStudent.solo?.bestTotalScore || 0}
                              </div>
                            </div>
                            <div className="bg-sky-950/80 rounded-lg p-2 border border-cyan-500/20">
                              <div className="text-[10px] text-emerald-300">Nilai (100)</div>
                              <div className="text-sm font-mono font-bold text-emerald-300 mt-0.5">
                                {selectedStudent.solo?.academicGrade || 0}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Box 2: Official Class Championship Score */}
                        <div className="bg-sky-900/60 border border-yellow-400/40 rounded-xl p-3 space-y-2">
                          <div className="text-xs font-bold text-yellow-300 uppercase tracking-wide flex items-center justify-between">
                            <span>2. SKOR RESMI CHAMPIONSHIP</span>
                            <span className="text-[10px] bg-yellow-400 text-sky-950 px-2 py-0.5 rounded font-extrabold">
                              Kompetisi
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center pt-1">
                            <div className="bg-sky-950/80 rounded-lg p-2 border border-yellow-400/20">
                              <div className="text-[10px] text-yellow-300">Total Skor</div>
                              <div className="text-sm font-mono font-bold text-yellow-300 mt-0.5">
                                {selectedStudent.championship?.totalChampionshipScore || 0}
                              </div>
                            </div>
                            <div className="bg-sky-950/80 rounded-lg p-2 border border-yellow-400/20">
                              <div className="text-[10px] text-emerald-300">Nilai (100)</div>
                              <div className="text-sm font-mono font-bold text-emerald-300 mt-0.5">
                                {selectedStudent.championship?.academicGrade || 0}
                              </div>
                            </div>
                            <div className="bg-sky-950/80 rounded-lg p-2 border border-yellow-400/20">
                              <div className="text-[10px] text-cyan-200">Waktu</div>
                              <div className="text-sm font-mono font-bold text-white mt-0.5">
                                {selectedStudent.championship?.totalTimeSeconds || 0}s
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Matrix 10 Posisi Misi Siswa */}
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-bold uppercase text-cyan-200">
                          Pencapaian 10 Posisi Misi:
                        </div>
                        <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                          {MISSION_LOCATIONS.map((loc) => {
                            const sScore = selectedStudent.solo.locations[loc.id]?.bestScore;
                            const cScore =
                              selectedStudent.championship.locations[loc.id]?.championshipScore;
                            const medal =
                              selectedStudent.championship.locations[loc.id]?.medal ||
                              selectedStudent.solo.locations[loc.id]?.medal ||
                              'none';
                            const isDone = sScore !== undefined || cScore !== undefined;

                            return (
                              <div
                                key={loc.id}
                                title={`Pos ${loc.id}: ${loc.name} (Solo: ${sScore ?? '-'}, Champ: ${cScore ?? '-'})`}
                                className={`p-1.5 rounded-lg border text-center flex flex-col items-center ${
                                  isDone
                                    ? 'bg-sky-900 border-cyan-400/70 text-white'
                                    : 'bg-slate-900/60 border-slate-700 text-slate-500'
                                }`}
                              >
                                <span className="text-[9px] font-mono font-bold">P{loc.id}</span>
                                <MedalBadgeSvg medal={medal} className="w-3.5 h-3.5 mt-0.5" />
                                <span className="text-[8px] font-mono font-bold text-yellow-300 mt-0.5">
                                  {cScore ?? sScore ?? '-'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 2 Visual Charts: Level Progress Bar Chart + Championship Score Distribution Chart */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Chart 1: Progres Siswa per Level */}
                    <div className="bg-sky-950 border-2 border-cyan-500/40 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-bold font-['Fredoka'] text-white">
                          Grafik Progres Capaian Level (1–5)
                        </h5>
                        <BarChart3 className="w-3.5 h-3.5 text-cyan-300" />
                      </div>

                      <div className="space-y-2 pt-1">
                        {[
                          { lvl: 1, title: 'Level 1: Konsep Dasar Air', color: 'bg-cyan-400' },
                          { lvl: 2, title: 'Level 2: Distribusi Air', color: 'bg-sky-400' },
                          { lvl: 3, title: 'Level 3: Alokasi Kompleks', color: 'bg-blue-400' },
                          { lvl: 4, title: 'Level 4: Penalaran Kritis', color: 'bg-indigo-400' },
                          { lvl: 5, title: 'Level 5: LKPD & Masteri', color: 'bg-yellow-400' },
                        ].map(({ lvl, title, color }) => {
                          const reachedCount = students.filter(
                            (s) =>
                              Math.max(s.solo.unlockedLevel, s.championship.unlockedLevel) >= lvl,
                          ).length;
                          const pct =
                            students.length > 0
                              ? Math.round((reachedCount / students.length) * 100)
                              : 0;

                          return (
                            <div key={lvl} className="space-y-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-cyan-100 font-bold">{title}</span>
                                <span className="font-mono text-cyan-300 tabular-nums">
                                  {reachedCount}/{students.length} ({pct}%)
                                </span>
                              </div>
                              <div className="w-full h-2.5 bg-sky-900 rounded-full overflow-hidden border border-cyan-500/20">
                                <div
                                  className={`h-full ${color} transition-all duration-500 rounded-full`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Chart 2: Sebaran Skor Championship */}
                    <div className="bg-sky-950 border-2 border-cyan-500/40 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-bold font-['Fredoka'] text-white">
                          Sebaran Skor Class Championship
                        </h5>
                        <Trophy className="w-3.5 h-3.5 text-yellow-300" />
                      </div>

                      <div className="flex items-end justify-between gap-2 h-36 pt-4 pb-2 px-1 border-b border-cyan-500/30">
                        {[
                          {
                            label: '0–200',
                            count: students.filter(
                              (s) => s.championship.totalChampionshipScore <= 200,
                            ).length,
                            barColor: 'bg-rose-400',
                          },
                          {
                            label: '201–400',
                            count: students.filter(
                              (s) =>
                                s.championship.totalChampionshipScore > 200 &&
                                s.championship.totalChampionshipScore <= 400,
                            ).length,
                            barColor: 'bg-amber-400',
                          },
                          {
                            label: '401–600',
                            count: students.filter(
                              (s) =>
                                s.championship.totalChampionshipScore > 400 &&
                                s.championship.totalChampionshipScore <= 600,
                            ).length,
                            barColor: 'bg-yellow-400',
                          },
                          {
                            label: '601–800',
                            count: students.filter(
                              (s) =>
                                s.championship.totalChampionshipScore > 600 &&
                                s.championship.totalChampionshipScore <= 800,
                            ).length,
                            barColor: 'bg-cyan-400',
                          },
                          {
                            label: '801–1000',
                            count: students.filter(
                              (s) => s.championship.totalChampionshipScore > 800,
                            ).length,
                            barColor: 'bg-emerald-400',
                          },
                        ].map((bracket) => {
                          const counts = [
                            students.filter((s) => s.championship.totalChampionshipScore <= 200)
                              .length,
                            students.filter(
                              (s) =>
                                s.championship.totalChampionshipScore > 200 &&
                                s.championship.totalChampionshipScore <= 400,
                            ).length,
                            students.filter(
                              (s) =>
                                s.championship.totalChampionshipScore > 400 &&
                                s.championship.totalChampionshipScore <= 600,
                            ).length,
                            students.filter(
                              (s) =>
                                s.championship.totalChampionshipScore > 600 &&
                                s.championship.totalChampionshipScore <= 800,
                            ).length,
                            students.filter((s) => s.championship.totalChampionshipScore > 800)
                              .length,
                          ];
                          const maxCount = Math.max(...counts, 1);
                          const heightPct = Math.max(
                            12,
                            Math.round((bracket.count / maxCount) * 100),
                          );

                          return (
                            <div
                              key={bracket.label}
                              className="flex-1 flex flex-col items-center gap-1 h-full justify-end"
                            >
                              <span className="text-[10px] font-mono font-bold text-white tabular-nums">
                                {bracket.count}
                              </span>
                              <div className="w-full bg-sky-900 rounded-t-lg overflow-hidden flex items-end justify-center h-24">
                                <div
                                  className={`w-full ${bracket.barColor} rounded-t-md transition-all duration-500`}
                                  style={{ height: `${heightPct}%` }}
                                />
                              </div>
                              <span className="text-[9px] text-cyan-300 font-mono text-center">
                                {bracket.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="text-[10px] text-cyan-200 text-center">
                        Skala Skor Resmi: 0 sampai 1000 Poin (Maks. 100 Poin per Lokasi)
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ACCESS CODE & MODE CONTROLS */}
          {activeTab === 'controls' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <form
                onSubmit={handleSaveAccessSettings}
                className="bg-sky-950 border-2 border-cyan-500/40 rounded-2xl p-5 space-y-4"
              >
                <h3 className="text-base font-bold font-['Fredoka'] text-yellow-300">
                  Pengaturan Kode Akses Bersama Siswa
                </h3>
                <div>
                  <label
                    htmlFor="admin-access-code"
                    className="block text-xs font-bold text-cyan-200 mb-1"
                  >
                    Kode Akses Kelas (Satu Kode untuk Semua Siswa)
                  </label>
                  <input
                    id="admin-access-code"
                    type="text"
                    value={accessCodeDraft}
                    onChange={(e) => setAccessCodeDraft(e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-sky-900 border-2 border-cyan-400 text-yellow-300 font-mono font-bold text-lg uppercase"
                  />
                </div>
                <div>
                  <label
                    htmlFor="admin-class-name"
                    className="block text-xs font-bold text-cyan-200 mb-1"
                  >
                    Nama Kelas
                  </label>
                  <input
                    id="admin-class-name"
                    type="text"
                    value={classNameDraft}
                    onChange={(e) => setClassNameDraft(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-sky-900 border border-cyan-400/60 text-white text-sm font-bold"
                  />
                </div>
                <div>
                  <label
                    htmlFor="admin-session-name"
                    className="block text-xs font-bold text-cyan-200 mb-1"
                  >
                    Nama Sesi Class Championship
                  </label>
                  <input
                    id="admin-session-name"
                    type="text"
                    value={sessionNameDraft}
                    onChange={(e) => setSessionNameDraft(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-sky-900 border border-cyan-400/60 text-white text-sm font-bold"
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-sky-950 font-['Fredoka'] font-bold text-sm cursor-pointer"
                >
                  Simpan Perubahan Kode Akses
                </button>
              </form>

              <div className="bg-sky-950 border-2 border-cyan-500/40 rounded-2xl p-5 space-y-4">
                <h3 className="text-base font-bold font-['Fredoka'] text-yellow-300">
                  Sakelar Kendali Akses & Sesi Permainan
                </h3>

                {/* 1. Access Code Active Toggle */}
                <div className="p-3.5 rounded-xl bg-sky-900/80 border border-cyan-500/30 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-white">
                      Status Kode Akses ({settings.accessCode})
                    </div>
                    <div className="text-xs text-cyan-200">
                      Jika dinonaktifkan, siswa tidak dapat masuk ke dalam game.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleSettingFlag('accessCodeActive')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer shrink-0 ${
                      settings.accessCodeActive
                        ? 'bg-emerald-500 text-sky-950'
                        : 'bg-rose-600 text-white'
                    }`}
                  >
                    {settings.accessCodeActive ? 'AKTIF (Buka)' : 'NONAKTIF (Tutup)'}
                  </button>
                </div>

                {/* 2. Solo Adventure Toggle */}
                <div className="p-3.5 rounded-xl bg-sky-900/80 border border-cyan-500/30 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-white">Akses Mode 1: Solo Adventure</div>
                    <div className="text-xs text-cyan-200">
                      Mode latihan mandiri siswa (Latest Score & Best Score).
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleSettingFlag('soloAdventureOpen')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer shrink-0 ${
                      settings.soloAdventureOpen
                        ? 'bg-emerald-500 text-sky-950'
                        : 'bg-rose-600 text-white'
                    }`}
                  >
                    {settings.soloAdventureOpen ? 'DIBUKA' : 'DITUTUP'}
                  </button>
                </div>

                {/* 3. Class Championship Toggle */}
                <div className="p-3.5 rounded-xl bg-sky-900/80 border border-cyan-500/30 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-white">
                      Sesi Mode 2: Class Championship
                    </div>
                    <div className="text-xs text-cyan-200">
                      Kompetisi resmi kelas. Skor terpisah penuh dari Solo Adventure.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleSettingFlag('championshipOpen')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer shrink-0 ${
                      settings.championshipOpen
                        ? 'bg-yellow-400 text-sky-950'
                        : 'bg-rose-600 text-white'
                    }`}
                  >
                    {settings.championshipOpen ? 'SESI DIBUKA' : 'SESI DITUTUP'}
                  </button>
                </div>

                {/* 4. Danger Zone: Reset Game Data & Scores */}
                <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-500/40 flex flex-wrap items-center justify-between gap-3 mt-4">
                  <div>
                    <div className="text-sm font-bold text-rose-200 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>Reset Nilai & Progres Permainan</span>
                    </div>
                    <div className="text-xs text-rose-300/80 mt-0.5">
                      Hapus skor/progres permainan dari Supabase (Solo & Championship). Seluruh 14 akun siswa tetap utuh.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playClick();
                      setResetOptions({ studentId: 'ALL', modeScope: 'ALL' });
                      setShowResetModal(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-['Fredoka'] font-bold text-xs shadow-md cursor-pointer transition-all hover:scale-105 flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Reset Data Permainan</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: STUDENT ASSESSMENT RESULTS */}
          {activeTab === 'assessments' && (
            <div className="bg-sky-950 border-2 border-cyan-500/40 rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-cyan-500/30 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold font-['Fredoka'] text-white">
                    Daftar Pemain & Hasil Asesmen Akademik (Skala 100 = Total Poin ÷ 10)
                  </h3>
                  <p className="text-xs text-cyan-200">
                    Poin Solo Adventure dan Class Championship disimpan pada kolom terpisah.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-sky-900/90 text-cyan-200 border-b border-cyan-500/30">
                      <th className="py-3 px-4 font-bold">Nama Pemain</th>
                      <th className="py-3 px-4 font-bold">Karakter</th>
                      <th className="py-3 px-4 font-bold text-right">Solo Latest</th>
                      <th className="py-3 px-4 font-bold text-right">Solo Best</th>
                      <th className="py-3 px-4 font-bold text-right">Nilai Solo (100)</th>
                      <th className="py-3 px-4 font-bold text-right">Championship Score</th>
                      <th className="py-3 px-4 font-bold text-right">Nilai Championship (100)</th>
                      <th className="py-3 px-4 font-bold text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyan-500/20">
                    {students.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-cyan-200 text-xs font-bold">
                          Belum ada data hasil asesmen siswa terdaftar di database. Siswa dapat mendaftar mandiri via tombol "MULAI SEBAGAI SISWA" dengan Kode Akses: <strong className="text-yellow-300 font-mono">{settings.accessCode}</strong>.
                        </td>
                      </tr>
                    ) : (
                      students.map((stu) => {
                        const charName =
                          CHARACTERS.find((c) => c.id === stu.characterId)?.name || stu.characterId;
                        return (
                          <tr key={stu.id} className="hover:bg-sky-900/40">
                            <td className="py-3 px-4 font-bold text-white flex items-center gap-2.5">
                              <CharacterAvatarSvg characterId={stu.characterId} className="w-8 h-8" />
                              <span>{stu.name}</span>
                            </td>
                            <td className="py-3 px-4 text-cyan-200">{charName}</td>
                            <td className="py-3 px-4 text-right font-mono text-cyan-100 tabular-nums">
                              {stu.solo.latestTotalScore}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-yellow-300 tabular-nums">
                              {stu.solo.bestTotalScore} / 1000
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-emerald-300 tabular-nums">
                              {stu.solo.academicGrade}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-yellow-300 tabular-nums">
                              {stu.championship.totalChampionshipScore} / 1000
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-emerald-300 tabular-nums">
                              {stu.championship.academicGrade}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  soundManager.playClick();
                                  const next = deleteStudentProfile(stu.id);
                                  onUpdateStudents(next);
                                  setStatusBanner(`Data pemain ${stu.name} telah dihapus.`);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-bold cursor-pointer"
                              >
                                Hapus
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: LEVEL & LOCATION COMPLETION PROGRESS */}
          {activeTab === 'progress' && (
            <div className="bg-sky-950 border-2 border-cyan-500/40 rounded-2xl p-5 space-y-4">
              <h3 className="text-base font-bold font-['Fredoka'] text-yellow-300">
                Matriks Progres Penyelesaian 10 Lokasi Misi (Skor Terbaik per Lokasi)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-sky-900 text-cyan-200 border-b border-cyan-500/30">
                      <th className="py-2.5 px-3 font-bold">Nama Siswa</th>
                      <th className="py-2.5 px-3 font-bold text-center">Level Terbuka</th>
                      {MISSION_LOCATIONS.map((loc) => (
                        <th key={loc.id} className="py-2.5 px-2 font-bold text-center">
                          Pos {loc.id}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cyan-500/20">
                    {students.map((stu) => (
                      <tr key={stu.id} className="hover:bg-sky-900/40">
                        <td className="py-2.5 px-3 font-bold text-white">{stu.name}</td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-300">
                          Lv.{Math.max(stu.solo.unlockedLevel, stu.championship.unlockedLevel)}/5
                        </td>
                        {MISSION_LOCATIONS.map((loc) => {
                          const sScore = stu.solo.locations[loc.id]?.bestScore;
                          const cScore = stu.championship.locations[loc.id]?.championshipScore;
                          return (
                            <td key={loc.id} className="py-2.5 px-2 text-center font-mono tabular-nums">
                              {sScore !== undefined || cScore !== undefined ? (
                                <div>
                                  <span className="text-cyan-300" title="Solo Best">
                                    S:{sScore ?? '-'}
                                  </span>{' '}
                                  <span className="text-yellow-300 font-bold" title="Championship">
                                    C:{cScore ?? '-'}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-500">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: OFFICIAL CLASS CHAMPIONSHIP LEADERBOARD */}
          {activeTab === 'leaderboard' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                {LEVELS.map((lvl) => {
                  const champ = getLevelChampion(students, lvl.id);
                  return (
                    <div
                      key={lvl.id}
                      className="bg-sky-950 border border-yellow-400/50 rounded-2xl p-3.5"
                    >
                      <div className="text-[11px] font-bold text-yellow-300 uppercase flex items-center gap-1.5">
                        <Crown className="w-3.5 h-3.5 text-yellow-300" />
                        <span>JUARA {lvl.code}</span>
                      </div>
                      <div className="text-xs text-cyan-200 truncate">{lvl.title}</div>
                      {champ ? (
                        <div className="mt-1.5">
                          <div className="text-sm font-bold text-white">{champ.studentName}</div>
                          <div className="text-xs font-mono font-bold text-emerald-300 tabular-nums">
                            {champ.score} / 200 Poin ({champ.timeSeconds}d)
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 mt-1.5">Belum ada skor</div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="bg-sky-950 border-2 border-cyan-500/40 rounded-2xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-cyan-500/30 flex items-center justify-between">
                  <h3 className="text-base font-bold font-['Fredoka'] text-white">
                    Peringkat Resmi Class Championship ({settings.championshipSessionName})
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playClick();
                      setResetOptions({ studentId: 'ALL', modeScope: 'CHAMPIONSHIP' });
                      setShowResetModal(true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-sky-950 text-xs font-bold cursor-pointer transition-all hover:scale-105 shadow-md"
                  >
                    <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Reset Sesi Championship</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-sky-900 text-cyan-200 border-b border-cyan-500/30">
                        <th className="py-2.5 px-4 font-bold">Peringkat</th>
                        <th className="py-2.5 px-4 font-bold">Nama Siswa</th>
                        <th className="py-2.5 px-4 font-bold text-right">Championship Score</th>
                        <th className="py-2.5 px-4 font-bold text-right">Nilai Akademik</th>
                        <th className="py-2.5 px-4 font-bold text-center">Lokasi Selesai</th>
                        <th className="py-2.5 px-4 font-bold text-right">Total Waktu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cyan-500/20">
                      {leaderboard.map((item) => (
                        <tr key={item.studentId} className="hover:bg-sky-900/40">
                          <td className="py-2.5 px-4 font-mono font-bold text-yellow-300 tabular-nums">
                            <span className="inline-flex items-center gap-1.5">
                              <span>#{item.rank}</span>
                              {item.rank <= 3 && (
                                <Medal
                                  className={`w-4 h-4 ${
                                    item.rank === 1
                                      ? 'text-yellow-300'
                                      : item.rank === 2
                                        ? 'text-slate-200'
                                        : 'text-amber-500'
                                  }`}
                                />
                              )}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-bold text-white">{item.studentName}</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-yellow-300 tabular-nums">
                            {item.championshipScore} / 1000
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-300 tabular-nums">
                            {item.academicGrade}
                          </td>
                          <td className="py-2.5 px-4 text-center font-mono text-cyan-100 tabular-nums">
                            {item.completedLocationsCount} / 10
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-cyan-200 tabular-nums">
                            {item.totalTimeSeconds} detik
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: AKUN SISWA & RESET PASSWORD */}
          {activeTab === 'accounts' && (
            <div className="space-y-4">
              {/* Top Action Bar */}
              <div className="bg-sky-950 border-2 border-cyan-500/40 rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold font-['Fredoka'] text-white flex items-center gap-2">
                      <Users className="w-5 h-5 text-yellow-300" />
                      <span>Manajemen 14 Akun Siswa Kelas 5 & Reset Password</span>
                    </h3>
                    <p className="text-xs text-cyan-200 mt-0.5">
                      Kelola akun siswa (Username & Password), status aktif (<code>is_active</code>), keterhubungan <code>auth.users</code> ↔ <code>student_profiles</code>, serta unduh/cetak daftar kredensial khusus Guru.
                    </p>
                  </div>

                  <div className="relative w-full sm:w-60">
                    <Search className="w-4 h-4 text-cyan-300 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={participantSearch}
                      onChange={(e) => setParticipantSearch(e.target.value)}
                      placeholder="Cari nama atau username..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-sky-900 border border-cyan-400/50 text-white text-xs font-bold focus:outline-none focus:border-yellow-400"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-cyan-500/20">
                  {/* 1. Buat Akun Siswa Satuan */}
                  <button
                    type="button"
                    data-testid="btn-add-single-student"
                    onClick={() => {
                      soundManager.playClick();
                      setStudentFormError(null);
                      setAddStudentFormMode((prev) => (prev === 'single' ? 'none' : 'single'));
                    }}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-['Fredoka'] font-bold text-xs border cursor-pointer shadow-md ${
                      addStudentFormMode === 'single'
                        ? 'bg-yellow-300 text-sky-950 border-yellow-100 ring-2 ring-yellow-300'
                        : 'bg-yellow-400 hover:bg-yellow-300 text-sky-950 border-white'
                    }`}
                  >
                    <UserPlus className="w-4 h-4 stroke-[2.5]" />
                    <span>+ Buat 1 Akun Siswa</span>
                  </button>

                  {/* 2. Buat Akun Siswa Massal (Batch) */}
                  <button
                    type="button"
                    data-testid="btn-add-batch-student"
                    onClick={() => {
                      soundManager.playClick();
                      setStudentFormError(null);
                      setAddStudentFormMode((prev) => (prev === 'batch' ? 'none' : 'batch'));
                    }}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-['Fredoka'] font-bold text-xs border cursor-pointer shadow-md ${
                      addStudentFormMode === 'batch'
                        ? 'bg-cyan-300 text-sky-950 border-cyan-100 ring-2 ring-cyan-300'
                        : 'bg-cyan-400 hover:bg-cyan-300 text-sky-950 border-white'
                    }`}
                  >
                    <Users className="w-4 h-4 stroke-[2.5]" />
                    <span>+ Buat Akun Massal (Batch)</span>
                  </button>

                  {/* 3. Sinkronkan 14 Akun Siswa Kelas 5 */}
                  <button
                    type="button"
                    data-testid="btn-sync-14-students"
                    disabled={isSyncing14Students}
                    onClick={async () => {
                      soundManager.playClick();
                      setIsSyncing14Students(true);
                      setStatusBanner(null);
                      try {
                        const res = await syncOfficial14StudentAccounts();
                        setStatusBanner(res.message);
                        if (res.rlsBlocked) {
                          setShowRlsSqlModal(true);
                        }
                        await loadRealSupabaseData();
                      } finally {
                        setIsSyncing14Students(false);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-sky-950 font-['Fredoka'] font-bold text-xs border border-white cursor-pointer shadow-md disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 stroke-[2.5] ${isSyncing14Students ? 'animate-spin' : ''}`} />
                    <span>
                      {isSyncing14Students
                        ? 'Menyinkronkan...'
                        : 'Sinkronkan 14 Akun Kelas 5'}
                    </span>
                  </button>

                  {/* 4. Unduh / Cetak Kredensial Sementara */}
                  <button
                    type="button"
                    data-testid="btn-open-credentials-sheet"
                    onClick={() => {
                      soundManager.playClick();
                      setShowCredentialSheetModal(true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-800 hover:bg-sky-700 text-yellow-300 font-['Fredoka'] font-bold text-xs border border-yellow-400/60 cursor-pointer shadow-md"
                  >
                    <Download className="w-4 h-4 stroke-[2.5]" />
                    <span>Unduh / Cetak Username & Password</span>
                  </button>

                  {/* 5. SQL Sinkronisasi & RLS */}
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playClick();
                      setShowRlsSqlModal((v) => !v);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-900 hover:bg-sky-800 text-cyan-200 font-bold text-xs border border-cyan-400/40 cursor-pointer"
                  >
                    <Database className="w-3.5 h-3.5 text-cyan-300" />
                    <span>SQL Sinkronisasi & RLS</span>
                  </button>
                </div>
              </div>

              {/* COLLAPSIBLE SQL HELPER FOR SUPABASE SQL EDITOR */}
              {showRlsSqlModal && (
                <div className="bg-sky-950 border-2 border-amber-400/80 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs sm:text-sm font-bold text-amber-300 flex items-center gap-2">
                      <Database className="w-4 h-4 shrink-0" />
                      <span>
                        SQL Sinkronisasi 14 Profil Siswa & Policy RLS (Jalankan di Supabase SQL Editor jika student_profiles terkunci RLS)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowRlsSqlModal(false)}
                      className="px-2.5 py-1 rounded-lg bg-sky-800 text-cyan-200 text-xs font-bold cursor-pointer"
                    >
                      Tutup
                    </button>
                  </div>
                  <pre className="p-3 rounded-xl bg-slate-950 border border-cyan-500/30 text-[11px] font-mono text-cyan-100 overflow-x-auto max-h-60 select-all">
                    {SUPABASE_SCHEMA_SQL}
                  </pre>
                </div>
              )}

              {/* INLINE FORM: BUAT 1 AKUN SISWA ATAU BATCH AKUN SISWA */}
              {addStudentFormMode !== 'none' && (
                <div className="bg-sky-950 border-2 border-yellow-400/80 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-cyan-500/30 pb-2.5">
                    <h4 className="font-['Fredoka'] font-bold text-sm sm:text-base text-white flex items-center gap-2">
                      {addStudentFormMode === 'single' ? (
                        <>
                          <UserPlus className="w-4 h-4 text-yellow-300" />
                          <span>Buat 1 Akun Siswa Baru (Supabase Auth + student_profiles)</span>
                        </>
                      ) : (
                        <>
                          <Users className="w-4 h-4 text-cyan-300" />
                          <span>Buat Akun Siswa Massal / Batch</span>
                        </>
                      )}
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        soundManager.playClick();
                        setAddStudentFormMode('none');
                        setStudentFormError(null);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-sky-800 hover:bg-sky-700 text-cyan-200 text-xs font-bold cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>

                  {studentFormError && (
                    <div
                      role="alert"
                      className="p-3 rounded-xl bg-rose-950 border border-rose-400 text-rose-100 text-xs font-semibold flex items-center gap-2"
                    >
                      <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0" />
                      <span>{studentFormError}</span>
                    </div>
                  )}

                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      soundManager.playClick();
                      setStudentFormError(null);

                      if (addStudentFormMode === 'single') {
                        const cleaned = singleStudentNameInput.trim().replace(/\s+/g, ' ');
                        if (cleaned.length < 2) {
                          setStudentFormError('Nama lengkap siswa minimal 2 huruf.');
                          return;
                        }
                        setIsAddingStudents(true);
                        try {
                          const res = await adminAddSingleStudent(
                            cleaned,
                            singleStudentPasswordInput.trim() || undefined,
                            newStudentCharacter,
                            singleStudentUsernameInput.trim() || undefined,
                          );
                          if (res.ok) {
                            if (res.student) {
                              const nextList = [
                                res.student,
                                ...students.filter((s) => s.id !== res.student!.id),
                              ];
                              saveStudents(nextList);
                              onUpdateStudents(nextList);
                            }
                            setSingleStudentNameInput('');
                            setSingleStudentUsernameInput('');
                            setSingleStudentPasswordInput('');
                            setAddStudentFormMode('none');
                            setStatusBanner(
                              res.message ||
                                `Akun siswa "${cleaned}" berhasil dibuat!`,
                            );
                            await loadRealSupabaseData();
                          } else {
                            setStudentFormError(res.message || 'Gagal membuat akun siswa.');
                          }
                        } catch (err: any) {
                          setStudentFormError(err?.message || 'Gagal membuat akun siswa.');
                        } finally {
                          setIsAddingStudents(false);
                        }
                      } else {
                        const names = batchStudentNamesInput
                          .split('\n')
                          .map((n) => n.trim().replace(/\s+/g, ' '))
                          .filter((n) => n.length >= 2);
                        if (names.length === 0) {
                          setStudentFormError(
                            'Masukkan minimal 1 nama siswa yang valid (minimal 2 huruf per baris).',
                          );
                          return;
                        }
                        setIsAddingStudents(true);
                        try {
                          const res = await adminAddBatchStudents(names, newStudentCharacter);
                          if (res.ok) {
                            if (res.students && res.students.length > 0) {
                              const newIds = new Set(res.students.map((s) => s.id));
                              const nextList = [
                                ...res.students,
                                ...students.filter((s) => !newIds.has(s.id)),
                              ];
                              saveStudents(nextList);
                              onUpdateStudents(nextList);
                            }
                            setBatchStudentNamesInput('');
                            setAddStudentFormMode('none');
                            setStatusBanner(
                              res.message || `Berhasil membuat ${names.length} akun siswa baru!`,
                            );
                            await loadRealSupabaseData();
                          } else {
                            setStudentFormError(res.message || 'Gagal menambah daftar siswa.');
                          }
                        } catch (err: any) {
                          setStudentFormError(err?.message || 'Gagal menambah daftar siswa.');
                        } finally {
                          setIsAddingStudents(false);
                        }
                      }
                    }}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        {addStudentFormMode === 'single' ? (
                          <div className="space-y-3">
                            <div>
                              <label
                                htmlFor="single-student-name"
                                className="block text-xs font-bold text-cyan-100 mb-1"
                              >
                                1. Nama Lengkap Siswa (display_name):
                              </label>
                              <input
                                id="single-student-name"
                                type="text"
                                required
                                value={singleStudentNameInput}
                                onChange={(e) => setSingleStudentNameInput(e.target.value)}
                                placeholder="Contoh: Afina Felisia Putri"
                                className="w-full px-3.5 py-2.5 rounded-xl bg-sky-900 border-2 border-cyan-400/60 text-white text-xs sm:text-sm font-bold focus:outline-none focus:border-yellow-400"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2.5">
                              <div>
                                <label
                                  htmlFor="single-student-username"
                                  className="block text-xs font-bold text-cyan-100 mb-1"
                                >
                                  2. Username Siswa:
                                </label>
                                <input
                                  id="single-student-username"
                                  type="text"
                                  value={singleStudentUsernameInput}
                                  onChange={(e) =>
                                    setSingleStudentUsernameInput(
                                      e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''),
                                    )
                                  }
                                  placeholder="Contoh: afina01"
                                  className="w-full px-3 py-2 rounded-xl bg-sky-900 border border-cyan-400/60 text-yellow-300 font-mono text-xs font-bold focus:outline-none"
                                />
                              </div>
                              <div>
                                <label
                                  htmlFor="single-student-password"
                                  className="block text-xs font-bold text-cyan-100 mb-1"
                                >
                                  3. Password Awal:
                                </label>
                                <input
                                  id="single-student-password"
                                  type="text"
                                  value={singleStudentPasswordInput}
                                  onChange={(e) => setSingleStudentPasswordInput(e.target.value)}
                                  placeholder="Contoh: Aqua@2601"
                                  className="w-full px-3 py-2 rounded-xl bg-sky-900 border border-cyan-400/60 text-white font-mono text-xs font-bold focus:outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <label
                              htmlFor="batch-student-names"
                              className="block text-xs font-bold text-cyan-100 mb-1.5"
                            >
                              Daftar Nama Siswa (Satu Nama per Baris):
                            </label>
                            <textarea
                              id="batch-student-names"
                              rows={4}
                              required
                              value={batchStudentNamesInput}
                              onChange={(e) => setBatchStudentNamesInput(e.target.value)}
                              placeholder={'Afina Felisia Putri\nAfiz El Haddadi\nARJUNA SURYA WIKRAMA'}
                              className="w-full px-3.5 py-2.5 rounded-xl bg-sky-900 border-2 border-cyan-400/60 text-white text-xs sm:text-sm font-bold focus:outline-none focus:border-yellow-400"
                            />
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-cyan-100 mb-1.5">
                          Pilih Karakter Siswa (character: BIMA / SINTA):
                        </label>
                        <div className="grid grid-cols-2 gap-2.5">
                          {CHARACTERS.filter(
                            (char) => char.id === 'bima' || char.id === 'sinta',
                          ).map((char) => {
                            const isSelected = newStudentCharacter === char.id;
                            const dbCharCode = mapCharacterIdToDbCharacter(char.id);
                            return (
                              <button
                                key={char.id}
                                type="button"
                                onClick={() => {
                                  soundManager.playClick();
                                  setNewStudentCharacter(char.id);
                                }}
                                className={`p-2.5 rounded-xl border-2 flex items-center gap-2.5 cursor-pointer transition-all ${
                                  isSelected
                                    ? 'bg-sky-800 border-yellow-400 shadow-md'
                                    : 'bg-sky-900/60 border-cyan-500/30 hover:border-cyan-400'
                                }`}
                              >
                                <CharacterAvatarSvg
                                  characterId={char.id}
                                  className="w-9 h-9 shrink-0"
                                />
                                <div className="text-left leading-tight">
                                  <div className="font-['Fredoka'] font-bold text-xs text-white">
                                    {char.name} ({dbCharCode})
                                  </div>
                                  <div className="text-[10px] text-cyan-300">{char.roleTitle}</div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          soundManager.playClick();
                          setAddStudentFormMode('none');
                          setStudentFormError(null);
                        }}
                        className="px-4 py-2 rounded-xl bg-sky-800 hover:bg-sky-700 text-cyan-100 text-xs font-bold cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={isAddingStudents}
                        className="px-5 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-sky-950 font-['Fredoka'] font-bold text-xs sm:text-sm border border-white shadow-md cursor-pointer disabled:opacity-50"
                      >
                        {isAddingStudents
                          ? 'Menyimpan ke Supabase...'
                          : addStudentFormMode === 'single'
                            ? 'Buat Akun Siswa'
                            : 'Buat Daftar Akun Siswa'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* STUDENT ACCOUNTS TABLE */}
              <div className="bg-sky-950 border-2 border-cyan-500/40 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-sky-900/90 text-cyan-200 uppercase font-bold text-[11px] border-b border-cyan-500/30">
                      <tr>
                        <th className="py-3 px-3">No</th>
                        <th className="py-3 px-4">Nama Siswa</th>
                        <th className="py-3 px-4">Username Login</th>
                        <th className="py-3 px-3">Karakter</th>
                        <th className="py-3 px-4">Keterhubungan Database</th>
                        <th className="py-3 px-3 text-center">Status Akun (is_active)</th>
                        <th className="py-3 px-4 text-center">Aksi Guru</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cyan-500/20 text-cyan-100 font-semibold">
                      {students
                        .filter(
                          (s) =>
                            !participantSearch ||
                            s.name.toLowerCase().includes(participantSearch.toLowerCase()) ||
                            (s.username &&
                              s.username.toLowerCase().includes(participantSearch.toLowerCase())),
                        )
                        .map((student, idx) => {
                          const spec = findOfficialStudentSpec({
                            authUserId: student.authUserId || student.id,
                            username: student.username,
                            displayName: student.name,
                          });
                          const resolvedUsername =
                            spec?.username || student.username || student.normalizedName;
                          const resolvedAuthUid =
                            student.authUserId || spec?.authUserId || student.id;
                          const isActive = student.isActive !== false;
                          const isLinked = student.profileLinked !== false;

                          return (
                            <tr key={student.id} className="hover:bg-sky-900/40 transition-colors">
                              <td className="py-3 px-3 font-mono font-bold text-cyan-300">
                                {spec?.no || idx + 1}
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-bold text-white text-sm">{student.name}</div>
                                <div className="text-[10px] text-cyan-300 font-mono">
                                  Solo: {student.solo?.bestTotalScore || 0} · Champ:{' '}
                                  {student.championship?.totalChampionshipScore || 0}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-mono font-extrabold text-yellow-300 text-sm">
                                  {resolvedUsername}
                                </div>
                                <div className="text-[10px] font-mono text-cyan-300">
                                  {studentUsernameToInternalEmail(resolvedUsername)}
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-2">
                                  <CharacterAvatarSvg
                                    characterId={student.characterId}
                                    className="w-7 h-7 shrink-0"
                                  />
                                  <span className="font-bold text-white">
                                    {mapCharacterIdToDbCharacter(student.characterId)}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="space-y-1">
                                  {isLinked ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 border border-emerald-400 text-emerald-300">
                                      <CheckCircle2 className="w-3 h-3" /> Auth & student_profiles Terhubung
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 border border-amber-400 text-amber-200">
                                      <AlertTriangle className="w-3 h-3" /> Auth Aktif · Menunggu Sync student_profiles
                                    </span>
                                  )}
                                  <div className="text-[10px] font-mono text-cyan-300 truncate max-w-[210px]">
                                    auth_user_id: {resolvedAuthUid}
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    soundManager.playClick();
                                    const nextState = !isActive;
                                    const res = await adminToggleStudentActive(
                                      student.id,
                                      nextState,
                                      resolvedAuthUid,
                                    );
                                    const updatedList = students.map((s) =>
                                      s.id === student.id ? { ...s, isActive: nextState } : s,
                                    );
                                    saveStudents(updatedList);
                                    onUpdateStudents(updatedList);
                                    setStatusBanner(
                                      res.message ||
                                        `Status akun ${student.name} diubah menjadi ${
                                          nextState ? 'AKTIF' : 'NONAKTIF'
                                        }.`,
                                    );
                                  }}
                                  className={`px-3 py-1 rounded-xl text-[10px] font-extrabold border cursor-pointer transition-colors ${
                                    isActive
                                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 hover:bg-emerald-500/30'
                                      : 'bg-rose-950 border-rose-400 text-rose-200 hover:bg-rose-900'
                                  }`}
                                >
                                  {isActive ? 'AKTIF (Klik Nonaktifkan)' : 'NONAKTIF (Klik Aktifkan)'}
                                </button>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      soundManager.playClick();
                                      setResetModalError(null);
                                      setNewPasswordInput(spec?.defaultPassword || '');
                                      setResetTargetStudent({
                                        ...student,
                                        username: resolvedUsername,
                                        authUserId: resolvedAuthUid,
                                      });
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-sky-950 text-xs font-bold cursor-pointer flex items-center gap-1"
                                  >
                                    <KeyRound className="w-3 h-3" />
                                    <span>Reset Password</span>
                                  </button>

                                  {deleteConfirmStudentId === student.id ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          soundManager.playClick();
                                          setDeleteConfirmStudentId(null);
                                          adminDeleteStudent(student.id).then((res) => {
                                            if (res.ok) {
                                              const next = deleteStudentProfile(student.id);
                                              onUpdateStudents(next);
                                              loadRealSupabaseData();
                                              setStatusBanner(
                                                `Siswa "${student.name}" berhasil dihapus.`,
                                              );
                                            } else {
                                              setStatusBanner(
                                                res.message || 'Gagal menghapus siswa.',
                                              );
                                            }
                                          });
                                        }}
                                        className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
                                      >
                                        Ya, Hapus
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setDeleteConfirmStudentId(null)}
                                        className="px-2 py-1 rounded-lg bg-sky-800 hover:bg-sky-700 text-cyan-100 text-xs font-bold cursor-pointer"
                                      >
                                        Batal
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        soundManager.playClick();
                                        setDeleteConfirmStudentId(student.id);
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-rose-950 hover:bg-rose-900 border border-rose-400/80 text-rose-200 text-xs font-bold cursor-pointer"
                                    >
                                      Hapus
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TEACHER CREDENTIAL SHEET MODAL (DOWNLOAD CSV / PRINT FOR TEACHER ONLY) */}
      {showCredentialSheetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-sky-950/90 backdrop-blur-xs">
          <div className="w-full max-w-3xl bg-sky-900 border-4 border-yellow-400 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-500/30 pb-3 shrink-0">
              <div>
                <h4 className="font-['Fredoka'] font-bold text-lg text-white flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-yellow-300" />
                  <span>Daftar Kredensial Login 14 Siswa Kelas 5 (Khusus Pegangan Guru)</span>
                </h4>
                <p className="text-xs text-cyan-200">
                  Siswa login hanya menggunakan <strong>Username</strong> dan <strong>Password</strong>. Password tidak pernah disimpan secara plaintext di database.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playClick();
                    const header = 'No,Nama Siswa,Username,Password Sementara,Karakter,Email Internal Auth,UUID Auth\n';
                    const rows = OFFICIAL_14_STUDENTS.map(
                      (s) =>
                        `${s.no},"${s.displayName}",${s.username},${s.defaultPassword},${s.character},${studentUsernameToInternalEmail(s.username)},${s.authUserId}`,
                    ).join('\n');
                    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'kredensial-14-siswa-aqua-math-adventure.csv';
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-sky-950 font-['Fredoka'] font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Unduh CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-sky-950 font-['Fredoka'] font-bold text-xs cursor-pointer"
                >
                  Cetak Daftar
                </button>
                <button
                  type="button"
                  onClick={() => setShowCredentialSheetModal(false)}
                  className="px-3 py-2 rounded-xl bg-sky-800 hover:bg-sky-700 text-cyan-100 text-xs font-bold cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 bg-sky-950 rounded-2xl border border-cyan-500/40">
              <table className="w-full text-left text-xs">
                <thead className="bg-sky-900 text-cyan-200 uppercase font-bold text-[11px] border-b border-cyan-500/30">
                  <tr>
                    <th className="py-2.5 px-3">No</th>
                    <th className="py-2.5 px-3">Nama Siswa</th>
                    <th className="py-2.5 px-3">Username</th>
                    <th className="py-2.5 px-3">Password Sementara</th>
                    <th className="py-2.5 px-3">Karakter</th>
                    <th className="py-2.5 px-3">UUID Supabase Auth</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyan-500/20 text-white">
                  {OFFICIAL_14_STUDENTS.map((s) => (
                    <tr key={s.username} className="hover:bg-sky-900/40">
                      <td className="py-2 px-3 font-mono text-cyan-300">{s.no}</td>
                      <td className="py-2 px-3 font-bold">{s.displayName}</td>
                      <td className="py-2 px-3 font-mono font-bold text-yellow-300">{s.username}</td>
                      <td className="py-2 px-3 font-mono font-bold text-emerald-300">
                        {s.defaultPassword}
                      </td>
                      <td className="py-2 px-3 font-bold text-cyan-200">{s.character}</td>
                      <td className="py-2 px-3 font-mono text-[10px] text-cyan-300">
                        {s.authUserId}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TEACHER RESET PASSWORD MODAL */}
      {resetTargetStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-sky-950/90 backdrop-blur-xs">
          <div className="w-full max-w-md bg-sky-900 border-4 border-yellow-400 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-cyan-500/30 pb-3">
              <div className="flex items-center gap-2 font-['Fredoka'] font-bold text-lg text-white">
                <KeyRound className="w-5 h-5 text-yellow-300" />
                <span>Reset Password Siswa</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setResetTargetStudent(null);
                  setResetModalError(null);
                }}
                className="text-cyan-200 hover:text-white text-xs font-bold cursor-pointer"
              >
                Batal
              </button>
            </div>

            <div className="bg-sky-950 p-3.5 rounded-2xl border border-cyan-500/40 space-y-1">
              <div className="text-xs text-cyan-300 font-bold uppercase">Target Akun Siswa</div>
              <div className="text-base font-bold font-['Fredoka'] text-white">
                {resetTargetStudent.name}
              </div>
              <div className="text-xs font-mono text-yellow-300">
                Username: {resetTargetStudent.username || resetTargetStudent.normalizedName}
              </div>
            </div>

            {resetModalError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-950 border border-rose-400 text-rose-100 text-xs font-semibold flex items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0" />
                <span>{resetModalError}</span>
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                soundManager.playClick();
                setResetModalError(null);
                if (!newPasswordInput || newPasswordInput.length < 6) {
                  setResetModalError('Password baru minimal 6 karakter.');
                  return;
                }
                setIsResetting(true);
                try {
                  const targetUsername =
                    resetTargetStudent.username || resetTargetStudent.normalizedName;
                  const res = await resetStudentPasswordByTeacher(
                    resetTargetStudent.id,
                    targetUsername,
                    newPasswordInput,
                    resetTargetStudent.authUserId || undefined,
                  );
                  if (res.ok) {
                    setStatusBanner(
                      res.message ||
                        `Password untuk siswa ${resetTargetStudent.name} (${targetUsername}) telah berhasil di-reset!`,
                    );
                    setResetTargetStudent(null);
                    setNewPasswordInput('');
                  } else {
                    setResetModalError(res.message || 'Gagal mereset password siswa.');
                  }
                } catch (err: any) {
                  setResetModalError(err?.message || 'Gagal mereset password siswa.');
                } finally {
                  setIsResetting(false);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label htmlFor="new-pass-input" className="block text-xs font-bold text-cyan-100 mb-1">
                  Masukkan Password Baru Untuk Siswa
                </label>
                <input
                  id="new-pass-input"
                  type="text"
                  required
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="Password baru (min. 6 karakter)..."
                  className="w-full px-4 py-3 rounded-2xl bg-sky-950 border-2 border-cyan-400 text-white font-mono font-bold text-base focus:outline-none focus:border-yellow-400"
                />
                <p className="text-[10px] text-cyan-200 mt-1">
                  Beritahukan password baru ini kepada siswa agar siswa dapat login dari perangkat miliknya.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setResetTargetStudent(null);
                    setResetModalError(null);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-sky-800 hover:bg-sky-700 text-cyan-100 text-xs font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  className="px-6 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-sky-950 font-['Fredoka'] font-bold text-sm border-2 border-white shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isResetting ? 'Memproses Reset...' : 'Simpan Password Baru'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET GAME DATA & SCORES MODAL */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-sky-950/90 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-lg bg-sky-950 border-4 border-rose-500 rounded-3xl p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-rose-500/40 pb-3">
              <div className="flex items-center gap-2.5 font-['Fredoka'] font-bold text-lg text-rose-200">
                <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0" />
                <span>Reset Nilai & Progres Permainan</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowResetModal(false);
                  setResetErrorMsg(null);
                  setConfirmCheckbox(false);
                  setConfirmInputText('');
                }}
                className="text-cyan-200 hover:text-white text-xs font-bold cursor-pointer"
              >
                Tutup
              </button>
            </div>

            <p className="text-xs text-cyan-200 leading-relaxed">
              Pilih target siswa dan cakupan mode yang ingin di-reset. Seluruh akun siswa (<span className="text-yellow-300 font-bold">auth.users</span>, <span className="text-yellow-300 font-bold">student_profiles</span>, username, & password) <span className="text-emerald-400 font-bold">DIJAMIN TETAP UTUH DAN AMAN</span>.
            </p>

            <form onSubmit={handleExecuteReset} className="space-y-4">
              {/* Target Student Selection */}
              <div>
                <label className="block text-xs font-bold text-cyan-200 mb-1">
                  1. Pilih Target Siswa
                </label>
                <select
                  value={resetOptions.studentId}
                  onChange={(e) =>
                    setResetOptions((prev) => ({ ...prev, studentId: e.target.value }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-sky-900 border border-cyan-400 text-white font-bold text-xs"
                >
                  <option value="ALL">Seluruh Siswa Kelas 5 (Semua 14 Akun)</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.username || 'siswa'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Mode Scope Selection */}
              <div>
                <label className="block text-xs font-bold text-cyan-200 mb-1">
                  2. Pilih Cakupan Mode
                </label>
                <select
                  value={resetOptions.modeScope}
                  onChange={(e) =>
                    setResetOptions((prev) => ({
                      ...prev,
                      modeScope: e.target.value as 'ALL' | 'SOLO' | 'CHAMPIONSHIP',
                    }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-sky-900 border border-cyan-400 text-white font-bold text-xs"
                >
                  <option value="ALL">Semua Mode (Solo Adventure & Class Championship)</option>
                  <option value="SOLO">Hanya Solo Adventure</option>
                  <option value="CHAMPIONSHIP">Hanya Class Championship</option>
                </select>
              </div>

              {/* Data Preview Banner */}
              <div className="p-3.5 rounded-2xl bg-sky-900/90 border border-cyan-500/40 text-xs space-y-1.5">
                <div className="font-bold text-yellow-300 flex items-center justify-between">
                  <span>Pratinjau Data Terpengaruh:</span>
                  {isLoadingPreview && <span className="text-cyan-300 text-[10px] animate-pulse">Menghitung...</span>}
                </div>
                {resetPreview ? (
                  <div className="grid grid-cols-2 gap-2 text-cyan-100 font-mono text-[11px] pt-1">
                    <div className="bg-sky-950 p-2 rounded-lg border border-cyan-500/20">
                      Target: <span className="text-white font-bold">{resetPreview.targetStudentName}</span>
                    </div>
                    <div className="bg-sky-950 p-2 rounded-lg border border-cyan-500/20">
                      Percobaan Game: <span className="text-rose-400 font-bold">{resetPreview.gameAttemptsCount}</span>
                    </div>
                    <div className="bg-sky-950 p-2 rounded-lg border border-cyan-500/20">
                      Progres Level: <span className="text-amber-400 font-bold">{resetPreview.gameProgressCount}</span>
                    </div>
                    <div className="bg-sky-950 p-2 rounded-lg border border-cyan-500/20">
                      Championship: <span className="text-cyan-300 font-bold">{resetPreview.championshipParticipantsCount}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-cyan-300 italic">Memuat pratinjau data...</div>
                )}
              </div>

              {/* Backup Download Section */}
              <div className="p-3 rounded-2xl bg-sky-900/60 border border-cyan-500/30 flex items-center justify-between gap-2">
                <div className="text-[11px] text-cyan-200">
                  Unduh cadangan data permainan sebelum melakukan reset.
                </div>
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  disabled={isDownloadingBackup}
                  className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isDownloadingBackup ? 'Mengunduh...' : 'Unduh JSON'}</span>
                </button>
              </div>

              {/* Confirmation Inputs */}
              <div className="p-3.5 rounded-2xl bg-rose-950/80 border border-rose-500/50 space-y-3">
                <label className="flex items-start gap-2.5 cursor-pointer text-xs font-bold text-rose-200">
                  <input
                    type="checkbox"
                    checked={confirmCheckbox}
                    onChange={(e) => setConfirmCheckbox(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-rose-400 text-rose-600 focus:ring-rose-500 cursor-pointer"
                  />
                  <span>
                    Saya mengerti bahwa seluruh nilai dan progres permainan yang dipilih akan dihapus permanen dari Supabase.
                  </span>
                </label>

                <div>
                  <label className="block text-[11px] font-bold text-rose-300 mb-1">
                    Ketik "RESET" dengan huruf besar untuk mengonfirmasi:
                  </label>
                  <input
                    type="text"
                    value={confirmInputText}
                    onChange={(e) => setConfirmInputText(e.target.value)}
                    placeholder="RESET"
                    className="w-full px-3.5 py-2 rounded-xl bg-sky-950 border border-rose-400/80 text-rose-300 font-mono font-bold text-sm uppercase placeholder-rose-700"
                  />
                </div>
              </div>

              {resetErrorMsg && (
                <div className="p-3 rounded-xl bg-rose-900/80 border border-rose-400 text-rose-200 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{resetErrorMsg}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetModal(false);
                    setResetErrorMsg(null);
                    setConfirmCheckbox(false);
                    setConfirmInputText('');
                  }}
                  className="px-4 py-2.5 rounded-xl bg-sky-800 hover:bg-sky-700 text-cyan-100 text-xs font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={
                    isExecutingReset ||
                    !confirmCheckbox ||
                    confirmInputText.trim().toUpperCase() !== 'RESET'
                  }
                  className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-['Fredoka'] font-bold text-sm border-2 border-white shadow-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isExecutingReset ? 'Memproses Reset...' : 'Eksekusi Reset Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
