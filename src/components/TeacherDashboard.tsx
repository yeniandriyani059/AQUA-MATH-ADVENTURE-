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
} from '../services/gameStorage';
import {
  flushOfflineSyncQueue,
  getTeacherDashboardData,
  resetStudentPasswordByTeacher,
} from '../services/supabaseService';
import { isSupabaseConfigured, SUPABASE_SCHEMA_SQL } from '../services/supabaseClient';
import { ClassSettings, StudentProfile } from '../types/game';
import { soundManager } from '../utils/sound';
import { AquaLogoSvg, CharacterAvatarSvg, MedalBadgeSvg } from './AquaLogoSvg';

interface TeacherDashboardProps {
  settings: ClassSettings;
  students: StudentProfile[];
  onUpdateSettings: (next: ClassSettings) => void;
  onUpdateStudents: (next: StudentProfile[]) => void;
  onCloseToTitle: () => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  settings,
  students,
  onUpdateSettings,
  onUpdateStudents,
  onCloseToTitle,
}) => {
  const [authenticated, setAuthenticated] = useState<boolean>(isTeacherAdminLoggedIn());
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [teacherNameInput, setTeacherNameInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [activeTab, setActiveTab] = useState<
    | 'monitoring'
    | 'controls'
    | 'assessments'
    | 'progress'
    | 'leaderboard'
    | 'database'
    | 'accounts'
  >('monitoring');

  // Password reset modal state for teacher
  const [resetTargetStudent, setResetTargetStudent] = useState<StudentProfile | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [isResetting, setIsResetting] = useState(false);

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
    if (data.students && data.students.length > 0) {
      onUpdateStudents(data.students);
      setStatusBanner(`Data berhasil disinkronkan dari database Supabase! (${data.students.length} siswa, ${data.totalAttemptsCount} riwayat percobaan).`);
    } else if (data.supabaseConnected) {
      setStatusBanner('Terhubung ke Supabase. Belum ada data siswa tersimpan.');
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
    setIsLoggingIn(true);

    try {
      if (authTab === 'register') {
        if (!teacherNameInput.trim()) {
          setLoginError('Nama lengkap guru wajib diisi.');
          return;
        }
        if (!usernameInput.trim()) {
          setLoginError('Username guru wajib diisi.');
          return;
        }
        if (passwordInput !== confirmPasswordInput) {
          setLoginError('Konfirmasi password tidak cocok dengan password.');
          return;
        }
        const res = await registerTeacherAdmin({
          name: teacherNameInput,
          username: usernameInput,
          password: passwordInput,
          confirmPassword: confirmPasswordInput,
        });
        if (res.ok) {
          setAuthenticated(true);
          setPasswordInput('');
          setConfirmPasswordInput('');
        } else {
          setLoginError(res.message || 'Pendaftaran guru gagal. Silakan coba lagi.');
        }
      } else {
        if (!usernameInput.trim() || !passwordInput) {
          setLoginError('Username dan password guru wajib diisi.');
          return;
        }
        const res = await loginTeacherAdmin(usernameInput, passwordInput);
        if (res.ok) {
          setAuthenticated(true);
          setPasswordInput('');
        } else {
          setLoginError(res.message || 'Login guru gagal. Silakan periksa kembali username dan password.');
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
                {authTab === 'register' ? 'PENDAFTARAN AKUN GURU' : 'PORTAL MASUK GURU'}
              </h2>
              <p className="text-xs text-cyan-200 mt-1">
                {authTab === 'register'
                  ? 'Buat akun guru permanen untuk mengelola kelas dan asesmen.'
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

            <div>
              <label
                htmlFor="teacher-username"
                className="block text-xs font-bold text-cyan-100 mb-1"
              >
                Username Guru
              </label>
              <input
                id="teacher-username"
                type="text"
                required
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="Masukkan username guru..."
                className="w-full px-3.5 py-2.5 rounded-2xl bg-sky-950 border-2 border-cyan-400/80 text-white font-bold text-sm focus:outline-none focus:border-yellow-400"
              />
            </div>

            <div>
              <label
                htmlFor="teacher-password"
                className="block text-xs font-bold text-cyan-100 mb-1"
              >
                Password Guru
              </label>
              <input
                id="teacher-password"
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Masukkan password..."
                className="w-full px-3.5 py-2.5 rounded-2xl bg-sky-950 border-2 border-cyan-400/80 text-white font-bold text-sm focus:outline-none focus:border-yellow-400"
              />
            </div>

            {authTab === 'register' && (
              <div>
                <label
                  htmlFor="teacher-confirm-password"
                  className="block text-xs font-bold text-cyan-100 mb-1"
                >
                  Konfirmasi Password
                </label>
                <input
                  id="teacher-confirm-password"
                  type="password"
                  required
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  placeholder="Ulangi password..."
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-sky-950 border-2 border-cyan-400/80 text-white font-bold text-sm focus:outline-none focus:border-yellow-400"
                />
              </div>
            )}

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
                    : 'Masuk ke Dashboard Guru'}
              </span>
              <ArrowRight className="w-5 h-5 stroke-[2.75]" />
            </button>
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
            onClick={() => setActiveTab('database')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
              activeTab === 'database'
                ? 'bg-yellow-400 text-sky-950'
                : 'bg-sky-900 text-cyan-100 hover:bg-sky-800'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>6. Kelola Data & Supabase</span>
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
            <span>7. Akun Siswa & Reset Password</span>
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
                      const next = resetAllChampionshipScores();
                      onUpdateStudents(next);
                      setStatusBanner(
                        'Skor Class Championship berhasil di-reset untuk sesi baru (Skor Solo Adventure tetap aman).',
                      );
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-sky-950 text-xs font-bold cursor-pointer"
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

          {/* TAB 5: DATA MANAGEMENT & SUPABASE INTEGRATION */}
          {activeTab === 'database' && (
            <div className="space-y-4">
              <div className="bg-sky-950 border-2 border-cyan-500/40 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-bold uppercase text-cyan-300">
                    Status Penyimpanan Database
                  </div>
                  <h3 className="text-base font-bold font-['Fredoka'] text-white flex items-center gap-2 mt-0.5">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isSupabaseConfigured ? 'bg-emerald-400' : 'bg-cyan-400'
                      }`}
                    />
                    <span>
                      {isSupabaseConfigured
                        ? 'Terhubung ke Supabase Cloud Database'
                        : 'Mode Simulasi Lokal (Local Demo Mode Aktif)'}
                    </span>
                  </h3>
                  <p className="text-xs text-cyan-200 mt-1">
                    Aplikasi siap dihubungkan ke Supabase kapan saja dengan mengisi{' '}
                    <code className="text-yellow-300">VITE_SUPABASE_URL</code> dan{' '}
                    <code className="text-yellow-300">VITE_SUPABASE_ANON_KEY</code> tanpa mengubah
                    kode permainan.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    soundManager.playClick();
                    const { settings: s } = resetToDemoSeedData();
                    onUpdateSettings(s);
                    onUpdateStudents([]);
                    setStatusBanner('Cache siswa lokal berhasil dibersihkan! Silakan tekan "Sinkron Data" untuk memuat data dari Supabase.');
                  }}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-sky-950 font-bold text-xs cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Bersihkan Cache Siswa Lokal</span>
                </button>
              </div>

              <div className="bg-sky-950 border border-cyan-500/40 rounded-2xl p-4">
                <div className="text-xs font-bold text-yellow-300 mb-2">
                  Skema Tabel SQL Supabase (Siap Pakai untuk Produksi / Netlify):
                </div>
                <pre className="p-3 rounded-xl bg-slate-950 text-cyan-200 font-mono text-xs overflow-x-auto">
                  {SUPABASE_SCHEMA_SQL}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 7: STUDENT ACCOUNTS & PASSWORD RESET */}
          {activeTab === 'accounts' && (
            <div className="space-y-4">
              <div className="bg-sky-950 border-2 border-cyan-500/40 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold font-['Fredoka'] text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-yellow-300" />
                    <span>Manajemen Akun Siswa & Pemulihan Password</span>
                  </h3>
                  <p className="text-xs text-cyan-200 mt-0.5">
                    Guru dapat memverifikasi identitas siswa dan mereset password akun siswa. Seluruh riwayat skor dan progres tetap utuh.
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
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

              <div className="bg-sky-950 border-2 border-cyan-500/40 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-sky-900/90 text-cyan-200 uppercase font-bold text-[11px] border-b border-cyan-500/30">
                      <tr>
                        <th className="py-3 px-4">Siswa & Username</th>
                        <th className="py-3 px-4">Karakter</th>
                        <th className="py-3 px-4 text-center">Skor Solo Terbaik</th>
                        <th className="py-3 px-4 text-center">Skor Championship</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4 text-center">Tindakan Pemulihan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cyan-500/20 text-cyan-100 font-semibold">
                      {students
                        .filter(
                          (s) =>
                            !participantSearch ||
                            s.name.toLowerCase().includes(participantSearch.toLowerCase()) ||
                            (s.username && s.username.toLowerCase().includes(participantSearch.toLowerCase())),
                        )
                        .map((student) => (
                          <tr key={student.id} className="hover:bg-sky-900/40 transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-bold text-white text-sm">{student.name}</div>
                              <div className="text-[11px] text-yellow-300 font-mono">
                                @{student.username || student.normalizedName}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <CharacterAvatarSvg
                                  characterId={student.characterId}
                                  className="w-8 h-8 shrink-0"
                                />
                                <span className="font-bold text-white capitalize">
                                  {CHARACTERS.find((c) => c.id === student.characterId)?.name}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center font-mono font-bold text-yellow-300 tabular-nums">
                              {student.solo?.bestTotalScore || 0} Poin
                            </td>
                            <td className="py-3 px-4 text-center font-mono font-bold text-cyan-300 tabular-nums">
                              {student.championship?.totalChampionshipScore || 0} Poin
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-950 border border-emerald-400 text-emerald-300">
                                <UserCheck className="w-3 h-3" /> Akun Terverifikasi
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  soundManager.playClick();
                                  setResetTargetStudent(student);
                                  setNewPasswordInput('');
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-sky-950 font-['Fredoka'] font-bold text-xs border border-white cursor-pointer shadow-md transition-transform active:scale-95"
                              >
                                <KeyRound className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>Reset Password</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

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
                onClick={() => setResetTargetStudent(null)}
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
                Username: @{resetTargetStudent.username || resetTargetStudent.normalizedName}
              </div>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                soundManager.playClick();
                if (!newPasswordInput || newPasswordInput.length < 6) {
                  alert('Password baru minimal 6 karakter.');
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
                  );
                  if (res.ok) {
                    setStatusBanner(
                      res.message ||
                        `Password untuk siswa ${resetTargetStudent.name} (@${targetUsername}) telah berhasil di-reset!`,
                    );
                    setResetTargetStudent(null);
                    setNewPasswordInput('');
                  } else {
                    alert(res.message || 'Gagal reset password.');
                  }
                } catch (err: any) {
                  alert(err?.message || 'Gagal mereset password.');
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
                  onClick={() => setResetTargetStudent(null)}
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
    </div>
  );
};
