import React, { useState } from 'react';
import { ArrowRight, Award, BookOpen, CheckCircle2, Map, Sparkles } from 'lucide-react';
import { LEVELS, MISSION_LOCATIONS } from '../data/locations';
import { getQuestionsByLocation } from '../data/questions';
import { MissionResultSummary } from '../types/game';
import { soundManager } from '../utils/sound';
import { MedalBadgeSvg } from './AquaLogoSvg';

interface MissionResultModalProps {
  summary: MissionResultSummary;
  onContinueAdventure: (nextLocationId?: number) => void;
  onOpenWorldMap: () => void;
}

export const MissionResultModal: React.FC<MissionResultModalProps> = ({
  summary,
  onContinueAdventure,
  onOpenWorldMap,
}) => {
  const [showExplanations, setShowExplanations] = useState(true);
  const location = MISSION_LOCATIONS.find((l) => l.id === summary.locationId)!;
  const level = LEVELS.find((lvl) => lvl.id === summary.levelId)!;
  const questions = getQuestionsByLocation(summary.locationId);

  const nextLocation = MISSION_LOCATIONS.find((l) => l.id === summary.locationId + 1);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Hasil Penyelesaian Misi dan Pembahasan"
      className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-5 bg-sky-950/90 overflow-y-auto pointer-events-auto"
    >
      <div className="w-full max-w-4xl bg-sky-900 border-4 border-yellow-400 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Top Celebration Header */}
        <div className="bg-sky-950 px-6 py-4 border-b-2 border-cyan-500/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3.5">
            <MedalBadgeSvg medal={summary.medal} className="w-12 h-12 shrink-0" />
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-yellow-300">
                MISI LOKASI {location.id} SELESAI! ·{' '}
                {summary.mode === 'solo' ? 'MODE SOLO ADVENTURE' : 'MODE CLASS CHAMPIONSHIP'}
              </div>
              <h2 className="text-xl sm:text-2xl font-bold font-['Fredoka'] text-white">
                {location.name} ({location.indonesianName})
              </h2>
            </div>
          </div>

          {summary.unlockedNextLevel && (
            <div className="flex items-center gap-1.5 bg-emerald-500 text-sky-950 font-['Fredoka'] font-bold text-sm px-4 py-2 rounded-2xl border-2 border-white shadow-md">
              <Sparkles className="w-4 h-4 stroke-[2.5]" />
              <span>LEVEL BERIKUTNYA TERBUKA!</span>
            </div>
          )}
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Score & Academic Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-sky-950 border-2 border-yellow-400 rounded-2xl p-3 text-center">
              <div className="text-[11px] font-bold text-cyan-200 uppercase">POIN LOKASI INI</div>
              <div className="text-2xl font-extrabold font-mono text-yellow-300 tabular-nums mt-0.5">
                {summary.pointsEarned} / 100
              </div>
              <div className="text-[11px] text-cyan-300">Maks 100 Poin</div>
            </div>

            <div className="bg-sky-950 border border-cyan-400/50 rounded-2xl p-3 text-center">
              <div className="text-[11px] font-bold text-cyan-200 uppercase">BENAR / SALAH</div>
              <div className="text-2xl font-extrabold font-mono text-emerald-300 tabular-nums mt-0.5">
                {summary.correctCount}B ·{' '}
                <span className="text-rose-400">{summary.wrongCount}S</span>
              </div>
              <div className="text-[11px] text-cyan-300">Dari 10 Soal</div>
            </div>

            <div className="bg-sky-950 border border-cyan-400/50 rounded-2xl p-3 text-center">
              <div className="text-[11px] font-bold text-cyan-200 uppercase">POIN {level.code}</div>
              <div className="text-2xl font-extrabold font-mono text-cyan-300 tabular-nums mt-0.5">
                {summary.levelTotalPoints} / 200
              </div>
              <div className="text-[11px] text-cyan-300">
                {summary.levelCompletedNow ? 'Level Selesai' : 'Selesaikan 2 Lokasi'}
              </div>
            </div>

            <div className="bg-sky-950 border border-cyan-400/50 rounded-2xl p-3 text-center">
              <div className="text-[11px] font-bold text-cyan-200 uppercase">TOTAL PETUALANGAN</div>
              <div className="text-2xl font-extrabold font-mono text-white tabular-nums mt-0.5">
                {summary.adventureTotalPoints} / 1000
              </div>
              <div className="text-[11px] text-yellow-300 font-bold">
                Nilai Akademik: {summary.adventureAcademicGrade}
              </div>
            </div>

            <div className="bg-sky-950 border border-cyan-400/50 rounded-2xl p-3 text-center col-span-2 sm:col-span-1">
              <div className="text-[11px] font-bold text-cyan-200 uppercase">
                {summary.mode === 'championship' ? 'PERINGKAT KELAS' : 'MEDALI LOKASI'}
              </div>
              <div className="text-xl font-extrabold font-['Fredoka'] text-yellow-300 mt-1 flex items-center justify-center gap-1.5">
                <Award className="w-5 h-5 text-yellow-300 shrink-0" />
                <span>
                  {summary.mode === 'championship' && summary.championshipRank
                    ? `Peringkat #${summary.championshipRank}`
                    : summary.medal === 'gold'
                      ? 'Medali Emas'
                      : summary.medal === 'silver'
                        ? 'Medali Perak'
                        : summary.medal === 'bronze'
                          ? 'Medali Perunggu'
                          : 'Tetap Semangat!'}
                </span>
              </div>
              <div className="text-[11px] text-cyan-300 tabular-nums">
                Waktu: {summary.timeSpentSeconds} detik
              </div>
            </div>
          </div>

          {/* Answer Key & Step-by-Step Explanations (Unlocked AFTER Mission Completion) */}
          <div className="bg-sky-950/90 border-2 border-cyan-500/40 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold font-['Fredoka'] text-yellow-300 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-yellow-300 stroke-[2.5]" />
                <span>Pembahasan Jawaban ({location.name})</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowExplanations((v) => !v)}
                className="text-xs font-bold text-cyan-300 hover:text-white underline cursor-pointer"
              >
                {showExplanations ? 'Sembunyikan Pembahasan' : 'Tampilkan Pembahasan'}
              </button>
            </div>

            {showExplanations && (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {questions.map((q, idx) => {
                  const attempt = summary.details.find((d) => d.questionId === q.id);
                  const isCorrect = attempt?.isCorrect;
                  return (
                    <div
                      key={q.id}
                      className={`p-3 rounded-xl border text-xs sm:text-sm ${
                        isCorrect
                          ? 'bg-emerald-950/50 border-emerald-500/50'
                          : 'bg-rose-950/50 border-rose-500/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 font-bold text-white">
                        <span>
                          {idx + 1}. {q.questionText}
                        </span>
                        <span
                          className={`shrink-0 px-2 py-0.5 rounded font-mono text-xs ${
                            isCorrect ? 'bg-emerald-500 text-sky-950' : 'bg-rose-500 text-white'
                          }`}
                        >
                          {isCorrect ? '+10 Poin (Benar)' : '0 Poin (Kurang Tepat)'}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-cyan-300">
                        <span>
                          <strong>Kompetensi:</strong> {q.competency}
                        </span>
                        <span>·</span>
                        <span>
                          <strong>Tingkat:</strong> {q.difficultyLevel}
                        </span>
                        {q.lkpdReference && (
                          <>
                            <span>·</span>
                            <span className="text-yellow-300 font-mono">
                              Acuan LKPD: {q.lkpdReference}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-cyan-100">
                        <span>
                          Jawabanmu:{' '}
                          <strong className={isCorrect ? 'text-emerald-300' : 'text-rose-300'}>
                            {attempt?.selectedOption}.{' '}
                            {attempt ? q.options[attempt.selectedOption] : '-'}
                          </strong>
                        </span>
                        <span>
                          Kunci Jawaban:{' '}
                          <strong className="text-yellow-300">
                            {q.correctOption}. {q.options[q.correctOption]}
                          </strong>
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-cyan-200 flex items-start gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-cyan-300 shrink-0 mt-0.5" />
                        <span>
                          <strong>Pembahasan:</strong> {q.explanation}
                        </span>
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-sky-950 px-6 py-4 border-t-2 border-cyan-500/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              soundManager.playClick();
              onOpenWorldMap();
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-800 hover:bg-sky-700 text-cyan-100 font-bold text-sm border border-cyan-400/40 cursor-pointer"
          >
            <Map className="w-4 h-4 text-cyan-300" />
            <span>Buka Peta Dunia Aqua City</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                soundManager.playClick();
                onContinueAdventure();
              }}
              className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-sky-950 font-['Fredoka'] font-bold text-sm cursor-pointer"
            >
              Kembali Jelajahi 3D
            </button>

            {nextLocation && (
              <button
                type="button"
                data-start="true"
                onClick={() => {
                  soundManager.playClick();
                  onContinueAdventure(nextLocation.id);
                }}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-sky-950 font-['Fredoka'] font-bold text-base border-2 border-white shadow-lg cursor-pointer"
              >
                <span>Menuju Pos {nextLocation.id}: {nextLocation.name}</span>
                <ArrowRight className="w-4 h-4 stroke-[2.75]" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
