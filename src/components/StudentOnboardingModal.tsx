import React, { useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Compass, Lock, Play, Trophy, Unlock } from 'lucide-react';
import { CHARACTERS, LEVELS, MISSION_LOCATIONS } from '../data/locations';
import { findStudentByName, registerOrUpdateStudent } from '../services/gameStorage';
import { CharacterId, ClassSettings, GameMode, StudentProfile } from '../types/game';
import { soundManager } from '../utils/sound';
import { AquaLogoSvg, CharacterAvatarSvg, MedalBadgeSvg } from './AquaLogoSvg';

interface StudentOnboardingModalProps {
  settings: ClassSettings;
  initialProfile: StudentProfile | null;
  initialMode: GameMode;
  onCompleteOnboarding: (profile: StudentProfile, mode: GameMode) => void;
  onCancelToTitle: () => void;
}

type OnboardingStep = 'credentials' | 'confirm_existing' | 'character_and_mode' | 'profile_overview';

export const StudentOnboardingModal: React.FC<StudentOnboardingModalProps> = ({
  settings,
  initialProfile,
  initialMode,
  onCompleteOnboarding,
  onCancelToTitle,
}) => {
  const [step, setStep] = useState<OnboardingStep>(
    initialProfile ? 'profile_overview' : 'credentials',
  );
  const [accessCodeInput, setAccessCodeInput] = useState(settings.accessCode);
  const [playerNameInput, setPlayerNameInput] = useState(initialProfile?.name || '');
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterId>(
    initialProfile?.characterId || 'sinta',
  );
  const [selectedMode, setSelectedMode] = useState<GameMode>(initialMode);
  const [matchedExistingStudent, setMatchedExistingStudent] = useState<StudentProfile | null>(null);
  const [activeProfile, setActiveProfile] = useState<StudentProfile | null>(initialProfile);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCheckCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    soundManager.playClick();
    setErrorMessage(null);

    if (!settings.accessCodeActive) {
      setErrorMessage('Kode akses kelas sedang dinonaktifkan oleh Guru. Silakan hubungi Guru Kelas.');
      return;
    }

    const cleanedCode = accessCodeInput.trim().toUpperCase();
    if (!cleanedCode) {
      setErrorMessage('Masukkan Kode Akses Kelas terlebih dahulu.');
      return;
    }

    if (cleanedCode !== settings.accessCode.trim().toUpperCase()) {
      setErrorMessage('Kode Akses Kelas tidak sesuai. Coba periksa kembali kode dari Guru!');
      return;
    }

    const cleanedName = playerNameInput.trim().replace(/\s+/g, ' ');
    if (cleanedName.length < 2) {
      setErrorMessage('Masukkan nama panggilan atau nama lengkapmu (minimal 2 huruf).');
      return;
    }

    const existing = findStudentByName(cleanedName);
    if (existing) {
      setMatchedExistingStudent(existing);
      setSelectedCharacter(existing.characterId);
      setStep('confirm_existing');
      return;
    }

    setStep('character_and_mode');
  };

  const handleConfirmExistingIdentity = () => {
    if (!matchedExistingStudent) return;
    soundManager.playClick();
    setActiveProfile(matchedExistingStudent);
    setSelectedCharacter(matchedExistingStudent.characterId);
    setStep('character_and_mode');
  };

  const handleSaveCharacterAndMode = () => {
    soundManager.playClick();
    setErrorMessage(null);

    if (selectedMode === 'solo' && !settings.soloAdventureOpen) {
      setErrorMessage('Mode Solo Adventure sedang ditutup sementara oleh Guru.');
      return;
    }
    if (selectedMode === 'championship' && !settings.championshipOpen) {
      setErrorMessage('Sesi Class Championship belum dibuka oleh Guru.');
      return;
    }

    const { student } = registerOrUpdateStudent(playerNameInput, selectedCharacter);
    setActiveProfile(student);
    setStep('profile_overview');
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
      aria-label="Pendaftaran dan Profil Petualang Siswa"
      className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-5 bg-sky-950/85 overflow-y-auto pointer-events-auto"
    >
      <div className="w-full max-w-4xl bg-sky-900 border-4 border-cyan-400 rounded-3xl shadow-2xl overflow-hidden my-auto">
        {/* Top Banner */}
        <div className="bg-sky-950 px-5 py-3.5 border-b-2 border-cyan-500/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AquaLogoSvg compact className="h-11 w-auto" />
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-cyan-200">
            <span className={step === 'credentials' ? 'text-yellow-300' : 'text-cyan-400'}>
              1. Kode & Nama
            </span>
            <span>·</span>
            <span className={step === 'character_and_mode' ? 'text-yellow-300' : 'text-cyan-400'}>
              2. Karakter & Mode
            </span>
            <span>·</span>
            <span className={step === 'profile_overview' ? 'text-yellow-300' : 'text-cyan-400'}>
              3. Profil & Peta Misi
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              soundManager.playClick();
              onCancelToTitle();
            }}
            className="px-3 py-1.5 rounded-xl bg-sky-800 hover:bg-sky-700 text-cyan-100 text-xs font-bold border border-cyan-400/40 cursor-pointer whitespace-nowrap"
          >
            Kembali ke Layar Utama
          </button>
        </div>

        {/* STEP 1: ACCESS CODE & PLAYER NAME */}
        {step === 'credentials' && (
          <form onSubmit={handleCheckCredentials} className="p-5 sm:p-7 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyan-500/30 pb-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold font-['Fredoka'] text-white">
                  Masuk ke Petualangan Aqua City
                </h2>
                <p className="text-sm text-cyan-100 mt-0.5">
                  Masukkan Kode Akses dari Guru dan tulis namamu sendiri untuk mulai berpetualang!
                </p>
              </div>
              <div className="bg-sky-950 border-2 border-yellow-400/80 rounded-2xl px-4 py-2 text-right shrink-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                  Kode Akses Kelas Saat Ini
                </div>
                <div className="text-lg font-extrabold font-mono text-yellow-300 tabular-nums">
                  {settings.accessCodeActive ? settings.accessCode : 'NONAKTIF'}
                </div>
              </div>
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="p-3.5 rounded-2xl bg-rose-950 border-2 border-rose-400 text-rose-100 text-sm font-semibold flex items-center gap-2.5"
              >
                <AlertTriangle className="w-5 h-5 text-rose-300 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label
                  htmlFor="student-access-code"
                  className="block text-sm font-bold text-cyan-100 mb-1.5"
                >
                  Kode Akses Bersama (Dari Guru)
                </label>
                <input
                  id="student-access-code"
                  type="text"
                  value={accessCodeInput}
                  onChange={(e) => setAccessCodeInput(e.target.value.toUpperCase())}
                  placeholder="Contoh: AQUA2026"
                  className="w-full px-4 py-3 rounded-2xl bg-sky-950 border-2 border-cyan-400 text-white font-mono font-bold text-lg uppercase focus:outline-none focus:border-yellow-400"
                />
                <p className="text-xs text-cyan-200 mt-1">
                  Semua siswa di kelas menggunakan satu kode akses yang sama.
                </p>
              </div>

              <div>
                <label
                  htmlFor="student-player-name"
                  className="block text-sm font-bold text-cyan-100 mb-1.5"
                >
                  Nama Pemain (Nama Lengkap / Panggilan)
                </label>
                <input
                  id="student-player-name"
                  type="text"
                  value={playerNameInput}
                  onChange={(e) => setPlayerNameInput(e.target.value)}
                  placeholder="Ketik namamu di sini..."
                  className="w-full px-4 py-3 rounded-2xl bg-sky-950 border-2 border-cyan-400 text-white font-bold text-lg focus:outline-none focus:border-yellow-400"
                />
                <p className="text-xs text-cyan-200 mt-1">
                  Gunakan nama yang sama setiap bermain agar skormu tersimpan rapi.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="text-xs text-cyan-200">
                Kelas: <strong className="text-white">{settings.className}</strong> · Guru:{' '}
                <strong className="text-white">{settings.teacherName}</strong>
              </div>
              <button
                type="submit"
                className="flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-sky-950 font-['Fredoka'] font-bold text-lg shadow-lg border-2 border-white cursor-pointer transition-transform active:scale-95"
              >
                <span>Lanjut Pilih Karakter & Mode</span>
                <ArrowRight className="w-5 h-5 stroke-[2.75]" />
              </button>
            </div>
          </form>
        )}

        {/* STEP 1B: CONFIRM EXISTING STUDENT IDENTITY */}
        {step === 'confirm_existing' && matchedExistingStudent && (
          <div className="p-6 sm:p-8 space-y-5">
            <div className="flex items-center gap-4 bg-sky-950 p-4 rounded-2xl border-2 border-yellow-400">
              <CharacterAvatarSvg
                characterId={matchedExistingStudent.characterId}
                className="w-16 h-16 shrink-0"
              />
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-yellow-300">
                  Profil Pemain Ditemukan!
                </div>
                <h3 className="text-xl font-bold font-['Fredoka'] text-white">
                  Halo, {matchedExistingStudent.name}! Apakah ini benar profilmu?
                </h3>
                <p className="text-sm text-cyan-100 mt-0.5">
                  Skor Terbaik Solo Adventure:{' '}
                  <strong className="text-yellow-300 tabular-nums">
                    {matchedExistingStudent.solo.bestTotalScore} Poin
                  </strong>{' '}
                  · Skor Class Championship:{' '}
                  <strong className="text-cyan-300 tabular-nums">
                    {matchedExistingStudent.championship.totalChampionshipScore} Poin
                  </strong>
                </p>
              </div>
            </div>

            <p className="text-sm text-cyan-100">
              Jika ini adalah kamu, klik tombol <strong>Ya, Lanjutkan Profil Saya</strong> agar progres
              level dan medali milikmu tidak hilang. Jika kamu siswa lain yang memiliki nama mirip,
              tambahkan huruf awal nama belakangmu.
            </p>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  soundManager.playClick();
                  setMatchedExistingStudent(null);
                  setStep('credentials');
                }}
                className="px-5 py-3 rounded-2xl bg-sky-800 hover:bg-sky-700 text-white font-bold text-sm border border-cyan-400/50 cursor-pointer"
              >
                Bukan, Ubah Nama Saya
              </button>
              <button
                type="button"
                onClick={handleConfirmExistingIdentity}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-sky-950 font-['Fredoka'] font-bold text-base border-2 border-white shadow-lg cursor-pointer"
              >
                <span>Ya, Lanjutkan Profil Saya</span>
                <ArrowRight className="w-4 h-4 stroke-[2.75]" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: CHARACTER & GAME MODE SELECTION */}
        {step === 'character_and_mode' && (
          <div className="p-5 sm:p-7 space-y-5">
            {errorMessage && (
              <div
                role="alert"
                className="p-3.5 rounded-2xl bg-rose-950 border-2 border-rose-400 text-rose-100 text-sm font-semibold flex items-center gap-2.5"
              >
                <AlertTriangle className="w-5 h-5 text-rose-300 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Character Selection */}
            <div>
              <h3 className="text-lg font-bold font-['Fredoka'] text-yellow-300 mb-2.5">
                1. Pilih Karakter Petualangmu
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
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
                      className={`p-3.5 rounded-2xl text-left border-3 transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-sky-950 border-yellow-400 shadow-lg scale-[1.01]'
                          : 'bg-sky-950/60 border-cyan-500/40 hover:border-cyan-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <CharacterAvatarSvg characterId={char.id} className="w-14 h-14 shrink-0" />
                        <div>
                          <div className="font-['Fredoka'] font-bold text-lg text-white flex items-center gap-2">
                            {char.name}
                            {isSelected && (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-yellow-300">
                                <Check className="w-3.5 h-3.5 stroke-[3]" /> Dipilih
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-semibold text-cyan-300">{char.roleTitle}</div>
                        </div>
                      </div>
                      <p className="text-xs text-cyan-100 mt-2 leading-relaxed">
                        {char.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mode Selection (Strictly Separated Points) */}
            <div>
              <h3 className="text-lg font-bold font-['Fredoka'] text-yellow-300 mb-2.5">
                2. Pilih Mode Permainan (Poin Kedua Mode Terpisah)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Mode 1: Solo Adventure */}
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playClick();
                    setSelectedMode('solo');
                  }}
                  className={`p-4 rounded-2xl text-left border-3 transition-all cursor-pointer ${
                    selectedMode === 'solo'
                      ? 'bg-sky-950 border-yellow-400 shadow-lg'
                      : 'bg-sky-950/60 border-cyan-500/40 hover:border-cyan-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-['Fredoka'] font-bold text-lg text-cyan-300 flex items-center gap-2">
                      <Compass className="w-5 h-5 text-cyan-300 stroke-[2.5]" />
                      <span>MODE 1: SOLO ADVENTURE</span>
                    </span>
                    <span className="text-xs font-bold text-emerald-300">
                      {settings.soloAdventureOpen ? 'TERBUKA' : 'DITUTUP GURU'}
                    </span>
                  </div>
                  <p className="text-xs text-cyan-100 mt-1.5">
                    Bermain mandiri kapan saja! Kamu bisa mengulang lokasi misi untuk meningkatkan{' '}
                    <strong>Best Score</strong>, menyimpan <strong>Latest Score</strong>, dan
                    mengumpulkan medali pribadi.
                  </p>
                </button>

                {/* Mode 2: Class Championship */}
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playClick();
                    setSelectedMode('championship');
                  }}
                  className={`p-4 rounded-2xl text-left border-3 transition-all cursor-pointer ${
                    selectedMode === 'championship'
                      ? 'bg-sky-950 border-yellow-400 shadow-lg'
                      : 'bg-sky-950/60 border-cyan-500/40 hover:border-cyan-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-['Fredoka'] font-bold text-lg text-yellow-300 flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-yellow-300 stroke-[2.5]" />
                      <span>MODE 2: CLASS CHAMPIONSHIP</span>
                    </span>
                    <span className="text-xs font-bold text-yellow-300">
                      {settings.championshipOpen ? 'SESI AKTIF' : 'DITUTUP GURU'}
                    </span>
                  </div>
                  <p className="text-xs text-cyan-100 mt-1.5">
                    Kompetisi resmi antarsiswa sekelas ({settings.championshipSessionName}). Menyimpan{' '}
                    <strong>Championship Score</strong> & peringkat resmi kelas. Terpisah dari Solo
                    Adventure!
                  </p>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  soundManager.playClick();
                  setStep('credentials');
                }}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-sky-800 hover:bg-sky-700 text-cyan-100 text-sm font-bold cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Ubah Nama</span>
              </button>
              <button
                type="button"
                onClick={handleSaveCharacterAndMode}
                className="flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-sky-950 font-['Fredoka'] font-bold text-lg border-2 border-white shadow-lg cursor-pointer"
              >
                <span>Simpan & Lihat Profil Petualang</span>
                <ArrowRight className="w-5 h-5 stroke-[2.75]" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: PLAYER PROFILE & WORLD MAP OVERVIEW */}
        {step === 'profile_overview' && activeProfile && (
          <div className="p-5 sm:p-7 space-y-5">
            <div className="bg-sky-950 border-2 border-cyan-400/60 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <CharacterAvatarSvg
                  characterId={activeProfile.characterId}
                  className="w-16 h-16 shrink-0"
                />
                <div>
                  <div className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                    Profil Petualang Aqua City ·{' '}
                    {selectedMode === 'solo' ? 'MODE SOLO ADVENTURE' : 'MODE CLASS CHAMPIONSHIP'}
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

              {/* Strictly separated score readout */}
              <div className="grid grid-cols-2 gap-3 w-full sm:w-auto">
                {selectedMode === 'solo' ? (
                  <>
                    <div className="bg-sky-900/90 border border-cyan-400/40 rounded-xl px-3.5 py-2 text-center">
                      <div className="text-[11px] text-cyan-200 font-bold">SOLO BEST SCORE</div>
                      <div className="text-xl font-extrabold font-mono text-yellow-300 tabular-nums">
                        {activeProfile.solo.bestTotalScore} / 1000
                      </div>
                      <div className="text-[11px] text-emerald-300 font-bold">
                        Nilai: {activeProfile.solo.academicGrade}
                      </div>
                    </div>
                    <div className="bg-sky-900/90 border border-cyan-400/40 rounded-xl px-3.5 py-2 text-center">
                      <div className="text-[11px] text-cyan-200 font-bold">SOLO LATEST SCORE</div>
                      <div className="text-xl font-extrabold font-mono text-cyan-200 tabular-nums">
                        {activeProfile.solo.latestTotalScore} Poin
                      </div>
                      <div className="text-[11px] text-cyan-300">
                        {Object.keys(activeProfile.solo.locations).length}/10 Lokasi Selesai
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-sky-900/90 border border-yellow-400/60 rounded-xl px-3.5 py-2 text-center">
                      <div className="text-[11px] text-yellow-200 font-bold">CHAMPIONSHIP SCORE</div>
                      <div className="text-xl font-extrabold font-mono text-yellow-300 tabular-nums">
                        {activeProfile.championship.totalChampionshipScore} / 1000
                      </div>
                      <div className="text-[11px] text-emerald-300 font-bold">
                        Nilai Resmi: {activeProfile.championship.academicGrade}
                      </div>
                    </div>
                    <div className="bg-sky-900/90 border border-cyan-400/40 rounded-xl px-3.5 py-2 text-center">
                      <div className="text-[11px] text-cyan-200 font-bold">PROGRES KOMPETISI</div>
                      <div className="text-xl font-extrabold font-mono text-white tabular-nums">
                        {Object.keys(activeProfile.championship.locations).length} / 10
                      </div>
                      <div className="text-[11px] text-cyan-300">Lokasi Selesai</div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 5 Levels Overview Grid */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-200 mb-2.5">
                Peta 5 Level & 10 Lokasi Misi Aqua City
              </h3>
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
                              <>
                                <Unlock className="w-3.5 h-3.5 text-emerald-300" />
                                <span className="text-emerald-300">Terbuka</span>
                              </>
                            ) : (
                              <>
                                <Lock className="w-3.5 h-3.5 text-slate-400" />
                                <span className="text-slate-400">Terkunci</span>
                              </>
                            )}
                          </span>
                        </div>
                        <div className="font-['Fredoka'] font-bold text-sm text-white mt-0.5">
                          {lvl.title}
                        </div>
                        <div className="text-[11px] text-cyan-200 mb-2">{lvl.theme}</div>
                      </div>

                      <div className="space-y-1.5 border-t border-cyan-500/20 pt-2">
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
                                <MedalBadgeSvg medal={medal} className="w-4 h-4" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  soundManager.playClick();
                  setStep('character_and_mode');
                }}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-sky-800 hover:bg-sky-700 text-cyan-100 text-sm font-bold cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Ganti Karakter / Mode</span>
              </button>

              <button
                type="button"
                onClick={handleEnter3DWorld}
                className="flex items-center gap-2.5 px-8 py-3.5 rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-sky-950 font-['Fredoka'] font-bold text-lg border-2 border-white shadow-xl cursor-pointer transition-transform active:scale-95"
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
