import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Compass,
  KeyRound,
  Lock,
  LogIn,
  Play,
  ShieldCheck,
  Trophy,
  Unlock,
  User,
  UserPlus,
} from 'lucide-react';
import { CHARACTERS, LEVELS, MISSION_LOCATIONS } from '../data/locations';
import { loginStudentAccount, registerStudentAccount } from '../services/supabaseService';
import { CharacterId, ClassSettings, GameMode, StudentProfile } from '../types/game';
import { soundManager } from '../utils/sound';
import { AquaLogoSvg, CharacterAvatarSvg, MedalBadgeSvg } from './AquaLogoSvg';

interface StudentOnboardingModalProps {
  settings: ClassSettings;
  initialProfile: StudentProfile | null;
  initialMode: GameMode;
  initialTab?: 'register' | 'login';
  onCompleteOnboarding: (profile: StudentProfile, mode: GameMode) => void;
  onCancelToTitle: () => void;
}

type OnboardingStep = 'credentials' | 'character_and_mode' | 'profile_overview';

export const StudentOnboardingModal: React.FC<StudentOnboardingModalProps> = ({
  settings,
  initialProfile,
  initialMode,
  initialTab = 'register',
  onCompleteOnboarding,
  onCancelToTitle,
}) => {
  const [authMode, setAuthMode] = useState<'register' | 'login'>(initialTab);
  const [step, setStep] = useState<OnboardingStep>(
    initialProfile ? 'profile_overview' : 'credentials',
  );

  // Form fields for registration & login
  const [accessCodeInput, setAccessCodeInput] = useState(settings.accessCode);
  const [fullNameInput, setFullNameInput] = useState(initialProfile?.name || '');
  const [usernameInput, setUsernameInput] = useState(initialProfile?.username || '');
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterId>(
    initialProfile?.characterId || 'sinta',
  );
  const [selectedMode, setSelectedMode] = useState<GameMode>(initialMode);

  // Active state & modals
  const [activeProfile, setActiveProfile] = useState<StudentProfile | null>(initialProfile);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);

  // Handle Registration
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.playClick();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanedCode = accessCodeInput.trim().toUpperCase();
    const cleanedName = fullNameInput.trim().replace(/\s+/g, ' ');
    const cleanedUsername = usernameInput.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');

    if (!cleanedCode) {
      setErrorMessage('Kode Akses Kelas wajib diisi (dapatkan dari Guru Kelas).');
      return;
    }
    if (cleanedName.length < 2) {
      setErrorMessage('Nama Lengkap Siswa wajib diisi (minimal 2 huruf).');
      return;
    }
    if (cleanedUsername.length < 3) {
      setErrorMessage('Username minimal 3 karakter (hanya huruf kecil, angka, dan _).');
      return;
    }
    if (passwordInput.length < 6) {
      setErrorMessage('Password minimal 6 karakter demi keamanan akunmu.');
      return;
    }
    if (passwordInput !== confirmPasswordInput) {
      setErrorMessage('Konfirmasi password tidak cocok dengan password yang dimasukkan.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await registerStudentAccount({
        accessCode: cleanedCode,
        name: cleanedName,
        username: cleanedUsername,
        password: passwordInput,
        confirmPassword: confirmPasswordInput,
        characterId: selectedCharacter,
      });

      if (!res.ok || !res.profile) {
        setErrorMessage(res.message || 'Pendaftaran gagal. Silakan coba lagi.');
        setIsSubmitting(false);
        return;
      }

      setActiveProfile(res.profile);
      setSuccessMessage(res.message || 'Akun siswa berhasil dibuat!');
      setStep('profile_overview');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Terjadi kesalahan sistem saat membuat akun.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.playClick();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanedUsername = usernameInput.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');

    if (!cleanedUsername) {
      setErrorMessage('Masukkan Username akun siswamu.');
      return;
    }
    if (!passwordInput) {
      setErrorMessage('Masukkan Password akun siswamu.');
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

      setActiveProfile(res.profile);
      setSelectedCharacter(res.profile.characterId);
      setSuccessMessage(`Selamat datang kembali, ${res.profile.name}!`);
      setStep('profile_overview');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Terjadi kesalahan saat masuk ke akun.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEnter3DWorld = () => {
    if (!activeProfile) return;
    soundManager.playMissionComplete();
    onCompleteOnboarding(activeProfile, selectedMode);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pendaftaran dan Login Akun Siswa"
      className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-5 bg-sky-950/90 overflow-y-auto pointer-events-auto"
    >
      <div className="w-full max-w-4xl bg-sky-900 border-4 border-cyan-400 rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Top Banner */}
        <div className="bg-sky-950 px-5 py-3 border-b-2 border-cyan-500/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <AquaLogoSvg compact className="h-10 w-auto" />
            <div className="text-xs font-bold text-cyan-200">
              {authMode === 'register' ? 'Pendaftaran Akun Permanen' : 'Masuk Akun Siswa'}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                soundManager.playClick();
                onCancelToTitle();
              }}
              className="px-3.5 py-1.5 rounded-xl bg-sky-800 hover:bg-sky-700 text-cyan-100 text-xs font-bold border border-cyan-400/40 cursor-pointer whitespace-nowrap"
            >
              Kembali ke Layar Utama
            </button>
          </div>
        </div>

        {/* STEP 1: CREDENTIALS (REGISTER vs LOGIN TAB SWITCHER) */}
        {step === 'credentials' && (
          <div className="p-5 sm:p-7 space-y-5 overflow-y-auto">
            {/* Tab Switcher */}
            <div className="grid grid-cols-2 gap-2 bg-sky-950 p-1.5 rounded-2xl border-2 border-cyan-400/50">
              <button
                type="button"
                onClick={() => {
                  soundManager.playClick();
                  setAuthMode('register');
                  setErrorMessage(null);
                }}
                className={`py-2.5 rounded-xl font-['Fredoka'] font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  authMode === 'register'
                    ? 'bg-yellow-400 text-sky-950 shadow-md scale-[1.01]'
                    : 'text-cyan-200 hover:text-white hover:bg-sky-900/60'
                }`}
              >
                <UserPlus className="w-4 h-4 stroke-[2.75]" />
                <span>MULAI SEBAGAI SISWA (DAFTAR AKUN)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundManager.playClick();
                  setAuthMode('login');
                  setErrorMessage(null);
                }}
                className={`py-2.5 rounded-xl font-['Fredoka'] font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  authMode === 'login'
                    ? 'bg-yellow-400 text-sky-950 shadow-md scale-[1.01]'
                    : 'text-cyan-200 hover:text-white hover:bg-sky-900/60'
                }`}
              >
                <LogIn className="w-4 h-4 stroke-[2.75]" />
                <span>LOGIN SISWA</span>
              </button>
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="p-3.5 rounded-2xl bg-rose-950 border-2 border-rose-400 text-rose-100 text-xs sm:text-sm font-semibold flex items-center gap-2.5"
              >
                <AlertTriangle className="w-5 h-5 text-rose-300 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* TAB A: REGISTER FORM */}
            {authMode === 'register' ? (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div className="bg-sky-950/80 p-4 rounded-2xl border border-cyan-500/30">
                  <h2 className="text-lg font-bold font-['Fredoka'] text-white">
                    Pendaftaran Akun Permanen Siswa Aqua City
                  </h2>
                  <p className="text-xs text-cyan-100 mt-0.5">
                    Buat akun permanen dengan Username & Password tanpa email. Akunmu dapat digunakan di perangkat mana saja!
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="reg-access-code"
                      className="block text-xs font-bold text-cyan-100 mb-1"
                    >
                      1. Kode Akses Kelas (Dari Guru)
                    </label>
                    <input
                      id="reg-access-code"
                      type="text"
                      required
                      value={accessCodeInput}
                      onChange={(e) => setAccessCodeInput(e.target.value.toUpperCase())}
                      placeholder="Contoh: AQUA2026"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-sky-950 border-2 border-cyan-400 text-white font-mono font-bold text-base uppercase focus:outline-none focus:border-yellow-400"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="reg-full-name"
                      className="block text-xs font-bold text-cyan-100 mb-1"
                    >
                      2. Nama Lengkap Siswa
                    </label>
                    <input
                      id="reg-full-name"
                      type="text"
                      required
                      value={fullNameInput}
                      onChange={(e) => setFullNameInput(e.target.value)}
                      placeholder="Tulis nama lengkapmu..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-sky-950 border-2 border-cyan-400 text-white font-bold text-base focus:outline-none focus:border-yellow-400"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="reg-username"
                      className="block text-xs font-bold text-cyan-100 mb-1"
                    >
                      3. Username Akun (Bisa untuk Login)
                    </label>
                    <input
                      id="reg-username"
                      type="text"
                      required
                      value={usernameInput}
                      onChange={(e) =>
                        setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                      }
                      placeholder="Contoh: bima_aqua2"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-sky-950 border-2 border-cyan-400 text-white font-mono font-bold text-base focus:outline-none focus:border-yellow-400"
                    />
                    <p className="text-[10px] text-cyan-200 mt-1">
                      Hanya huruf kecil, angka, dan garis bawah (_). Bebas tanpa spasi.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label
                        htmlFor="reg-password"
                        className="block text-xs font-bold text-cyan-100 mb-1"
                      >
                        4. Password
                      </label>
                      <input
                        id="reg-password"
                        type="password"
                        required
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="Min. 6 huruf/angka"
                        className="w-full px-3 py-2.5 rounded-xl bg-sky-950 border-2 border-cyan-400 text-white font-bold text-sm focus:outline-none focus:border-yellow-400"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="reg-confirm-password"
                        className="block text-xs font-bold text-cyan-100 mb-1"
                      >
                        5. Konfirmasi
                      </label>
                      <input
                        id="reg-confirm-password"
                        type="password"
                        required
                        value={confirmPasswordInput}
                        onChange={(e) => setConfirmPasswordInput(e.target.value)}
                        placeholder="Ulangi password"
                        className="w-full px-3 py-2.5 rounded-xl bg-sky-950 border-2 border-cyan-400 text-white font-bold text-sm focus:outline-none focus:border-yellow-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Character Choice selection */}
                <div>
                  <label className="block text-xs font-bold text-yellow-300 mb-2">
                    6. Pilih Karakter Utama Petualang
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {CHARACTERS.map((char) => {
                      const isSelected = selectedCharacter === char.id;
                      return (
                        <button
                          key={char.id}
                          type="button"
                          onClick={() => {
                            soundManager.playClick();
                            setSelectedCharacter(char.id);
                          }}
                          className={`p-3 rounded-2xl border-2 flex items-center gap-3 transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-sky-950 border-yellow-400 shadow-md'
                              : 'bg-sky-950/60 border-cyan-500/40 hover:border-cyan-300'
                          }`}
                        >
                          <CharacterAvatarSvg
                            characterId={char.id}
                            className="w-12 h-12 shrink-0"
                          />
                          <div className="text-left leading-tight">
                            <div className="font-['Fredoka'] font-bold text-white flex items-center gap-1.5">
                              <span>{char.name}</span>
                              {isSelected && <Check className="w-4 h-4 text-yellow-300 stroke-[3]" />}
                            </div>
                            <div className="text-[11px] text-cyan-300">{char.roleTitle}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <div className="text-xs text-cyan-200">
                    Kelas: <strong className="text-white">{settings.className}</strong>
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-7 py-3 rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-sky-950 font-['Fredoka'] font-bold text-base border-2 border-white shadow-lg cursor-pointer flex items-center gap-2 disabled:opacity-50"
                  >
                    <span>{isSubmitting ? 'Membuat Akun...' : 'DAFTAR AKUN & BERPETUALANG'}</span>
                    <ArrowRight className="w-5 h-5 stroke-[2.75]" />
                  </button>
                </div>
              </form>
            ) : (
              /* TAB B: LOGIN FORM */
              <form onSubmit={handleLoginSubmit} className="space-y-4 max-w-lg mx-auto py-2">
                <div className="bg-sky-950/80 p-4 rounded-2xl border border-cyan-500/30 text-center">
                  <h2 className="text-lg font-bold font-['Fredoka'] text-white">
                    Masuk Akun Siswa (Login)
                  </h2>
                  <p className="text-xs text-cyan-100 mt-0.5">
                    Masukkan Username dan Password yang sudah kamu daftarkan sebelumnya.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="login-username"
                    className="block text-xs font-bold text-cyan-100 mb-1"
                  >
                    Username Siswa
                  </label>
                  <input
                    id="login-username"
                    type="text"
                    required
                    value={usernameInput}
                    onChange={(e) =>
                      setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                    }
                    placeholder="Masukkan username kamu..."
                    className="w-full px-4 py-3 rounded-2xl bg-sky-950 border-2 border-cyan-400 text-white font-mono font-bold text-lg focus:outline-none focus:border-yellow-400"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="login-password"
                      className="block text-xs font-bold text-cyan-100"
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        soundManager.playClick();
                        setShowForgotPasswordModal(true);
                      }}
                      className="text-xs font-bold text-yellow-300 hover:underline cursor-pointer"
                    >
                      LUPA PASSWORD?
                    </button>
                  </div>
                  <input
                    id="login-password"
                    type="password"
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Masukkan password kamu..."
                    className="w-full px-4 py-3 rounded-2xl bg-sky-950 border-2 border-cyan-400 text-white font-bold text-lg focus:outline-none focus:border-yellow-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-sky-950 font-['Fredoka'] font-bold text-lg border-2 border-white shadow-lg cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <LogIn className="w-5 h-5 stroke-[2.75]" />
                  <span>{isSubmitting ? 'Memverifikasi...' : 'MASUK SEBAGAI SISWA'}</span>
                </button>
              </form>
            )}
          </div>
        )}

        {/* STEP 2: PROFILE OVERVIEW & WORLD MAP PREVIEW */}
        {step === 'profile_overview' && activeProfile && (
          <div className="p-5 sm:p-7 space-y-5 overflow-y-auto">
            <div className="bg-sky-950 border-2 border-cyan-400/60 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <CharacterAvatarSvg
                  characterId={activeProfile.characterId}
                  className="w-16 h-16 shrink-0"
                />
                <div>
                  <div className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                    Profil Akun Siswa · @{activeProfile.username || activeProfile.normalizedName}
                  </div>
                  <h2 className="text-2xl font-bold font-['Fredoka'] text-white">
                    {activeProfile.name}
                  </h2>
                  <div className="text-xs text-cyan-200 mt-0.5">
                    Karakter:{' '}
                    <strong className="text-yellow-300">
                      {CHARACTERS.find((c) => c.id === activeProfile.characterId)?.name}
                    </strong>{' '}
                    · Level Terbuka:{' '}
                    <strong className="text-emerald-300">
                      Level{' '}
                      {selectedMode === 'solo'
                        ? activeProfile.solo.unlockedLevel
                        : activeProfile.championship.unlockedLevel}{' '}
                      / 5
                    </strong>
                  </div>
                </div>
              </div>

              {/* Mode Selection Toggle inside Profile */}
              <div className="flex items-center gap-2 bg-sky-900 p-1.5 rounded-xl border border-cyan-400/40">
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playClick();
                    setSelectedMode('solo');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                    selectedMode === 'solo'
                      ? 'bg-cyan-400 text-sky-950'
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                    selectedMode === 'championship'
                      ? 'bg-yellow-400 text-sky-950'
                      : 'text-cyan-200 hover:text-white'
                  }`}
                >
                  Class Championship
                </button>
              </div>
            </div>

            {/* Score Stats Readout */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-sky-950 border border-cyan-400/40 rounded-2xl p-3 text-center">
                <div className="text-[10px] text-cyan-300 font-bold">SKOR TERBAIK SOLO</div>
                <div className="text-xl font-extrabold font-mono text-yellow-300 tabular-nums mt-0.5">
                  {activeProfile.solo.bestTotalScore} / 1000
                </div>
              </div>
              <div className="bg-sky-950 border border-cyan-400/40 rounded-2xl p-3 text-center">
                <div className="text-[10px] text-cyan-300 font-bold">SKOR TERAKHIR SOLO</div>
                <div className="text-xl font-extrabold font-mono text-cyan-200 tabular-nums mt-0.5">
                  {activeProfile.solo.latestTotalScore} Poin
                </div>
              </div>
              <div className="bg-sky-950 border border-yellow-400/60 rounded-2xl p-3 text-center">
                <div className="text-[10px] text-yellow-300 font-bold">CHAMPIONSHIP SCORE</div>
                <div className="text-xl font-extrabold font-mono text-yellow-300 tabular-nums mt-0.5">
                  {activeProfile.championship.totalChampionshipScore} / 1000
                </div>
              </div>
              <div className="bg-sky-950 border border-cyan-400/40 rounded-2xl p-3 text-center">
                <div className="text-[10px] text-emerald-300 font-bold">NILAI AKADEMIK</div>
                <div className="text-xl font-extrabold font-mono text-emerald-300 tabular-nums mt-0.5">
                  {selectedMode === 'solo'
                    ? activeProfile.solo.academicGrade
                    : activeProfile.championship.academicGrade}
                </div>
              </div>
            </div>

            {/* 5 Levels Map Overview Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
              {LEVELS.map((lvl) => {
                const unlockedLvl =
                  selectedMode === 'solo'
                    ? activeProfile.solo.unlockedLevel
                    : activeProfile.championship.unlockedLevel;
                const isUnlocked = lvl.id <= unlockedLvl;
                const locs = MISSION_LOCATIONS.filter((l) => l.levelId === lvl.id);

                return (
                  <div
                    key={lvl.id}
                    className={`p-3 rounded-2xl border-2 flex flex-col justify-between ${
                      isUnlocked
                        ? 'bg-sky-950 border-cyan-400/70'
                        : 'bg-sky-950/40 border-slate-700 opacity-75'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-yellow-300">{lvl.code}</span>
                        <span className="inline-flex items-center gap-1">
                          {isUnlocked ? (
                            <Unlock className="w-3.5 h-3.5 text-emerald-300" />
                          ) : (
                            <Lock className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </span>
                      </div>
                      <div className="font-['Fredoka'] font-bold text-sm text-white mt-0.5">
                        {lvl.title}
                      </div>
                    </div>

                    <div className="space-y-1.5 border-t border-cyan-500/20 pt-2 mt-2">
                      {locs.map((loc) => {
                        const soloRec = activeProfile.solo.locations[loc.id];
                        const champRec = activeProfile.championship.locations[loc.id];
                        const score =
                          selectedMode === 'solo'
                            ? soloRec?.bestScore
                            : champRec?.championshipScore;
                        const medal =
                          selectedMode === 'solo'
                            ? soloRec?.medal || 'none'
                            : champRec?.medal || 'none';
                        return (
                          <div
                            key={loc.id}
                            className="flex items-center justify-between text-[11px] bg-sky-900/70 px-2 py-1 rounded-lg"
                          >
                            <span className="truncate font-semibold text-cyan-100">
                              {loc.id}. {loc.name}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              {score !== undefined && (
                                <span className="font-mono font-bold text-yellow-300 tabular-nums">
                                  {score}
                                </span>
                              )}
                              <MedalBadgeSvg medal={medal} className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  soundManager.playClick();
                  setStep('credentials');
                }}
                className="px-4 py-2.5 rounded-xl bg-sky-800 hover:bg-sky-700 text-cyan-100 text-sm font-bold cursor-pointer"
              >
                Ganti Akun / Mode
              </button>

              <button
                type="button"
                onClick={handleEnter3DWorld}
                className="flex items-center gap-2.5 px-8 py-3.5 rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-sky-950 font-['Fredoka'] font-bold text-lg border-2 border-white shadow-xl cursor-pointer"
              >
                <Play className="w-5 h-5 fill-sky-950 text-sky-950" />
                <span>Terjun ke Dunia 3D Aqua City!</span>
              </button>
            </div>
          </div>
        )}

        {/* FORGOT PASSWORD INFORMATIVE MODAL */}
        {showForgotPasswordModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-sky-950/90 backdrop-blur-xs">
            <div className="w-full max-w-md bg-sky-900 border-4 border-yellow-400 rounded-3xl p-6 shadow-2xl space-y-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-yellow-400 text-sky-950 flex items-center justify-center mx-auto">
                <KeyRound className="w-7 h-7 stroke-[2.5]" />
              </div>

              <div>
                <h3 className="text-xl font-bold font-['Fredoka'] text-white">
                  Pemulihan Account & Reset Password
                </h3>
                <p className="text-xs text-cyan-100 mt-2 leading-relaxed">
                  Untuk keamanan, reset password siswa dilakukan oleh <strong>Guru Kelas</strong> melalui{' '}
                  <strong className="text-yellow-300">Portal Guru</strong>.
                </p>
              </div>

              <div className="bg-sky-950 p-3.5 rounded-2xl border border-cyan-500/40 text-left text-xs text-cyan-200 space-y-1.5">
                <div>1. Sampaikan namamu / username-mu kepada Guru Kelas.</div>
                <div>2. Guru akan mereset password-mu di Portal Guru.</div>
                <div>3. Gunakan password baru dari Guru untuk login kembali di perangkat ini!</div>
                <div className="text-emerald-300 font-bold pt-1">
                  ✓ Seluruh nilai, medali, dan progres permainan lama tetap tersimpan rapi!
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowForgotPasswordModal(false)}
                className="w-full py-3 rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-sky-950 font-['Fredoka'] font-bold text-base cursor-pointer border-2 border-white"
              >
                Mengerti
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
