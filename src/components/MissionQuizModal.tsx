import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, Info, Zap } from 'lucide-react';
import { getQuestionsByLocation } from '../data/questions';
import { GameMode, MissionLocation, OptionLetter } from '../types/game';
import { soundManager } from '../utils/sound';

interface MissionQuizModalProps {
  location: MissionLocation;
  mode: GameMode;
  onSubmitMission: (
    locationId: number,
    answers: Record<string, OptionLetter>,
    timeSpentSeconds: number,
  ) => void;
  onCancelMission: () => void;
}

const OPTION_LETTERS: OptionLetter[] = ['A', 'B', 'C', 'D'];

export const MissionQuizModal: React.FC<MissionQuizModalProps> = ({
  location,
  mode,
  onSubmitMission,
  onCancelMission,
}) => {
  const questions = getQuestionsByLocation(location.id);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, OptionLetter>>({});
  const [revealedHints, setRevealedHints] = useState<Record<string, boolean>>({});
  const [elapsedSeconds, setElapsedSeconds] = useState(1);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const currentQuestion = questions[currentIdx];
  const currentSelected = selectedAnswers[currentQuestion.id];
  const answeredCount = Object.keys(selectedAnswers).length;
  const allAnswered = answeredCount === questions.length;
  const isFinalMission = location.levelId === 5;
  const isSoloExplanationShown = Boolean(revealedHints[currentQuestion.id] && currentSelected);

  const handleSelectOption = (letter: OptionLetter) => {
    soundManager.playAnswerSelect();
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: letter,
    }));
  };

  const handleFinish = () => {
    if (!allAnswered) return;
    soundManager.playMissionComplete();
    onSubmitMission(location.id, selectedAnswers, elapsedSeconds);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Misi Matematika Lokasi ${location.name}`}
      className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-5 bg-sky-950/90 overflow-y-auto pointer-events-auto"
    >
      <div
        className={`w-full max-w-3xl bg-sky-900 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col border-4 ${
          isFinalMission ? 'border-yellow-400 shadow-yellow-500/20' : 'border-cyan-400'
        }`}
      >
        {/* Dramatic Level 5 Final Challenge Banner */}
        {isFinalMission && (
          <div className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 px-5 py-1.5 text-sky-950 flex flex-wrap items-center justify-between gap-2 border-b-2 border-white shrink-0">
            <div className="flex items-center gap-2 font-['Fredoka'] font-extrabold text-xs sm:text-sm tracking-wide uppercase">
              <Zap className="w-4 h-4 fill-sky-950 text-sky-950" />
              <span>FINAL CHALLENGE · LEVEL 5: SAVE AQUA CITY!</span>
            </div>
            <span className="text-[11px] font-extrabold bg-sky-950 text-yellow-300 px-2.5 py-0.5 rounded-lg">
              MISI PENYELAMATAN UTAMA KOTA
            </span>
          </div>
        )}

        {/* Header Bar */}
        <div className="bg-sky-950 px-5 py-3 border-b-2 border-cyan-500/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-yellow-300">
              <span>LEVEL {location.levelId}</span>
              <span>·</span>
              <span>
                LOKASI {location.id}: {location.name}
              </span>
              <span>·</span>
              <span className="text-cyan-300">
                {mode === 'solo' ? 'SOLO ADVENTURE' : 'CLASS CHAMPIONSHIP'}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold font-['Fredoka'] text-white">
              {location.indonesianName} — {location.topic}
            </h2>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="bg-sky-900 border border-cyan-400/50 rounded-xl px-3 py-1 text-center">
              <div className="text-[10px] font-bold text-cyan-300 uppercase">WAKTU MISI</div>
              <div className="text-sm font-mono font-bold text-white tabular-nums">
                {Math.floor(elapsedSeconds / 60)}m {elapsedSeconds % 60}d
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                soundManager.playClick();
                onCancelMission();
              }}
              className="px-3 py-2 rounded-xl bg-sky-800 hover:bg-sky-700 text-cyan-100 text-xs font-bold border border-cyan-400/40 cursor-pointer"
            >
              Tutup Misi
            </button>
          </div>
        </div>

        {/* Mission Narrative Banner */}
        <div
          className={`px-5 py-2 border-b flex items-start gap-2 text-xs shrink-0 ${
            isFinalMission
              ? 'bg-amber-950/70 border-yellow-400/40 text-yellow-100'
              : 'bg-sky-950/85 border-cyan-500/30 text-cyan-100'
          }`}
        >
          <span className="font-extrabold uppercase tracking-wider shrink-0 text-yellow-300">
            Narasi Misi:
          </span>
          <p className="font-semibold leading-snug">{location.storyPrompt}</p>
        </div>

        {/* Question Number Navigation & Mission Progress Bar */}
        <div className="bg-sky-950/60 px-5 py-2 border-b border-cyan-500/30 space-y-1.5 shrink-0">
          <div className="flex items-center justify-between gap-2 overflow-x-auto">
            <div className="flex items-center gap-1.5">
              {questions.map((q, idx) => {
                const isDone = Boolean(selectedAnswers[q.id]);
                const isCurrent = idx === currentIdx;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      soundManager.playClick();
                      setCurrentIdx(idx);
                    }}
                    aria-label={`Soal nomor ${idx + 1}`}
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl font-mono font-bold text-xs transition-all cursor-pointer tabular-nums ${
                      isCurrent
                        ? 'bg-yellow-400 text-sky-950 border-2 border-white scale-105'
                        : isDone
                          ? 'bg-emerald-500 text-sky-950 border border-emerald-200'
                          : 'bg-sky-900 text-cyan-200 border border-cyan-500/40 hover:border-cyan-300'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
            <div className="text-xs font-bold text-cyan-200 whitespace-nowrap shrink-0 tabular-nums">
              Progres Misi: {answeredCount} / {questions.length} Soal ({answeredCount * 10} Poin Maks)
            </div>
          </div>

          <div className="w-full h-1.5 bg-sky-950 rounded-full overflow-hidden border border-cyan-500/30">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 to-yellow-400 transition-all duration-300"
              style={{ width: `${(answeredCount / questions.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Scrollable Main Question Body */}
        <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
          <div
            className={`bg-sky-950 border-2 rounded-2xl p-4 space-y-2 ${
              isFinalMission ? 'border-yellow-400/80' : 'border-cyan-400/60'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
              <span className="text-yellow-300 uppercase tracking-wide">
                SOAL {currentIdx + 1} DARI {questions.length} · BOBOT 10 POIN
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {currentQuestion.lkpdReference && (
                  <span className="bg-amber-400/20 text-yellow-300 border border-yellow-400/50 px-2.5 py-0.5 rounded-lg font-mono text-[11px]">
                    Acuan LKPD
                  </span>
                )}
                <span className="bg-cyan-500/20 text-cyan-200 border border-cyan-400/40 px-2.5 py-0.5 rounded-lg">
                  Tingkat: {currentQuestion.difficultyLevel}
                </span>
              </div>
            </div>

            <div className="text-xs text-cyan-300 font-semibold border-b border-cyan-500/25 pb-1.5">
              <strong className="text-cyan-100">Kompetensi:</strong> {currentQuestion.competency}
            </div>

            <p className="text-sm sm:text-base font-bold text-white leading-relaxed pt-0.5">
              {currentQuestion.questionText}
            </p>
          </div>

          {/* 4 Multiple Choice Options: A, B, C, D */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {OPTION_LETTERS.map((letter) => {
              const isSelected = currentSelected === letter;
              return (
                <button
                  key={letter}
                  type="button"
                  onClick={() => handleSelectOption(letter)}
                  className={`p-3.5 rounded-2xl border-3 text-left flex items-center justify-between gap-3 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-yellow-400 text-sky-950 border-white shadow-lg scale-[1.01]'
                      : 'bg-sky-950 hover:bg-sky-800 text-white border-cyan-400/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-9 h-9 rounded-xl font-['Fredoka'] font-bold text-base flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-sky-950 text-yellow-300'
                          : 'bg-cyan-500/30 text-cyan-200 border border-cyan-400/50'
                      }`}
                    >
                      {letter}
                    </span>
                    <span className="text-sm sm:text-base font-bold leading-snug">
                      {currentQuestion.options[letter]}
                    </span>
                  </div>

                  {isSelected && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase px-2 py-0.5 rounded-lg bg-sky-950 text-yellow-300 shrink-0">
                      <span>Dipilih</span>
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Visual Selection Feedback & Solo Study Preview */}
          {currentSelected ? (
            <div className="bg-sky-950/90 border border-emerald-400/50 rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Jawaban Soal {currentIdx + 1} tersimpan:{' '}
                  <span className="text-yellow-300">
                    Opsi {currentSelected} ({currentQuestion.options[currentSelected]})
                  </span>
                </span>
              </div>
              {mode === 'solo' && (
                <button
                  type="button"
                  onClick={() => {
                    soundManager.playClick();
                    setRevealedHints((prev) => ({
                      ...prev,
                      [currentQuestion.id]: !prev[currentQuestion.id],
                    }));
                  }}
                  className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-400/50 cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5 text-cyan-300" />
                  <span>
                    {isSoloExplanationShown ? 'Sembunyikan Cek Jawaban' : 'Cek & Pelajari Soal Ini'}
                  </span>
                </button>
              )}
            </div>
          ) : (
            <div className="bg-sky-950/60 border border-cyan-500/30 rounded-2xl px-4 py-2 text-xs text-cyan-200 font-semibold">
              Pilih salah satu jawaban (A, B, C, atau D) setelah membaca informasi soal dengan teliti.
            </div>
          )}

          {/* Optional Instant Reasoning Feedback in Solo Mode */}
          {mode === 'solo' && isSoloExplanationShown && currentSelected && (
            <div
              className={`rounded-2xl p-3 border text-xs sm:text-sm ${
                currentSelected === currentQuestion.correctOption
                  ? 'bg-emerald-950/70 border-emerald-400 text-emerald-100'
                  : 'bg-amber-950/70 border-yellow-400 text-yellow-100'
              }`}
            >
              <div className="font-bold mb-1 flex items-center gap-1.5">
                {currentSelected === currentQuestion.correctOption ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                    <span>
                      Tepat Sekali! Kunci Jawaban: {currentQuestion.correctOption} (
                      {currentQuestion.options[currentQuestion.correctOption]})
                    </span>
                  </>
                ) : (
                  <>
                    <Info className="w-4 h-4 text-yellow-300 shrink-0" />
                    <span>
                      Belum Tepat. Jawaban yang benar adalah {currentQuestion.correctOption} (
                      {currentQuestion.options[currentQuestion.correctOption]})
                    </span>
                  </>
                )}
              </div>
              <p className="text-cyan-100 leading-relaxed">
                <strong>Pembahasan Langkah demi Langkah:</strong> {currentQuestion.explanation}
              </p>
            </div>
          )}
        </div>

        {/* Pinned Bottom Navigation Bar */}
        <div className="bg-sky-950 px-5 py-3 border-t-2 border-cyan-500/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            disabled={currentIdx === 0}
            onClick={() => {
              soundManager.playClick();
              setCurrentIdx((i) => Math.max(0, i - 1));
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-800 hover:bg-sky-700 disabled:opacity-40 text-white font-bold text-sm cursor-pointer disabled:cursor-not-allowed"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Soal Sebelumnya</span>
          </button>

          <div className="text-xs text-cyan-200 text-center">
            Rekap nilai & pembahasan lengkap 10 soal juga tampil saat misi selesai.
          </div>

          {currentIdx < questions.length - 1 ? (
            <button
              type="button"
              onClick={() => {
                soundManager.playClick();
                setCurrentIdx((i) => Math.min(questions.length - 1, i + 1));
              }}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-sky-950 font-['Fredoka'] font-bold text-base cursor-pointer"
            >
              <span>Soal Berikutnya</span>
              <ArrowRight className="w-4 h-4 stroke-[2.75]" />
            </button>
          ) : (
            <button
              type="button"
              disabled={!allAnswered}
              onClick={handleFinish}
              className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 text-sky-950 font-['Fredoka'] font-bold text-base border-2 border-white shadow-lg cursor-pointer disabled:cursor-not-allowed"
            >
              {allAnswered ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-sky-950 stroke-[2.5]" />
                  <span>Kumpulkan Jawaban & Selesaikan Misi!</span>
                </>
              ) : (
                <span>Jawab {questions.length - answeredCount} Soal Lagi</span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
