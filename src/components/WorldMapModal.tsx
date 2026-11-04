import React, { useState } from 'react';
import { ArrowRight, Compass, Crown, Lock, Map, MapPin, Medal, Trophy, Unlock } from 'lucide-react';
import { LEVELS, MISSION_LOCATIONS } from '../data/locations';
import {
  buildChampionshipLeaderboard,
  getLevelChampion,
  isLocationUnlockedForProfile,
} from '../game/rules';
import { GameMode, MissionLocation, StudentProfile } from '../types/game';
import { soundManager } from '../utils/sound';
import { CharacterAvatarSvg, MedalBadgeSvg } from './AquaLogoSvg';

interface WorldMapModalProps {
  profile: StudentProfile;
  allStudents: StudentProfile[];
  mode: GameMode;
  onTeleportToLocation: (locationId: number) => void;
  onStartMissionDirectly: (loc: MissionLocation) => void;
  onSwitchMode: (nextMode: GameMode) => void;
  onClose: () => void;
}

export const WorldMapModal: React.FC<WorldMapModalProps> = ({
  profile,
  allStudents,
  mode,
  onTeleportToLocation,
  onStartMissionDirectly,
  onSwitchMode,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'map' | 'leaderboard'>('map');
  const leaderboard = buildChampionshipLeaderboard(allStudents);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Peta Dunia Aqua City dan Peringkat Kelas"
      className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-5 bg-sky-950/90 overflow-y-auto pointer-events-auto"
    >
      <div className="w-full max-w-5xl bg-sky-900 border-4 border-cyan-400 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="bg-sky-950 px-5 py-3.5 border-b-2 border-cyan-500/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <CharacterAvatarSvg characterId={profile.characterId} className="w-11 h-11" />
            <div>
              <h2 className="text-lg sm:text-xl font-bold font-['Fredoka'] text-white">
                Peta Dunia Aqua City & Peringkat Juara
              </h2>
              <div className="text-xs text-cyan-200">
                Petualang: <strong className="text-yellow-300">{profile.name}</strong> · Mode Aktif:{' '}
                <strong className="text-cyan-300">
                  {mode === 'solo' ? 'SOLO ADVENTURE' : 'CLASS CHAMPIONSHIP'}
                </strong>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                soundManager.playClick();
                setActiveTab('map');
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                activeTab === 'map'
                  ? 'bg-yellow-400 text-sky-950'
                  : 'bg-sky-900 text-cyan-100 border border-cyan-500/40'
              }`}
            >
              <Map className="w-4 h-4" />
              <span>5 Level & 10 Lokasi</span>
            </button>
            <button
              type="button"
              onClick={() => {
                soundManager.playClick();
                setActiveTab('leaderboard');
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                activeTab === 'leaderboard'
                  ? 'bg-yellow-400 text-sky-950'
                  : 'bg-sky-900 text-cyan-100 border border-cyan-500/40'
              }`}
            >
              <Trophy className="w-4 h-4" />
              <span>Juara & Leaderboard Kelas</span>
            </button>
            <button
              type="button"
              onClick={() => {
                soundManager.playClick();
                onClose();
              }}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
            >
              Tutup [M]
            </button>
          </div>
        </div>

        {/* Mode Switcher & Isolated Score Banner */}
        <div className="bg-sky-950/70 px-5 py-2.5 border-b border-cyan-500/30 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-cyan-200">Mode Bermain:</span>
            <button
              type="button"
              onClick={() => {
                soundManager.playClick();
                onSwitchMode('solo');
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                mode === 'solo'
                  ? 'bg-cyan-400 text-sky-950'
                  : 'bg-sky-900 text-cyan-200 border border-cyan-500/30'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Solo Adventure</span>
            </button>
            <button
              type="button"
              onClick={() => {
                soundManager.playClick();
                onSwitchMode('championship');
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                mode === 'championship'
                  ? 'bg-yellow-400 text-sky-950'
                  : 'bg-sky-900 text-cyan-200 border border-cyan-500/30'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Class Championship</span>
            </button>
          </div>

          {mode === 'solo' ? (
            <div className="flex items-center gap-4 text-xs">
              <span>
                Solo Best Score:{' '}
                <strong className="text-yellow-300 font-mono tabular-nums">
                  {profile.solo.bestTotalScore} / 1000
                </strong>
              </span>
              <span>·</span>
              <span>
                Solo Latest Score:{' '}
                <strong className="text-cyan-300 font-mono tabular-nums">
                  {profile.solo.latestTotalScore}
                </strong>
              </span>
              <span>·</span>
              <span>
                Nilai Akademik:{' '}
                <strong className="text-emerald-300 font-mono tabular-nums">
                  {profile.solo.academicGrade}
                </strong>
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-4 text-xs">
              <span>
                Championship Score:{' '}
                <strong className="text-yellow-300 font-mono tabular-nums">
                  {profile.championship.totalChampionshipScore} / 1000
                </strong>
              </span>
              <span>·</span>
              <span>
                Nilai Resmi:{' '}
                <strong className="text-emerald-300 font-mono tabular-nums">
                  {profile.championship.academicGrade}
                </strong>
              </span>
              <span>·</span>
              <span>
                Total Waktu:{' '}
                <strong className="text-cyan-300 font-mono tabular-nums">
                  {profile.championship.totalTimeSeconds}d
                </strong>
              </span>
            </div>
          )}
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {activeTab === 'map' ? (
            <div className="space-y-4">
              {LEVELS.map((lvl) => {
                const unlockedLevelNum =
                  mode === 'solo'
                    ? profile.solo.unlockedLevel
                    : profile.championship.unlockedLevel;
                const isLevelUnlocked = lvl.id <= unlockedLevelNum;
                const locs = MISSION_LOCATIONS.filter((l) => l.levelId === lvl.id);
                const levelChamp = getLevelChampion(allStudents, lvl.id);

                return (
                  <div
                    key={lvl.id}
                    className={`p-4 rounded-2xl border-2 ${
                      isLevelUnlocked
                        ? 'bg-sky-950 border-cyan-400/70'
                        : 'bg-sky-950/40 border-slate-700 opacity-75'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold uppercase tracking-wider text-yellow-300">
                            {lvl.code} — {lvl.title}
                          </span>
                          <span className="text-xs text-cyan-300">·</span>
                          <span className="text-xs text-cyan-200">{lvl.theme}</span>
                        </div>
                        <div className="text-xs text-cyan-300 mt-0.5">
                          Kesulitan: {lvl.difficultyLabel}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-xs">
                        {levelChamp && (
                          <span className="text-yellow-300 font-bold inline-flex items-center gap-1">
                            <Crown className="w-3.5 h-3.5 text-yellow-300" />
                            <span>
                              Juara {lvl.code}: {levelChamp.studentName} ({levelChamp.score}/200)
                            </span>
                          </span>
                        )}
                        <span
                          className={`font-bold inline-flex items-center gap-1 ${
                            isLevelUnlocked ? 'text-emerald-300' : 'text-slate-400'
                          }`}
                        >
                          {isLevelUnlocked ? (
                            <>
                              <Unlock className="w-3.5 h-3.5" />
                              <span>Terbuka</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3.5 h-3.5" />
                              <span>Selesaikan Level Sebelumnya</span>
                            </>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {locs.map((loc) => {
                        const unlocked = isLocationUnlockedForProfile(profile, loc.id, mode);
                        const soloRec = profile.solo.locations[loc.id];
                        const champRec = profile.championship.locations[loc.id];
                        const medal =
                          mode === 'solo' ? soloRec?.medal || 'none' : champRec?.medal || 'none';

                        return (
                          <div
                            key={loc.id}
                            className="bg-sky-900/90 border border-cyan-500/40 rounded-2xl p-3.5 flex flex-col justify-between gap-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-xs font-bold text-yellow-300">
                                  POS {loc.id} · {loc.topic}
                                </div>
                                <h4 className="text-base font-bold font-['Fredoka'] text-white">
                                  {loc.name} ({loc.indonesianName})
                                </h4>
                                <p className="text-xs text-cyan-100 mt-1">{loc.description}</p>
                              </div>
                              <MedalBadgeSvg medal={medal} className="w-9 h-9 shrink-0" />
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-cyan-500/20 text-xs">
                              {mode === 'solo' ? (
                                <div className="text-cyan-200">
                                  Best:{' '}
                                  <strong className="text-yellow-300 font-mono tabular-nums">
                                    {soloRec ? `${soloRec.bestScore}/100` : 'Belum'}
                                  </strong>{' '}
                                  · Latest:{' '}
                                  <strong className="text-white font-mono tabular-nums">
                                    {soloRec ? `${soloRec.latestScore}` : '-'}
                                  </strong>
                                </div>
                              ) : (
                                <div className="text-cyan-200">
                                  Championship:{' '}
                                  <strong className="text-yellow-300 font-mono tabular-nums">
                                    {champRec ? `${champRec.championshipScore}/100` : 'Belum'}
                                  </strong>
                                </div>
                              )}

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  disabled={!unlocked}
                                  onClick={() => {
                                    soundManager.playClick();
                                    onTeleportToLocation(loc.id);
                                  }}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-sky-800 hover:bg-sky-700 disabled:opacity-40 text-cyan-100 font-bold cursor-pointer disabled:cursor-not-allowed"
                                >
                                  <MapPin className="w-3.5 h-3.5 text-cyan-300" />
                                  <span>Ke Lokasi 3D</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={!unlocked}
                                  onClick={() => {
                                    soundManager.playClick();
                                    onStartMissionDirectly(loc);
                                  }}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 disabled:opacity-40 text-sky-950 font-['Fredoka'] font-bold cursor-pointer disabled:cursor-not-allowed"
                                >
                                  <span>Mulai Misi</span>
                                  <ArrowRight className="w-3.5 h-3.5 stroke-[2.75]" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* LEADERBOARD & CHAMPIONS VIEW */
            <div className="space-y-5">
              {/* Grand Champion & Level Champions Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-6 gap-2.5">
                <div className="sm:col-span-2 bg-sky-950 border-2 border-yellow-400 rounded-2xl p-3.5">
                  <div className="text-[11px] font-bold uppercase text-yellow-300 flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-yellow-300" />
                    <span>GRAND CHAMPION AQUA CITY</span>
                  </div>
                  {leaderboard.length > 0 ? (
                    <div className="mt-1">
                      <div className="text-lg font-bold font-['Fredoka'] text-white">
                        {leaderboard[0].studentName}
                      </div>
                      <div className="text-xs text-cyan-200">
                        Skor Resmi:{' '}
                        <strong className="text-yellow-300 font-mono tabular-nums">
                          {leaderboard[0].championshipScore} / 1000
                        </strong>{' '}
                        (Nilai: {leaderboard[0].academicGrade})
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-cyan-200 mt-1">Belum ada peserta kompetisi.</div>
                  )}
                </div>

                {LEVELS.map((lvl) => {
                  const champ = getLevelChampion(allStudents, lvl.id);
                  return (
                    <div
                      key={lvl.id}
                      className="bg-sky-950 border border-cyan-500/40 rounded-2xl p-3 flex flex-col justify-between"
                    >
                      <div className="text-[10px] font-bold text-cyan-300 uppercase">
                        JUARA {lvl.code}
                      </div>
                      {champ ? (
                        <div>
                          <div className="text-sm font-bold text-white truncate">
                            {champ.studentName}
                          </div>
                          <div className="text-xs font-mono font-bold text-yellow-300 tabular-nums">
                            {champ.score} / 200 Poin
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400">Belum ada</div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Official Class Championship Leaderboard Table */}
              <div className="bg-sky-950 border-2 border-cyan-500/40 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-cyan-500/30 flex items-center justify-between">
                  <h3 className="text-base font-bold font-['Fredoka'] text-white">
                    Leaderboard Resmi Class Championship (Poin Terpisah dari Solo Adventure)
                  </h3>
                  <span className="text-xs text-cyan-300">
                    Prioritas: Skor Tertinggi (Waktu sebagai pemecah nilai sama)
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-sky-900/80 text-cyan-200 border-b border-cyan-500/30">
                        <th className="py-2.5 px-4 font-bold">Peringkat</th>
                        <th className="py-2.5 px-4 font-bold">Nama Siswa</th>
                        <th className="py-2.5 px-4 font-bold text-right">Championship Score</th>
                        <th className="py-2.5 px-4 font-bold text-right">Nilai Akademik</th>
                        <th className="py-2.5 px-4 font-bold text-center">Lokasi Selesai</th>
                        <th className="py-2.5 px-4 font-bold text-right">Waktu Selesai</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cyan-500/20">
                      {leaderboard.map((entry) => (
                        <tr
                          key={entry.studentId}
                          className={
                            entry.studentId === profile.id ? 'bg-cyan-500/20' : 'hover:bg-sky-900/40'
                          }
                        >
                          <td className="py-2.5 px-4 font-mono font-bold text-yellow-300 tabular-nums">
                            <span className="inline-flex items-center gap-1.5">
                              <span>#{entry.rank}</span>
                              {entry.rank <= 3 && (
                                <Medal
                                  className={`w-4 h-4 ${
                                    entry.rank === 1
                                      ? 'text-yellow-300'
                                      : entry.rank === 2
                                        ? 'text-slate-200'
                                        : 'text-amber-500'
                                  }`}
                                />
                              )}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-bold text-white">
                            {entry.studentName}
                            {entry.studentId === profile.id && (
                              <span className="ml-2 text-xs text-yellow-300">(Kamu)</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-yellow-300 tabular-nums">
                            {entry.championshipScore} / 1000
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-300 tabular-nums">
                            {entry.academicGrade}
                          </td>
                          <td className="py-2.5 px-4 text-center font-mono text-cyan-100 tabular-nums">
                            {entry.completedLocationsCount} / 10
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-cyan-200 tabular-nums">
                            {entry.totalTimeSeconds} detik
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
    </div>
  );
};
