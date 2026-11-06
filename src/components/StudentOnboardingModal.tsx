import React, { useState } from 'react';
import {
  AlertTriangle,
  Eye,
  EyeOff,
  LogIn,
  LogOut,
  Play,
  Sparkles,
  User,
  Lock,
} from 'lucide-react';
import { CHARACTERS } from '../data/locations';
import {
  loginStudentAccount,
  logoutStudentAccount,
} from '../services/supabaseService';
import { upsertStudentInLocalStorage } from '../services/gameStorage';
import { ClassSettings, GameMode, StudentProfile } from '../types/game';
import { soundManager } from '../utils/sound';
import { AquaLogoSvg, CharacterAvatarSvg } from './AquaLogoSvg';

interface StudentOnboardingModalProps {
  settings: ClassSettings;
  initialProfile: StudentProfile | null;
  initialMode: GameMode;
  initialTab?: 'roster' | 'register' | 'login';
  onCompleteOnboarding: (profile: StudentProfile, mode: GameMode) => void;
  onLogoutStudent?: () => void;
  onCancelToTitle: () => void;
}

export const StudentOnboardingModal: React.FC<StudentOnboardingModalProps> = ({
  initialProfile,
  initialMode,
  onCompleteOnboarding,
  onLogoutStudent,
  onCancelToTitle,
}) => {
  const [usernameInput, setUsernameInput] = useState(initialProfile?.username || '');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedMode, setSelectedMode] = useState<GameMode>(initialMode);
  const [activeProfile, setActiveProfile] = useState<StudentProfile | null>(initialProfile);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.playClick();
    setErrorMessage(null);

    const cleanedUsername = usernameInput.trim().toLowerCase();
    if (!cleanedUsername) {
      setErrorMessage('Masukkan Username siswamu terlebih dahulu (contoh: afina01).');
      return;
    }
    if (!passwordInput) {
      setErrorMessage('Masukkan Password siswamu terlebih dahulu.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await loginStudentAccount(cleanedUsername, passwordInput);

      if (!res.ok || !res.profile) {
        setErrorMessage(
          res.message || 'Username atau password salah. Jika lupa password, hubungi Guru!',
        );
        setIsSubmitting(false);
        return;
      }

      // Persist student profile locally and immediately enter the 3D game
      upsertStudentInLocalStorage(res.profile);
      setActiveProfile(res.profile);
      soundManager.playMissionComplete();
      onCompleteOnboarding(res.profile, selectedMode);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Terjadi kesalahan saat masuk ke akun siswa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogoutCurrentStudent = async () => {
    soundManager.playClick();
    await logoutStudentAccount();
    setActiveProfile(null);
    setUsernameInput('');
    setPasswordInput('');
    setErrorMessage(null);
    if (onLogoutStudent) {
      onLogoutStudent();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Login Siswa Aqua Math Adventure"
      className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-5 bg-sky-950/90 overflow-y-auto pointer-events-auto"
    >
      <div className="w-full max-w-lg bg-sky-900 border-4 border-cyan-400 rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[94vh]">
        {/* Top Banner */}
        <div className="bg-sky-950 px-5 py-3.5 border-b-2 border-cyan-500/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <AquaLogoSvg compact className="h-9 w-auto" />
            <div className="leading-tight">
              <div className="text-xs font-extrabold text-yellow-300 uppercase tracking-wider">
                PORTAL SISWA KELAS 5
              </div>
              <div className="text-xs font-bold text-cyan-200">
                Masuk Petualangan 3D Aqua City
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              soundManager.playClick();
              onCancelToTitle();
            }}
            className="px-3.5 py-1.5 rounded-xl bg-sky-800 hover:bg-sky-700 text-cyan-100 text-xs font-bold border border-cyan-400/40 cursor-pointer whitespace-nowrap"
          >
            Kembali
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {/* Active Student Banner (if already logged in on this device) */}
          {activeProfile && (
            <div className="bg-sky-950/90 border-2 border-emerald-400/80 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <CharacterAvatarSvg
                    characterId={activeProfile.characterId}
                    className="w-12 h-12 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-[10px] font-extrabold text-emerald-300 uppercase tracking-wider">
                      AKUN SISWA AKTIF SAAT INI
                    </div>
                    <div className="text-base font-bold font-['Fredoka'] text-white truncate">
                      {activeProfile.name}
                    </div>
                    <div className="text-xs text-cyan-200">
                      Username: <strong className="font-mono text-yellow-300">{activeProfile.username}</strong> · Karakter:{' '}
                      <strong className="text-cyan-300">
                        {CHARACTERS.find((c) => c.id === activeProfile.characterId)?.name || 'Sinta'}
                      </strong>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  data-testid="student-logout-btn"
                  onClick={handleLogoutCurrentStudent}
                  className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold border border-rose-300/60 flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Keluar Akun</span>
                </button>
              </div>

              <button
                type="button"
                data-testid="continue-active-student-btn"
                onClick={() => {
                  soundManager.playMissionComplete();
                  onCompleteOnboarding(activeProfile, selectedMode);
                }}
                className="w-full py-3 rounded-2xl bg-emerald-400 hover:bg-emerald-300 text-sky-950 font-['Fredoka'] font-bold text-sm sm:text-base border-2 border-white shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-sky-950 text-sky-950" />
                <span>LANJUTKAN BERMAIN SEBAGAI {activeProfile.name.toUpperCase()}</span>
              </button>
            </div>
          )}

          {/* Header Card */}
          <div className="bg-sky-950/90 p-4 rounded-2xl border-2 border-cyan-400/60 text-center space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-yellow-300 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>LOGIN AKUN SISWA</span>
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-xl font-bold font-['Fredoka'] text-white">
              Ketik Username & Password Kamu
            </h2>
            <p className="text-xs text-cyan-200">
              Gunakan Username (contoh: <code className="text-yellow-300 font-bold">afina01</code>) dan Password dari Guru Kelasmu!
            </p>
          </div>

          {errorMessage && (
            <div
              role="alert"
              data-testid="student-login-error"
              className="p-3.5 rounded-2xl bg-rose-950 border-2 border-rose-400 text-rose-100 text-xs sm:text-sm font-semibold flex items-center gap-2.5"
            >
              <AlertTriangle className="w-5 h-5 text-rose-300 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Simple Child-Friendly Login Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="student-login-username"
                className="block text-xs font-bold text-cyan-100 mb-1.5"
              >
                Username Siswa
              </label>
              <div className="relative">
                <User className="w-5 h-5 text-cyan-300 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="student-login-username"
                  data-testid="student-username-input"
                  type="text"
                  required
                  autoComplete="username"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value.trim().toLowerCase())}
                  placeholder="Contoh: afina01"
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-sky-950 border-2 border-cyan-400 text-white font-mono font-bold text-base sm:text-lg focus:outline-none focus:border-yellow-400"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="student-login-password"
                className="block text-xs font-bold text-cyan-100 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-cyan-300 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="student-login-password"
                  data-testid="student-password-input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Masukkan password..."
                  className="w-full pl-11 pr-12 py-3.5 rounded-2xl bg-sky-950 border-2 border-cyan-400 text-white font-bold text-base sm:text-lg focus:outline-none focus:border-yellow-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Sembunyikan Password' : 'Lihat Password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-cyan-300 hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Mode Selection */}
            <div>
              <label className="block text-xs font-bold text-cyan-100 mb-1.5">
                Pilih Mode Petualangan:
              </label>
              <div className="grid grid-cols-2 gap-2.5 bg-sky-950 p-1.5 rounded-2xl border border-cyan-400/50">
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playClick();
                    setSelectedMode('solo');
                  }}
                  className={`py-2.5 px-3 rounded-xl font-['Fredoka'] font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                    selectedMode === 'solo'
                      ? 'bg-cyan-400 text-sky-950 shadow-md'
                      : 'text-cyan-200 hover:text-white'
                  }`}
                >
                  Solo Adventure
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playClick();
                    setSelectedMode('championship');
                  }}
                  className={`py-2.5 px-3 rounded-xl font-['Fredoka'] font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                    selectedMode === 'championship'
                      ? 'bg-yellow-400 text-sky-950 shadow-md'
                      : 'text-cyan-200 hover:text-white'
                  }`}
                >
                  Class Championship
                </button>
              </div>
            </div>

            {/* Submit MASUK Button */}
            <button
              type="submit"
              data-testid="student-login-submit"
              disabled={isSubmitting}
              className="w-full py-4 rounded-2xl bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-500 hover:from-yellow-200 hover:to-amber-400 text-sky-950 font-['Fredoka'] font-bold text-lg sm:text-xl border-2 border-white shadow-xl cursor-pointer flex items-center justify-center gap-2.5 disabled:opacity-50"
            >
              <LogIn className="w-6 h-6 stroke-[2.75]" />
              <span>{isSubmitting ? 'MEMVERIFIKASI AKUN...' : 'MASUK'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
