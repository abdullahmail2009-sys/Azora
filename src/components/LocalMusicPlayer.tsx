import React, { useState, useRef } from 'react';
import { useLocalMusic } from '../context/LocalMusicContext.tsx';
import { formatAudioTime, formatRemainingTime, formatFileSize } from '../utils/localMusicLogic.ts';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Music,
  ChevronUp,
  ChevronDown,
  X,
  Upload,
  List,
  Shuffle,
  Repeat,
  Repeat1,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Power,
  Search,
  EyeOff,
  Settings,
} from 'lucide-react';

export const LocalMusicPlayer: React.FC = () => {
  const {
    tracks,
    currentTrackIndex,
    currentTrack,
    isPlaying,
    isPausedByBackground,
    isMuted,
    volume,
    currentTime,
    duration,
    playbackStatus,
    masterEnabled,
    resumeOnReturn,
    shuffleEnabled,
    repeatMode,
    isPlayerOpen,
    isExpanded,
    isImporting,
    importError,
    importFiles,
    playTrack,
    togglePlay,
    nextTrack,
    prevTrack,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeatMode,
    setMasterEnabled,
    setResumeOnReturn,
    removeTrack,
    clearLibrary,
    setIsPlayerOpen,
    toggleExpanded,
  } = useLocalMusic();

  const [activeTab, setActiveTab] = useState<'player' | 'playlist' | 'settings'>('player');
  const [searchQuery, setSearchQuery] = useState('');
  const [trackToDelete, setTrackToDelete] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [errorDismissed, setErrorDismissed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await importFiles(e.target.files);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setActiveTab('playlist');
    }
  };

  const filteredTracks = tracks.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // If player is hidden/minimized, render floating launcher button
  if (!isPlayerOpen) {
    return (
      <button
        onClick={() => setIsPlayerOpen(true)}
        aria-label="Open Custom Local Music Player"
        title="Custom Local Background Music Player"
        className={`fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-50 flex items-center gap-2 px-3.5 py-2.5 rounded-full text-[#FBF7EF] shadow-xl transition-all cursor-pointer border ${
          masterEnabled && isPlaying
            ? 'bg-[#1B4D48] border-[#75D9B4]/50 hover:bg-[#143B37] scale-105'
            : isPausedByBackground
            ? 'bg-amber-900 border-amber-500/50'
            : 'bg-[#1B4D48] border-[#75D9B4]/20 hover:bg-[#143B37]'
        }`}
      >
        <div className="relative flex items-center justify-center">
          <Music className={`w-4 h-4 ${masterEnabled && isPlaying ? 'text-[#75D9B4] animate-pulse' : 'text-slate-300'}`} />
          {isPlaying && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#42BDAE] animate-ping" />
          )}
        </div>
        <span className="text-xs font-semibold tracking-wide hidden sm:inline">
          {!masterEnabled
            ? 'Music Disabled'
            : isPausedByBackground
            ? 'Paused (Background)'
            : isPlaying
            ? 'Local Music'
            : 'Music Player'}
        </span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 right-3 left-3 sm:left-auto sm:right-6 sm:bottom-6 z-50 sm:max-w-md w-full transition-all duration-300">
      <div className="bg-[#1B4D48] text-[#FBF7EF] rounded-2xl shadow-2xl border border-[#75D9B4]/30 backdrop-blur-xl overflow-hidden">
        {/* Header Bar */}
        <div className="px-4 py-3 bg-[#143B37] flex items-center justify-between border-b border-[#75D9B4]/15">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`p-1.5 rounded-lg shrink-0 ${
                masterEnabled ? 'bg-[#42BDAE]/20 text-[#75D9B4]' : 'bg-slate-800 text-slate-400'
              }`}
            >
              <Music className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-wider uppercase text-[#75D9B4]">
                  Local Music Player
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                    !masterEnabled
                      ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                      : isPausedByBackground
                      ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                      : isPlaying
                      ? 'bg-[#42BDAE]/30 text-[#75D9B4]'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {!masterEnabled
                    ? 'OFF'
                    : isPausedByBackground
                    ? 'Background Paused'
                    : isPlaying
                    ? 'Playing'
                    : 'Paused'}
                </span>
              </div>
              <h4 className="text-xs font-semibold text-[#FBF7EF] truncate max-w-[180px] sm:max-w-[220px]">
                {currentTrack ? currentTrack.title : 'No Track Selected'}
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setMasterEnabled(!masterEnabled)}
              title={masterEnabled ? 'Disable Music Master Switch' : 'Enable Music Master Switch'}
              aria-label="Toggle Master Music Switch"
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                masterEnabled
                  ? 'bg-[#42BDAE] text-[#1B4D48] font-bold'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={toggleExpanded}
              aria-label={isExpanded ? 'Collapse Music Player' : 'Expand Music Player'}
              className="p-1.5 rounded-lg text-[#75D9B4] hover:bg-[#1B4D48] transition cursor-pointer"
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setIsPlayerOpen(false)}
              aria-label="Close Music Player Widget"
              className="p-1.5 rounded-lg text-[#75D9B4]/70 hover:text-[#FBF7EF] hover:bg-[#1B4D48] transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Foreground Background Pause Notice Banner */}
        {isPausedByBackground && (
          <div className="px-3.5 py-2 bg-amber-950/90 border-b border-amber-500/40 text-amber-200 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <EyeOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">Music paused — App was moved to background</span>
            </div>
            {resumeOnReturn && (
              <span className="text-[10px] font-mono text-amber-400 bg-amber-900/60 px-1.5 py-0.5 rounded shrink-0">
                Auto-resume ON
              </span>
            )}
          </div>
        )}

        {/* Import Error Banner */}
        {importError && !errorDismissed && (
          <div className="px-3.5 py-2 bg-rose-950/90 border-b border-rose-500/40 text-rose-200 text-xs flex items-center justify-between gap-2">
            <span className="truncate">{importError}</span>
            <button onClick={() => setErrorDismissed(true)} className="text-rose-400 hover:text-white cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Collapsed Mode Controls */}
        {!isExpanded && (
          <div className="p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={prevTrack}
                disabled={!masterEnabled || tracks.length === 0}
                aria-label="Previous Track"
                className="p-2 rounded-xl text-[#FBF7EF]/80 hover:text-[#FBF7EF] hover:bg-[#143B37] disabled:opacity-40 transition cursor-pointer"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              <button
                onClick={togglePlay}
                disabled={!masterEnabled || tracks.length === 0}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="p-3 rounded-full bg-[#42BDAE] hover:bg-[#75D9B4] text-[#1B4D48] font-bold transition shadow-md disabled:opacity-40 cursor-pointer hover:scale-105"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
              </button>

              <button
                onClick={nextTrack}
                disabled={!masterEnabled || tracks.length === 0}
                aria-label="Next Track"
                className="p-2 rounded-xl text-[#FBF7EF]/80 hover:text-[#FBF7EF] hover:bg-[#143B37] disabled:opacity-40 transition cursor-pointer"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            {/* Time Indicator */}
            <div className="text-[11px] font-mono text-[#75D9B4]">
              {formatAudioTime(currentTime)} / {formatAudioTime(duration)}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
                className="p-2 rounded-xl text-[#FBF7EF]/80 hover:text-[#FBF7EF] hover:bg-[#143B37] transition cursor-pointer"
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-[#B8A4EF]" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <button
                onClick={toggleExpanded}
                className="px-2.5 py-1 rounded-lg bg-[#143B37] hover:bg-[#0F2E2B] text-[#75D9B4] text-xs font-medium transition cursor-pointer"
              >
                Library ({tracks.length})
              </button>
            </div>
          </div>
        )}

        {/* Expanded Mode */}
        {isExpanded && (
          <div className="p-4 space-y-4">
            {/* Tabs */}
            <div className="flex items-center gap-1 p-1 bg-[#143B37] rounded-xl border border-[#75D9B4]/10 text-xs font-medium">
              <button
                onClick={() => setActiveTab('player')}
                className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  activeTab === 'player'
                    ? 'bg-[#42BDAE] text-[#1B4D48] font-bold shadow-xs'
                    : 'text-[#FBF7EF]/70 hover:text-[#FBF7EF]'
                }`}
              >
                <Play className="w-3.5 h-3.5" />
                <span>Now Playing</span>
              </button>
              <button
                onClick={() => setActiveTab('playlist')}
                className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  activeTab === 'playlist'
                    ? 'bg-[#42BDAE] text-[#1B4D48] font-bold shadow-xs'
                    : 'text-[#FBF7EF]/70 hover:text-[#FBF7EF]'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Library ({tracks.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  activeTab === 'settings'
                    ? 'bg-[#42BDAE] text-[#1B4D48] font-bold shadow-xs'
                    : 'text-[#FBF7EF]/70 hover:text-[#FBF7EF]'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Settings</span>
              </button>
            </div>

            {/* TAB 1: NOW PLAYING */}
            {activeTab === 'player' && (
              <div className="space-y-4 pt-1">
                {currentTrack ? (
                  <div className="p-3.5 rounded-xl bg-[#143B37]/60 border border-[#75D9B4]/15 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#75D9B4]">
                      <span>{currentTrack.artist}</span>
                      <span>{formatFileSize(currentTrack.size)}</span>
                    </div>
                    <h3 className="text-sm font-bold text-[#FBF7EF] truncate">{currentTrack.title}</h3>
                    <p className="text-[11px] text-[#FBF7EF]/60 truncate font-mono">{currentTrack.filename}</p>
                  </div>
                ) : (
                  <div className="p-6 rounded-xl bg-[#143B37]/40 border border-[#75D9B4]/15 text-center space-y-3">
                    <Music className="w-8 h-8 text-[#75D9B4] mx-auto opacity-50" />
                    <div>
                      <h4 className="text-xs font-bold text-white">No Music Files Imported</h4>
                      <p className="text-[11px] text-[#FBF7EF]/60 mt-1">
                        Import your downloaded MP3, WAV, M4A, or OGG music files to start listening.
                      </p>
                    </div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      multiple
                      accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 rounded-xl bg-[#42BDAE] hover:bg-[#75D9B4] text-[#1B4D48] text-xs font-bold transition flex items-center justify-center gap-2 mx-auto cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Import Downloaded Music Files</span>
                    </button>
                  </div>
                )}

                {/* Progress Bar & Seek */}
                {currentTrack && (
                  <div className="space-y-1.5">
                    <input
                      type="range"
                      min={0}
                      max={duration || 100}
                      value={currentTime}
                      onChange={(e) => seek(Number(e.target.value))}
                      aria-label="Track Progress Seek Bar"
                      className="w-full h-1.5 bg-[#143B37] rounded-lg appearance-none cursor-pointer accent-[#42BDAE]"
                    />
                    <div className="flex items-center justify-between text-[11px] font-mono text-[#75D9B4]">
                      <span>{formatAudioTime(currentTime)}</span>
                      <span>{formatRemainingTime(currentTime, duration)}</span>
                    </div>
                  </div>
                )}

                {/* Playback Controls & Shuffle/Repeat */}
                {currentTrack && (
                  <div className="flex items-center justify-between py-1 px-2">
                    <button
                      onClick={toggleShuffle}
                      title={shuffleEnabled ? 'Shuffle: ON' : 'Shuffle: OFF'}
                      aria-label="Toggle Shuffle"
                      className={`p-2 rounded-xl transition cursor-pointer ${
                        shuffleEnabled ? 'bg-[#42BDAE] text-[#1B4D48] font-bold' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Shuffle className="w-4 h-4" />
                    </button>

                    <button
                      onClick={prevTrack}
                      aria-label="Previous Track"
                      className="p-2.5 rounded-full bg-[#143B37] hover:bg-[#0F2E2B] text-[#FBF7EF] transition cursor-pointer"
                    >
                      <SkipBack className="w-5 h-5" />
                    </button>

                    <button
                      onClick={togglePlay}
                      disabled={!masterEnabled}
                      aria-label={isPlaying ? 'Pause' : 'Play'}
                      className="p-4 rounded-full bg-[#42BDAE] hover:bg-[#75D9B4] text-[#1B4D48] transition shadow-lg cursor-pointer hover:scale-105 disabled:opacity-40"
                    >
                      {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
                    </button>

                    <button
                      onClick={nextTrack}
                      aria-label="Next Track"
                      className="p-2.5 rounded-full bg-[#143B37] hover:bg-[#0F2E2B] text-[#FBF7EF] transition cursor-pointer"
                    >
                      <SkipForward className="w-5 h-5" />
                    </button>

                    <button
                      onClick={cycleRepeatMode}
                      title={`Repeat Mode: ${repeatMode.toUpperCase()}`}
                      aria-label="Cycle Repeat Mode"
                      className={`p-2 rounded-xl transition cursor-pointer ${
                        repeatMode !== 'none' ? 'bg-[#42BDAE] text-[#1B4D48] font-bold' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
                    </button>
                  </div>
                )}

                {/* Volume Slider */}
                {currentTrack && (
                  <div className="flex items-center gap-3 pt-2 px-2 border-t border-[#75D9B4]/15">
                    <button
                      onClick={toggleMute}
                      aria-label={isMuted ? 'Unmute' : 'Mute'}
                      className="text-[#75D9B4] hover:text-[#FBF7EF] transition cursor-pointer"
                    >
                      {isMuted ? <VolumeX className="w-4 h-4 text-[#B8A4EF]" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={isMuted ? 0 : volume}
                      onChange={(e) => setVolume(Number(e.target.value))}
                      aria-label="Volume Slider"
                      className="w-full h-1.5 bg-[#143B37] rounded-lg appearance-none cursor-pointer accent-[#42BDAE]"
                    />
                    <span className="text-xs font-mono text-[#75D9B4] w-8 text-right">
                      {Math.round((isMuted ? 0 : volume) * 100)}%
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: LIBRARY / PLAYLIST */}
            {activeTab === 'playlist' && (
              <div className="space-y-3 pt-1">
                {/* Search & Add Action */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search imported music..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#143B37] border border-[#75D9B4]/20 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#42BDAE]"
                    />
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    title="Import More Local Music Files"
                    className="p-2 rounded-xl bg-[#42BDAE] hover:bg-[#75D9B4] text-[#1B4D48] transition shrink-0 cursor-pointer"
                  >
                    <Upload className="w-4 h-4 font-bold" />
                  </button>
                </div>

                {/* Track List */}
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
                  {filteredTracks.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400 bg-[#143B37]/30 rounded-xl border border-[#75D9B4]/10">
                      {tracks.length === 0
                        ? 'Your music library is empty. Click Import to add your downloaded tracks.'
                        : 'No tracks match your search query.'}
                    </div>
                  ) : (
                    filteredTracks.map((track, idx) => {
                      const actualIdx = tracks.findIndex((t) => t.id === track.id);
                      const isSelected = actualIdx === currentTrackIndex;

                      return (
                        <div
                          key={track.id}
                          onClick={() => playTrack(actualIdx)}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 transition cursor-pointer ${
                            isSelected
                              ? 'bg-[#42BDAE]/20 border-[#42BDAE] text-[#FBF7EF]'
                              : 'bg-[#143B37]/40 border-[#75D9B4]/10 text-[#FBF7EF]/80 hover:bg-[#143B37]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                                isSelected ? 'bg-[#42BDAE] text-[#1B4D48]' : 'bg-[#143B37] text-[#75D9B4]'
                              }`}
                            >
                              {isSelected && isPlaying ? (
                                <Play className="w-3.5 h-3.5 fill-current animate-pulse" />
                              ) : (
                                actualIdx + 1
                              )}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold truncate">{track.title}</h4>
                              <p className="text-[10px] text-slate-300/70 truncate font-mono">{track.filename}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] font-mono text-[#75D9B4]">
                              {formatFileSize(track.size)}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setTrackToDelete(track.id);
                              }}
                              title="Delete track"
                              aria-label={`Remove ${track.title}`}
                              className="p-1 rounded text-[#B8A4EF] hover:text-rose-300 hover:bg-rose-950/40 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Track Removal Confirm Modal */}
                {trackToDelete && (
                  <div className="p-3 rounded-xl bg-rose-950/90 border border-rose-500/40 text-rose-200 text-xs space-y-2">
                    <p className="font-semibold">Remove this imported music file from library?</p>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={async () => {
                          await removeTrack(trackToDelete);
                          setTrackToDelete(null);
                        }}
                        className="px-3 py-1 rounded bg-rose-600 text-white font-bold cursor-pointer"
                      >
                        Confirm Delete
                      </button>
                      <button
                        onClick={() => setTrackToDelete(null)}
                        className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: SETTINGS */}
            {activeTab === 'settings' && (
              <div className="space-y-3 pt-1 text-xs">
                <div className="p-3 rounded-xl bg-[#143B37]/60 border border-[#75D9B4]/15 space-y-3">
                  {/* Master Switch */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white block">Master Background Music</span>
                      <span className="text-[10px] text-slate-300">Master OFF switch stops all playback</span>
                    </div>
                    <button
                      onClick={() => setMasterEnabled(!masterEnabled)}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        masterEnabled ? 'bg-[#42BDAE]' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                          masterEnabled ? 'left-6' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Resume on Return Switch */}
                  <div className="flex items-center justify-between pt-2 border-t border-[#75D9B4]/10">
                    <div>
                      <span className="font-bold text-white block">Resume on Foreground Return</span>
                      <span className="text-[10px] text-slate-300">
                        Resume track when returning if app was moved to background
                      </span>
                    </div>
                    <button
                      onClick={() => setResumeOnReturn(!resumeOnReturn)}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        resumeOnReturn ? 'bg-[#42BDAE]' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                          resumeOnReturn ? 'left-6' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Library Reset Actions */}
                <div className="p-3 rounded-xl bg-[#143B37]/40 border border-[#75D9B4]/15 space-y-2">
                  <span className="font-bold text-[#75D9B4]">Library & Storage Management</span>
                  {!showClearConfirm ? (
                    <button
                      onClick={() => setShowClearConfirm(true)}
                      disabled={tracks.length === 0}
                      className="w-full py-2 px-3 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-500/30 text-rose-300 font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-40 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove All Imported Tracks</span>
                    </button>
                  ) : (
                    <div className="p-2.5 rounded-lg bg-rose-950 border border-rose-500 text-rose-200 space-y-2">
                      <p className="font-semibold text-[11px]">Clear all imported audio files from IndexedDB?</p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={async () => {
                            await clearLibrary();
                            setShowClearConfirm(false);
                          }}
                          className="px-3 py-1 rounded bg-rose-600 text-white font-bold cursor-pointer"
                        >
                          Clear All
                        </button>
                        <button
                          onClick={() => setShowClearConfirm(false)}
                          className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
