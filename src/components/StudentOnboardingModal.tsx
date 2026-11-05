import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  KeyRound,
  Lock,
  LogIn,
  Play,
  ShieldCheck,
  Unlock,
  User,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { CHARACTERS, LEVELS, MISSION_LOCATIONS } from '../data/locations';
import {
  loginStudentAccount,
  registerStudentAccount,
  selectStudentIdentity,
  verifyClassAccessCode,
} from '../services/supabaseService';
import { CharacterId, ClassSettings, GameMode, StudentProfile } from '../types/game';
import { soundManager } from '../utils/sound';
import { AquaLogoSvg, CharacterAvatarSvg, MedalBadgeSvg } from './AquaLogoSvg';

interface StudentOnboardingModalProps {
  settings: ClassSettings;
  initialProfile: StudentProfile | null;
  initialMode: GameMode;
  initialTab?: 'roster' | 'register' | 'login';
  onCompleteOnboarding: (profile: StudentProfile, mode: GameMode) => void;
  onCancelToTitle: () => void;
}

type OnboardingStep = 'access_code' | 'select_roster' | 'credentials' | 'profile_overview';

export const StudentOnboardingModal: React.FC<StudentOnboardingModalProps> = ({
  settings,
  initialProfile,
  initialMode,
  onCompleteOnboarding,
  onCancelToTitle,
}) => {
  const [authMode, setAuthMode] = useState<'roster' | 'register' | 'login'>('roster');
  const [step, setStep] = useState<OnboardingStep>(
    initialProfile ? 'profile_overview' : 'access_code',
  );

  // Class 5 Roster Selection State
  const [accessCodeInput, setAccessCodeInput] = useState(settings.accessCode || 'AQUA2026');
  const [rosterClassInfo, setRosterClassInfo] = useState<{
    className: string;
    teacherName: string;
    students: Array<{ id: string; name: string; username: string; characterId: CharacterId; hasPin: boolean }>;
  } | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentPinInput, setStudentPinInput] = useState<string>('');

  // Form fields for registration & login
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);

  // Step 1: Verify Access Code & Fetch Class 5 Roster
  const handleVerifyAccessCode = async (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.playClick();
    setErrorMessage(null);

    const cleanedCode = accessCodeInput.trim().toUpperCase();
    if (!cleanedCode) {
      setErrorMessage('Masukkan Kode Akses Kelas dari Guru (Contoh: AQUA2026).');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await verifyClassAccessCode(cleanedCode);
      if (!res.ok) {
        setErrorMessage(res.message || 'Kode Akses Kelas salah. Minta kode ke Guru Kelas!');
        setIsSubmitting(false);
        return;
      }

      setRosterClassInfo({
        className: res.className || 'Kelas 5 SD',
        teacherName: res.teacherName || 'Ibu/Bapak Guru Kelas 5',
        students: res.students || [],
      });

      if (res.students && res.students.length > 0) {
        setSelectedStudentId(res.students[0].id);
        setSelectedCharacter(res.students[0].characterId || 'sinta');
      }

      setStep('select_roster');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal memverifikasi kode akses kelas.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: Confirm Student Name & Character Choice
  const handleConfirmRosterSelection = async (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.playClick();
    setErrorMessage(null);

    if (!selectedStudentId) {
      setErrorMessage('Silakan pilih namamu dari daftar siswa Kelas 5!');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await selectStudentIdentity(selectedStudentId, selectedCharacter, studentPinInput);
      if (!res.ok || !res.profile) {
        setErrorMessage(res.message || 'Gagal masuk menggunakan nama siswa yang dipilih.');
        setIsSubmitting(false);
        return;
      }

      setActiveProfile(res.profile);
      setStep('profile_overview');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Terjadi kesalahan saat masuk.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Permanent Registration
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.playClick();
    setErrorMessage(null);

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
      setStep('profile_overview');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Terjadi kesalahan sistem saat membuat akun.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Permanent Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.playClick();
    setErrorMessage(null);

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

  const selectedRosterItem = rosterClassInfo?.students.find((s) => s.id === selectedStudentId);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Masuk Siswa Kelas 5 Aqua City"
      className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-5 bg-sky-950/90 overflow-y-auto pointer-events-auto"
    >
      <div className="w-full max-w-3xl bg-sky-900 border-4 border-cyan-400 rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Top Banner */}
        <div className="bg-sky-950 px-5 py-3 border-b-2 border-cyan-500/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <AquaLogoSvg compact className="h-10 w-auto" />
            <div className="text-xs font-bold text-cyan-200">
              {step === 'select_roster' ? 'Pilih Namamu di Kelas 5' : 'Masuk Siswa Aqua City'}
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

        {/* STEP 1: ACCESS CODE ENTRY */}
        {step === 'access_code' && (
          <div className="p-5 sm:p-7 space-y-5 overflow-y-auto">
            <div className="bg-sky-950/90 p-4 rounded-2xl border-2 border-cyan-400/60 text-center space-y-1">
              <div className="text-xs font-bold text-yellow-300 uppercase tracking-wider">
                MASUK SEBAGAI SISWA KELAS 5
              </div>
              <h2 className="text-xl font-bold font-['Fredoka'] text-white">
                Masukkan Kode Akses Kelas dari Gurumu
              </h2>
              <p className="text-xs text-cyan-200 max-w-md mx-auto">
                Tanpa perlu email atau password! Cukup masukkan kode akses dari Guru untuk memilih namamu.
              </p>
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

            <form onSubmit={handleVerifyAccessCode} className="space-y-4 max-w-md mx-auto">
              <div>
                <label htmlFor="input-access-code" className="block text-xs font-bold text-cyan-100 mb-1.5">
                  Kode Akses Kelas:
                </label>
                <input
                  id="input-access-code"
                  type="text"
                  required
                  value={accessCodeInput}
                  onChange={(e) => setAccessCodeInput(e.target.value.toUpperCase())}
                  placeholder="Contoh: AQUA2026"
                  className="w-full px-4 py-3.5 rounded-2xl bg-sky-950 border-2 border-cyan-400 text-white font-mono font-extrabold text-xl text-center uppercase tracking-widest focus:outline-none focus:border-yellow-400"
                />
                <p className="text-[10px] text-cyan-200 mt-1 text-center">
                  Tanyakan Kode Akses Kelas kepada Guru Pembimbing jika belum memiliki kode!
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-sky-950 font-['Fredoka'] font-bold text-lg border-2 border-white shadow-lg cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>{isSubmitting ? 'Memverifikasi...' : 'LANJUT PILIH NAMAMU'}</span>
                <ArrowRight className="w-5 h-5 stroke-[2.75]" />
              </button>
            </form>

            {/* Optional tab for permanent account credentials if needed */}
            <div className="pt-3 border-t border-cyan-500/30 text-center">
              <button
                type="button"
                onClick={() => {
                  soundManager.playClick();
                  setStep('credentials');
                }}
                className="text-xs text-cyan-300 hover:text-yellow-300 underline font-bold cursor-pointer"
              >
                Atau gunakan Username & Password Akun Permanen
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: ROSTER SELECTION & CHARACTER CHOICE */}
        {step === 'select_roster' && (
          <div className="p-5 sm:p-7 space-y-5 overflow-y-auto">
            <div className="bg-sky-950/80 p-4 rounded-2xl border border-cyan-500/40 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold text-yellow-300 uppercase">
                  KELAS: {rosterClassInfo?.className || 'Kelas 5 SD'}
                </div>
                <div className="text-sm font-bold text-white">
                  Pembimbing: {rosterClassInfo?.teacherName || 'Guru Kelas 5'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStep('access_code')}
                className="px-3 py-1 rounded-xl bg-sky-800 text-cyan-200 text-xs font-bold hover:bg-sky-700 cursor-pointer"
              >
                Ganti Kode Kelas
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

            <form onSubmit={handleConfirmRosterSelection} className="space-y-4">
              {/* Roster Selection Dropdown or List */}
              <div>
                <label className="block text-xs font-bold text-cyan-100 mb-1.5">
                  1. Pilih Namamu dari Daftar Siswa Terdaftar:
                </label>

                {rosterClassInfo?.students && rosterClassInfo.students.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto p-1 bg-sky-950 rounded-2xl border-2 border-cyan-400/60">
                    {rosterClassInfo.students.map((st) => {
                      const isSelected = selectedStudentId === st.id;
                      return (
                        <div
                          key={st.id}
                          onClick={() => {
                            soundManager.playClick();
                            setSelectedStudentId(st.id);
                            if (st.characterId) setSelectedCharacter(st.characterId);
                          }}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-sky-800 border-yellow-400 shadow-md ring-2 ring-yellow-400'
                              : 'bg-sky-900/60 border-cyan-500/30 hover:bg-sky-900'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <CharacterAvatarSvg characterId={st.characterId || 'sinta'} className="w-7 h-7 shrink-0" />
                            <span className="text-xs font-bold text-white truncate">{st.name}</span>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-yellow-300 stroke-[3] shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-sky-950 border-2 border-amber-400/60 text-center space-y-2">
                    <p className="text-xs text-amber-200">
                      Belum ada daftar nama siswa yang dimasukkan oleh Guru di kelas ini.
                    </p>
                    <button
                      type="button"
                      onClick={() => setStep('credentials')}
                      className="px-4 py-2 rounded-xl bg-yellow-400 text-sky-950 text-xs font-bold cursor-pointer"
                    >
                      Daftar Akun Baru Secara Mandiri
                    </button>
                  </div>
                )}
              </div>

              {/* Optional PIN Code if student has a PIN set */}
              {selectedRosterItem?.hasPin && (
                <div className="bg-sky-950 p-3.5 rounded-2xl border-2 border-yellow-400/70">
                  <label htmlFor="student-pin" className="block text-xs font-bold text-yellow-300 mb-1">
                    Masukkan PIN Siswamu (4 Angka):
                  </label>
                  <input
                    id="student-pin"
                    type="password"
                    maxLength={6}
                    value={studentPinInput}
                    onChange={(e) => setStudentPinInput(e.target.value)}
                    placeholder="Masukkan PIN..."
                    className="w-full px-3.5 py-2 rounded-xl bg-sky-900 border border-yellow-400 text-white font-mono font-bold text-center tracking-widest text-lg focus:outline-none"
                  />
                </div>
              )}

              {/* Character Choice Selection */}
              <div>
                <label className="block text-xs font-bold text-yellow-300 mb-2">
                  2. Pilih Karakter Utama Petualang:
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
                        <CharacterAvatarSvg characterId={char.id} className="w-12 h-12 shrink-0" />
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
                <button
                  type="button"
                  onClick={() => setStep('access_code')}
                  className="px-4 py-2.5 rounded-xl bg-sky-800 text-cyan-100 text-xs font-bold cursor-pointer"
                >
                  Kembali
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || !selectedStudentId}
                  className="px-7 py-3.5 rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-sky-950 font-['Fredoka'] font-bold text-base border-2 border-white shadow-lg cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  <Play className="w-5 h-5 fill-sky-950 text-sky-950" />
                  <span>{isSubmitting ? 'Memuat Profil...' : 'MASUK KE GAME 3D'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* STEP 3: OPTIONAL PERMANENT CREDENTIALS (USERNAME/PASSWORD) */}
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
                className={`py-2.5 rounded-xl font-['Fredoka'] font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  authMode === 'register'
                    ? 'bg-yellow-400 text-sky-950 shadow-md'
                    : 'text-cyan-200 hover:text-white hover:bg-sky-900/60'
                }`}
              >
                <UserPlus className="w-4 h-4 stroke-[2.75]" />
                <span>DAFTAR AKUN BARU</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundManager.playClick();
                  setAuthMode('login');
                  setErrorMessage(null);
                }}
                className={`py-2.5 rounded-xl font-['Fredoka'] font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  authMode === 'login'
                    ? 'bg-yellow-400 text-sky-950 shadow-md'
                    : 'text-cyan-200 hover:text-white hover:bg-sky-900/60'
                }`}
              >
                <LogIn className="w-4 h-4 stroke-[2.75]" />
                <span>LOGIN USERNAME</span>
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

            {authMode === 'register' ? (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="reg-access-code" className="block text-xs font-bold text-cyan-100 mb-1">
                      1. Kode Akses Kelas
                    </label>
                    <input
                      id="reg-access-code"
                      type="text"
                      required
                      value={accessCodeInput}
                      onChange={(e) => setAccessCodeInput(e.target.value.toUpperCase())}
                      placeholder="Contoh: AQUA2026"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-sky-950 border-2 border-cyan-400 text-white font-mono font-bold text-base uppercase focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="reg-full-name" className="block text-xs font-bold text-cyan-100 mb-1">
                      2. Nama Lengkap Siswa
                    </label>
                    <input
                      id="reg-full-name"
                      type="text"
                      required
                      value={fullNameInput}
                      onChange={(e) => setFullNameInput(e.target.value)}
                      placeholder="Tulis nama lengkapmu..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-sky-950 border-2 border-cyan-400 text-white font-bold text-base focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="reg-username" className="block text-xs font-bold text-cyan-100 mb-1">
                      3. Username Akun
                    </label>
                    <input
                      id="reg-username"
                      type="text"
                      required
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="Contoh: bima_kelas5"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-sky-950 border-2 border-cyan-400 text-white font-mono font-bold text-base focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="reg-password" className="block text-xs font-bold text-cyan-100 mb-1">
                        4. Password
                      </label>
                      <input
                        id="reg-password"
                        type="password"
                        required
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="Min. 6 karakter"
                        className="w-full px-3 py-2.5 rounded-xl bg-sky-950 border-2 border-cyan-400 text-white font-bold text-sm focus:outline-none"
                      />
                    </div>

                    <div>
                      <label htmlFor="reg-confirm-password" className="block text-xs font-bold text-cyan-100 mb-1">
                        5. Konfirmasi
                      </label>
                      <input
                        id="reg-confirm-password"
                        type="password"
                        required
                        value={confirmPasswordInput}
                        onChange={(e) => setConfirmPasswordInput(e.target.value)}
                        placeholder="Ulangi password"
                        className="w-full px-3 py-2.5 rounded-xl bg-sky-950 border-2 border-cyan-400 text-white font-bold text-sm focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep('access_code')}
                    className="px-4 py-2 rounded-xl bg-sky-800 text-cyan-200 text-xs font-bold cursor-pointer"
                  >
                    Masuk Tanpa Password
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-3 rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-sky-950 font-['Fredoka'] font-bold text-base border-2 border-white cursor-pointer disabled:opacity-50"
                  >
                    <span>{isSubmitting ? 'Membuat Akun...' : 'DAFTAR & MASUK'}</span>
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleLoginSubmit} className="space-y-4 max-w-lg mx-auto py-2">
                <div>
                  <label htmlFor="login-username" className="block text-xs font-bold text-cyan-100 mb-1">
                    Username Siswa
                  </label>
                  <input
                    id="login-username"
                    type="text"
                    required
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="Masukkan username kamu..."
                    className="w-full px-4 py-3 rounded-2xl bg-sky-950 border-2 border-cyan-400 text-white font-mono font-bold text-lg focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="login-password" className="block text-xs font-bold text-cyan-100 mb-1">
                    Password
                  </label>
                  <input
                    id="login-password"
                    type="password"
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Masukkan password kamu..."
                    className="w-full px-4 py-3 rounded-2xl bg-sky-950 border-2 border-cyan-400 text-white font-bold text-lg focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep('access_code')}
                    className="px-4 py-2 rounded-xl bg-sky-800 text-cyan-200 text-xs font-bold cursor-pointer"
                  >
                    Masuk Tanpa Password
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-3 rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-sky-950 font-['Fredoka'] font-bold text-base border-2 border-white cursor-pointer disabled:opacity-50"
                  >
                    <span>{isSubmitting ? 'Memverifikasi...' : 'LOGIN SISWA'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* STEP 4: PROFILE OVERVIEW */}
        {step === 'profile_overview' && activeProfile && (
          <div className="p-5 sm:p-7 space-y-5 overflow-y-auto">
            <div className="bg-sky-950 border-2 border-cyan-400/60 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <CharacterAvatarSvg characterId={activeProfile.characterId} className="w-16 h-16 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                    Siswa Kelas 5 · Aqua City
                  </div>
                  <h2 className="text-2xl font-bold font-['Fredoka'] text-white">{activeProfile.name}</h2>
                  <div className="text-xs text-cyan-200 mt-0.5">
                    Karakter:{' '}
                    <strong className="text-yellow-300">
                      {CHARACTERS.find((c) => c.id === activeProfile.characterId)?.name}
                    </strong>{' '}
                    · Level Terbuka:{' '}
                    <strong className="text-emerald-300">
                      Level{' '}
                      {selectedMode === 'solo'
                        ? activeProfile.solo?.unlockedLevel || 1
                        : activeProfile.championship?.unlockedLevel || 1}{' '}
                      / 5
                    </strong>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-sky-900 p-1.5 rounded-xl border border-cyan-400/40">
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playClick();
                    setSelectedMode('solo');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                    selectedMode === 'solo' ? 'bg-cyan-400 text-sky-950' : 'text-cyan-200 hover:text-white'
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
                    selectedMode === 'championship' ? 'bg-yellow-400 text-sky-950' : 'text-cyan-200 hover:text-white'
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
                  {activeProfile.solo?.bestTotalScore || 0} / 1000
                </div>
              </div>
              <div className="bg-sky-950 border border-cyan-400/40 rounded-2xl p-3 text-center">
                <div className="text-[10px] text-cyan-300 font-bold">SKOR TERAKHIR SOLO</div>
                <div className="text-xl font-extrabold font-mono text-cyan-200 tabular-nums mt-0.5">
                  {activeProfile.solo?.latestTotalScore || 0} Poin
                </div>
              </div>
              <div className="bg-sky-950 border border-yellow-400/60 rounded-2xl p-3 text-center">
                <div className="text-[10px] text-yellow-300 font-bold">CHAMPIONSHIP SCORE</div>
                <div className="text-xl font-extrabold font-mono text-yellow-300 tabular-nums mt-0.5">
                  {activeProfile.championship?.totalChampionshipScore || 0} / 1000
                </div>
              </div>
              <div className="bg-sky-950 border border-cyan-400/40 rounded-2xl p-3 text-center">
                <div className="text-[10px] text-emerald-300 font-bold">NILAI AKADEMIK</div>
                <div className="text-xl font-extrabold font-mono text-emerald-300 tabular-nums mt-0.5">
                  {selectedMode === 'solo'
                    ? activeProfile.solo?.academicGrade || 0
                    : activeProfile.championship?.academicGrade || 0}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  soundManager.playClick();
                  setStep('access_code');
                }}
                className="px-4 py-2.5 rounded-xl bg-sky-800 hover:bg-sky-700 text-cyan-100 text-sm font-bold cursor-pointer"
              >
                Ganti Nama / Kode Kelas
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
      </div>
    </div>
  );
};
