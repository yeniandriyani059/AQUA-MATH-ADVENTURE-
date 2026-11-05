import React, { useState } from 'react';
import { ArrowRight, BookOpen, CheckCircle2, Map } from 'lucide-react';
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
  const [showExplanations, setShowExplanations] = useState(false);
  const location = MISSION_LOCATIONS.find((l) => l.id === summary.locationId)!;
  const level = LEVELS.find((lvl) => lvl.id === summary.levelId)!;
  const questions = getQuestionsByLocation(summary.locationId);

  const nextLocation = MISSION_LOCATIONS.find((l) => l.id === summary.locationId + 1);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Hasil Penyelesaian Misi"
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-sky-950/92 backdrop-blur-xs pointer-events-auto overflow-hidden"
    >
      <div className="w-full max-w-md sm:max-w-xl md:max-w-2xl bg-sky-900 border-3 sm:border-4 border-yellow-400 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[85dvh] flex flex-col">
        {/* Top Header */}
        <div className="bg-sky-950 px-4 sm:px-5 py-3 border-b-2 border-cyan-500/40 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-3">
            <MedalBadgeSvg medal={summary.medal} className="w-10 h-10 sm:w-12 sm:h-12 shrink-0" />
            <div>
              <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-yellow-300">
                HASIL MISI · POS {location.id}
              </div>
              <h2 className="text-base sm:text-xl font-bold font-['Fredoka'] text-white truncate">
                {location.name}
              </h2>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="text-[10px] font-bold text-cyan-300 uppercase">TOTAL POIN</div>
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-yellow-300 tabular-nums">
              {summary.pointsEarned} / 100
            </div>
          </div>
        </div>

        {/* Compact Result Summary Body */}
        <div className="p-3.5 sm:p-5 overflow-y-auto space-y-3.5 flex-1 max-h-[55dvh]">
          {/* 3 Metric Cards */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
            <div className="bg-sky-950 border border-emerald-400/60 rounded-2xl p-2.5">
              <div className="text-[10px] font-bold text-emerald-300 uppercase">BENAR</div>
              <div className="text-xl font-mono font-extrabold text-emerald-300 tabular-nums mt-0.5">
                {summary.correctCount}
              </div>
              <div className="text-[9px] text-cyan-200">Soal</div>
            </div>

            <div className="bg-sky-950 border border-rose-400/60 rounded-2xl p-2.5">
              <div className="text-[10px] font-bold text-rose-300 uppercase">SALAH</div>
              <div className="text-xl font-mono font-extrabold text-rose-400 tabular-nums mt-0.5">
                {summary.wrongCount}
              </div>
              <div className="text-[9px] text-cyan-200">Soal</div>
            </div>

            <div className="bg-sky-950 border border-yellow-400/60 rounded-2xl p-2.5">
              <div className="text-[10px] font-bold text-yellow-300 uppercase">NILAI AKADEMIK</div>
              <div className="text-xl font-mono font-extrabold text-yellow-300 tabular-nums mt-0.5">
                {summary.adventureAcademicGrade}
              </div>
              <div className="text-[9px] text-cyan-200">Skala 100</div>
            </div>
          </div>

          {/* Sync & Level Unlocked Banner */}
          {summary.unlockedNextLevel && (
            <div className="p-2.5 rounded-2xl bg-emerald-950 border border-emerald-400 text-emerald-200 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>SELAMAT! LEVEL BERIKUTNYA TELAH TERBUKA!</span>
            </div>
          )}

          {/* Collapsible Pembahasan Button */}
          <div className="bg-sky-950 border border-cyan-500/40 rounded-2xl p-3">
            <button
              type="button"
              onClick={() => setShowExplanations((v) => !v)}
              className="w-full flex items-center justify-between text-xs font-bold text-cyan-200 hover:text-white cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-yellow-300" />
                <span>Lihat Pembahasan 10 Soal</span>
              </span>
              <span className="text-[10px] text-yellow-300 underline">
                {showExplanations ? 'Sembunyikan' : 'Buka Pembahasan'}
              </span>
            </button>

            {showExplanations && (
              <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
                {questions.map((q, idx) => {
                  const attempt = summary.details.find((d) => d.questionId === q.id);
                  const isCorrect = attempt?.isCorrect;
                  return (
                    <div
                      key={q.id}
                      className={`p-2.5 rounded-xl border text-xs ${
                        isCorrect
                          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-100'
                          : 'bg-rose-950/40 border-rose-500/40 text-rose-100'
                      }`}
                    >
                      <div className="font-bold">
                        {idx + 1}. {q.questionText}
                      </div>
                      <div className="mt-1 text-[11px] text-cyan-200">
                        Kunci: <strong className="text-yellow-300">{q.correctOption}</strong> · Pembahasan: {q.explanation}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-sky-950 px-4 sm:px-5 py-3 border-t-2 border-cyan-500/40 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              soundManager.playClick();
              onOpenWorldMap();
            }}
            className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-sky-800 hover:bg-sky-700 text-cyan-100 font-bold text-xs border border-cyan-400/40 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Map className="w-3.5 h-3.5 text-cyan-300" />
            <span>Peta Dunia</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundManager.playClick();
              if (nextLocation) {
                onContinueAdventure(nextLocation.id);
              } else {
                onContinueAdventure();
              }
            }}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-sky-950 font-['Fredoka'] font-bold text-base border-2 border-white shadow-lg cursor-pointer flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <span>LANJUTKAN PETUALANGAN</span>
            <ArrowRight className="w-5 h-5 stroke-[2.75]" />
          </button>
        </div>
      </div>
    </div>
  );
};
