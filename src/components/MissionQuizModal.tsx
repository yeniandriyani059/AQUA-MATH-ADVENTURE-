import React, { useEffect, useState } from 'react';
import { Check, CheckCircle2, ArrowRight, X } from 'lucide-react';
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
  const [elapsedSeconds, setElapsedSeconds] = useState(1);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const currentQuestion = questions[currentIdx];
  const currentSelected = selectedAnswers[currentQuestion.id];
  const isLastQuestion = currentIdx === questions.length - 1;

  const handleSelectOption = (letter: OptionLetter) => {
    soundManager.playAnswerSelect();
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: letter,
    }));
  };

  const handleNextQuestion = () => {
    if (!currentSelected) return;

    if (isLastQuestion) {
      soundManager.playMissionComplete();
      onSubmitMission(location.id, selectedAnswers, elapsedSeconds);
    } else {
      soundManager.playClick();
      setCurrentIdx((prev) => prev + 1);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Misi Matematika Lokasi ${location.name}`}
      style={{
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(0.5rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.5rem, env(safe-area-inset-right))',
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-sky-950/92 backdrop-blur-xs pointer-events-auto overflow-hidden"
    >
      <div className="w-full max-w-xl md:max-w-2xl lg:max-w-3xl xl:max-w-4xl bg-sky-900 border-2 sm:border-4 border-cyan-400 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden my-auto h-[94vh] h-[94dvh] max-h-[96vh] max-h-[96dvh] flex flex-col">
        {/* TOP AREA: Title & Compact Progress Counter (1/10) */}
        <div className="bg-sky-950 px-3.5 sm:px-5 py-2 sm:py-2.5 border-b-2 border-cyan-500/40 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 truncate">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
            <span className="text-xs sm:text-sm md:text-base font-['Fredoka'] font-extrabold text-cyan-200 uppercase tracking-wider truncate">
              SOAL MISI · POS {location.id}: {location.name}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="bg-sky-900 border border-yellow-400/80 rounded-xl px-2.5 py-0.5 text-center">
              <span className="text-xs sm:text-sm font-mono font-extrabold text-yellow-300 tabular-nums">
                {currentIdx + 1} / {questions.length}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                soundManager.playClick();
                onCancelMission();
              }}
              aria-label="Tutup Misi"
              className="p-1 sm:p-1.5 rounded-lg bg-sky-800 hover:bg-sky-700 text-cyan-200 border border-cyan-400/40 cursor-pointer transition-transform active:scale-95 touch-manipulation"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* MIDDLE AREA: Single Natural Scrollable Container for Question & Options (NO nested scrolling) */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5 space-y-3 sm:space-y-4">
          {/* Question Text Box (Natural height, comfortable typography for children) */}
          <div className="bg-sky-950/95 border-2 border-cyan-400/70 rounded-xl sm:rounded-2xl p-3 sm:p-4.5 space-y-2 shadow-inner">
            <div className="flex items-center justify-between gap-2 text-[11px] sm:text-xs font-bold">
              <span className="text-yellow-300 uppercase tracking-wide">
                SOAL {currentIdx + 1} DARI {questions.length}
              </span>
              <span className="bg-cyan-500/20 text-cyan-200 border border-cyan-400/40 px-2 py-0.5 rounded-md font-mono text-[10px] sm:text-xs">
                10 POIN
              </span>
            </div>

            <p className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-white leading-relaxed text-left pt-0.5 select-text">
              {currentQuestion.questionText}
            </p>
          </div>

          {/* OPTIONS AREA: 1 column on portrait mobile, 2 columns on landscape/tablets/desktop for comfortable vertical reach */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            {OPTION_LETTERS.map((letter) => {
              const isSelected = currentSelected === letter;
              return (
                <button
                  key={letter}
                  type="button"
                  data-testid={`quiz-option-${letter.toLowerCase()}`}
                  onClick={() => handleSelectOption(letter)}
                  className={`w-full min-h-[52px] sm:min-h-[58px] p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border-2 sm:border-3 text-left flex items-center justify-between gap-2.5 sm:gap-3 transition-all cursor-pointer active:scale-[0.98] touch-manipulation ${
                    isSelected
                      ? 'bg-yellow-400 text-sky-950 border-white shadow-lg font-extrabold'
                      : 'bg-sky-950/90 hover:bg-sky-850 text-white border-cyan-400/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <span
                      className={`w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-xl font-['Fredoka'] font-bold text-sm sm:text-base md:text-lg flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-sky-950 text-yellow-300'
                          : 'bg-cyan-500/30 text-cyan-200 border border-cyan-400/50'
                      }`}
                    >
                      {letter}
                    </span>
                    <span className="text-xs sm:text-sm md:text-base font-bold leading-snug break-words">
                      {currentQuestion.options[letter]}
                    </span>
                  </div>

                  {isSelected && (
                    <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-extrabold uppercase px-2 py-0.5 rounded-md bg-sky-950 text-yellow-300 shrink-0">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* BOTTOM AREA: Pinned / Sticky LANJUT Button (Always visible without scrolling) */}
        <div className="bg-sky-950 px-3.5 sm:px-5 py-2.5 sm:py-3.5 border-t-2 border-cyan-500/40 shrink-0">
          <button
            type="button"
            data-testid="quiz-next-button"
            disabled={!currentSelected}
            onClick={handleNextQuestion}
            className="w-full py-3 sm:py-3.5 rounded-xl sm:rounded-2xl bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 text-sky-950 font-['Fredoka'] font-bold text-base sm:text-lg md:text-xl border-2 border-white shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed transition-transform active:scale-[0.98] touch-manipulation"
          >
            {isLastQuestion ? (
              <>
                <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-sky-950 stroke-[2.5]" />
                <span>SELESAIKAN MISI!</span>
              </>
            ) : (
              <>
                <span>LANJUT</span>
                <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.75]" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
