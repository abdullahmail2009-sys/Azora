import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import {
  LocalTrackMetadata,
  musicDB,
} from '../services/musicDb.ts';
import {
  localAudioController,
  PlaybackStatus,
} from '../services/localAudioController.ts';
import {
  getNextTrackIndex,
  getPrevTrackIndex,
  cleanFilenameToTitle,
  validateAudioFile,
  clampVolume,
  RepeatMode,
} from '../utils/localMusicLogic.ts';

interface LocalMusicContextType {
  tracks: LocalTrackMetadata[];
  currentTrackIndex: number;
  currentTrack: LocalTrackMetadata | null;

  isPlaying: boolean;
  isPausedByBackground: boolean;
  isMuted: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  playbackStatus: PlaybackStatus;

  // Preferences
  masterEnabled: boolean; // Master ON/OFF
  resumeOnReturn: boolean;
  shuffleEnabled: boolean;
  repeatMode: RepeatMode;

  // UI state
  isPlayerOpen: boolean;
  isExpanded: boolean;
  isImporting: boolean;
  importError: string | null;

  // Actions
  importFiles: (files: FileList | File[]) => Promise<number>;
  playTrack: (index: number) => Promise<void>;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seek: (seconds: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeatMode: () => void;
  setMasterEnabled: (enabled: boolean) => void;
  setResumeOnReturn: (enabled: boolean) => void;
  removeTrack: (id: string) => Promise<void>;
  clearLibrary: () => Promise<void>;
  clearPreferences: () => void;
  togglePlayerOpen: () => void;
  setIsPlayerOpen: (open: boolean) => void;
  toggleExpanded: () => void;
  setIsExpanded: (expanded: boolean) => void;
}

const LocalMusicContext = createContext<LocalMusicContextType | undefined>(undefined);

const PREF_MASTER_ENABLED = 'mystudypath_music_master_enabled';
const PREF_RESUME_RETURN = 'mystudypath_music_resume_return';
const PREF_VOLUME = 'mystudypath_music_volume';
const PREF_SHUFFLE = 'mystudypath_music_shuffle';
const PREF_REPEAT = 'mystudypath_music_repeat';
const PREF_LAST_TRACK_ID = 'mystudypath_music_last_track_id';
const PREF_LAST_POSITION = 'mystudypath_music_last_position';

export const LocalMusicProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tracks, setTracks] = useState<LocalTrackMetadata[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(0);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPausedByBackground, setIsPausedByBackground] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const [volume, setVolumeState] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(PREF_VOLUME);
      return saved ? Number(saved) : 0.5;
    }
    return 0.5;
  });

  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus>('stopped');

  // Master Music Switch (OFF by default for safety until enabled by user)
  const [masterEnabled, setMasterEnabledState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(PREF_MASTER_ENABLED);
      return saved === 'true';
    }
    return false;
  });

  const [resumeOnReturn, setResumeOnReturnState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(PREF_RESUME_RETURN);
      return saved === 'true';
    }
    return false;
  });

  const [shuffleEnabled, setShuffleEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(PREF_SHUFFLE);
      return saved === 'true';
    }
    return false;
  });

  const [repeatMode, setRepeatMode] = useState<RepeatMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(PREF_REPEAT);
      return (saved as RepeatMode) || 'all';
    }
    return 'all';
  });

  const [isPlayerOpen, setIsPlayerOpen] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importError, setImportError] = useState<string | null>(null);

  const currentTrack = tracks[currentTrackIndex] || null;

  // Keep a live ref to avoid stale closures in audio controller callbacks
  const stateRef = useRef({
    tracks,
    currentTrackIndex,
    repeatMode,
    shuffleEnabled,
    masterEnabled,
  });

  useEffect(() => {
    stateRef.current = {
      tracks,
      currentTrackIndex,
      repeatMode,
      shuffleEnabled,
      masterEnabled,
    };
  }, [tracks, currentTrackIndex, repeatMode, shuffleEnabled, masterEnabled]);

  const playTrackByIndex = async (index: number, tracksList?: LocalTrackMetadata[], startPos: number = 0) => {
    const activeTracks = tracksList || stateRef.current.tracks;
    if (index < 0 || index >= activeTracks.length) return;

    if (!stateRef.current.masterEnabled) {
      setImportError('Music is disabled. Turn ON Master Background Music switch in Settings.');
      return;
    }

    const targetTrack = activeTracks[index];
    setCurrentTrackIndex(index);
    localStorage.setItem(PREF_LAST_TRACK_ID, targetTrack.id);

    try {
      const blob = await musicDB.getTrackBlob(targetTrack.id);
      if (!blob) {
        setImportError(`Audio file for "${targetTrack.title}" is missing or inaccessible.`);
        return;
      }

      await localAudioController.loadAndPlay(targetTrack.id, blob, startPos);
      setIsPlayerOpen(true);
    } catch (err) {
      console.error('Error loading audio blob:', err);
      setImportError(`Could not play "${targetTrack.title}".`);
    }
  };

  // Initialize Audio Controller & Load Persistent Library from IndexedDB
  useEffect(() => {
    localAudioController.setMasterEnabled(masterEnabled);
    localAudioController.setResumeOnReturn(resumeOnReturn);
    localAudioController.setVolume(volume);

    localAudioController.setCallbacks({
      onTimeUpdate: (cTime, dur) => {
        setCurrentTime(cTime);
        if (dur && isFinite(dur) && dur > 0) {
          setDuration(dur);
        }
        // Save position periodically in localStorage
        if (cTime > 0 && Math.floor(cTime) % 3 === 0) {
          localStorage.setItem(PREF_LAST_POSITION, Math.floor(cTime).toString());
        }
      },
      onStatusChange: (status) => {
        setPlaybackStatus(status);
        setIsPlaying(status === 'playing');
        setIsPausedByBackground(status === 'paused_background');
      },
      onEnded: () => {
        const {
          tracks: liveTracks,
          currentTrackIndex: liveIdx,
          repeatMode: liveRepeat,
          shuffleEnabled: liveShuffle,
        } = stateRef.current;

        if (liveTracks.length === 0) return;

        if (liveRepeat === 'one') {
          playTrackByIndex(liveIdx, liveTracks, 0);
        } else if (liveRepeat === 'none' && !liveShuffle && liveIdx >= liveTracks.length - 1) {
          localAudioController.stop();
        } else {
          const nextIdx = getNextTrackIndex(
            liveIdx,
            liveTracks.length,
            liveShuffle,
            liveRepeat
          );
          playTrackByIndex(nextIdx, liveTracks, 0);
        }
      },
      onError: (msg) => {
        setImportError(msg);
      },
    });

    // Load stored tracks from IndexedDB
    loadTrackMetadataFromDB();
  }, []);

  const loadTrackMetadataFromDB = async () => {
    try {
      const loaded = await musicDB.getAllTrackMetadata();
      setTracks(loaded);

      if (loaded.length > 0) {
        const lastTrackId = localStorage.getItem(PREF_LAST_TRACK_ID);
        if (lastTrackId) {
          const foundIdx = loaded.findIndex((t) => t.id === lastTrackId);
          if (foundIdx >= 0) {
            setCurrentTrackIndex(foundIdx);
            if (loaded[foundIdx].duration > 0) {
              setDuration(loaded[foundIdx].duration);
            }
            const savedPos = Number(localStorage.getItem(PREF_LAST_POSITION) || '0');
            if (savedPos > 0 && isFinite(savedPos)) {
              setCurrentTime(savedPos);
            }
          }
        }
      }
    } catch (e) {
      console.error('Failed to load local tracks from IndexedDB:', e);
    }
  };

  /**
   * Helper to probe audio file duration offline via HTMLAudioElement metadata
   */
  const probeAudioDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined') {
        resolve(0);
        return;
      }
      const tempUrl = URL.createObjectURL(file);
      const tempAudio = new Audio();
      const timeout = setTimeout(() => {
        URL.revokeObjectURL(tempUrl);
        resolve(0);
      }, 2000);

      tempAudio.preload = 'metadata';
      tempAudio.onloadedmetadata = () => {
        clearTimeout(timeout);
        const d = isFinite(tempAudio.duration) && tempAudio.duration > 0 ? Math.round(tempAudio.duration) : 0;
        URL.revokeObjectURL(tempUrl);
        resolve(d);
      };
      tempAudio.onerror = () => {
        clearTimeout(timeout);
        URL.revokeObjectURL(tempUrl);
        resolve(0);
      };
      tempAudio.src = tempUrl;
    });
  };

  /**
   * Import local downloaded music files (MP3, WAV, M4A, OGG, etc.)
   */
  const importFiles = async (fileList: FileList | File[]): Promise<number> => {
    const filesArray = Array.from(fileList);
    if (filesArray.length === 0) return 0;

    setIsImporting(true);
    setImportError(null);

    let importedCount = 0;
    const newMetadataList: LocalTrackMetadata[] = [];

    for (const file of filesArray) {
      const validation = validateAudioFile(file);
      if (!validation.isValid) {
        setImportError(validation.message || 'Invalid file format.');
        continue;
      }

      // Check if duplicate file already exists in library (same filename & size)
      const isDuplicate = tracks.some(
        (t) => t.filename === file.name && t.size === file.size
      );
      if (isDuplicate) {
        console.log(`Skipping duplicate track: ${file.name}`);
        continue;
      }

      const id = `track-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const cleanTitle = cleanFilenameToTitle(file.name);
      const detectedDuration = await probeAudioDuration(file);

      const metadata: LocalTrackMetadata = {
        id,
        filename: file.name,
        title: cleanTitle,
        artist: 'Local Music Track',
        album: 'My StudyPath Music',
        duration: detectedDuration,
        size: file.size,
        type: file.type || 'audio/mpeg',
        addedAt: Date.now(),
      };

      try {
        await musicDB.saveTrack(metadata, file);
        newMetadataList.push(metadata);
        importedCount++;
      } catch (err) {
        console.error(`Error saving track ${file.name}:`, err);
      }
    }

    if (importedCount > 0) {
      const updated = [...tracks, ...newMetadataList];
      setTracks(updated);
      setIsPlayerOpen(true);
    }

    setIsImporting(false);
    return importedCount;
  };

  /**
   * Play track by index
   */
  const playTrack = async (index: number) => {
    await playTrackByIndex(index, tracks, 0);
  };

  const togglePlay = () => {
    if (!masterEnabled) {
      setImportError('Enable Master Music Switch to start music playback.');
      return;
    }

    if (!currentTrack && tracks.length > 0) {
      playTrack(0);
      return;
    }

    if (playbackStatus === 'playing') {
      localAudioController.pause(true);
    } else if (playbackStatus === 'paused' || playbackStatus === 'paused_background') {
      localAudioController.play();
    } else if (currentTrack) {
      const savedPos =
        localStorage.getItem(PREF_LAST_TRACK_ID) === currentTrack.id
          ? Number(localStorage.getItem(PREF_LAST_POSITION) || '0')
          : 0;
      playTrackByIndex(currentTrackIndex, tracks, savedPos > 0 ? savedPos : 0);
    }
    setIsPlayerOpen(true);
  };

  const nextTrack = () => {
    if (tracks.length === 0) return;
    const nextIdx = getNextTrackIndex(
      currentTrackIndex,
      tracks.length,
      shuffleEnabled,
      repeatMode
    );
    playTrack(nextIdx);
  };

  const prevTrack = () => {
    if (tracks.length === 0) return;
    const prevIdx = getPrevTrackIndex(currentTrackIndex, tracks.length, shuffleEnabled);
    playTrack(prevIdx);
  };

  const seek = (seconds: number) => {
    setCurrentTime(seconds);
    localAudioController.seek(seconds);
  };

  const setVolume = (vol: number) => {
    const clamped = clampVolume(vol);
    setVolumeState(clamped);
    localStorage.setItem(PREF_VOLUME, clamped.toString());
    localAudioController.setVolume(clamped);
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    localAudioController.setMuted(nextMuted);
  };

  const toggleShuffle = () => {
    const nextShuffle = !shuffleEnabled;
    setShuffleEnabled(nextShuffle);
    localStorage.setItem(PREF_SHUFFLE, nextShuffle ? 'true' : 'false');
  };

  const cycleRepeatMode = () => {
    const modes: RepeatMode[] = ['none', 'all', 'one'];
    const nextMode = modes[(modes.indexOf(repeatMode) + 1) % modes.length];
    setRepeatMode(nextMode);
    localStorage.setItem(PREF_REPEAT, nextMode);
  };

  const setMasterEnabled = (enabled: boolean) => {
    setMasterEnabledState(enabled);
    localStorage.setItem(PREF_MASTER_ENABLED, enabled ? 'true' : 'false');
    localAudioController.setMasterEnabled(enabled);
  };

  const setResumeOnReturn = (enabled: boolean) => {
    setResumeOnReturnState(enabled);
    localStorage.setItem(PREF_RESUME_RETURN, enabled ? 'true' : 'false');
    localAudioController.setResumeOnReturn(enabled);
  };

  const removeTrack = async (id: string) => {
    try {
      await musicDB.deleteTrack(id);
      const updated = tracks.filter((t) => t.id !== id);
      setTracks(updated);

      if (currentTrack?.id === id) {
        localAudioController.stop();
        if (updated.length > 0) {
          setCurrentTrackIndex(0);
        }
      }
    } catch (err) {
      console.error('Failed to delete track:', err);
    }
  };

  const clearLibrary = async () => {
    try {
      localAudioController.stop();
      await musicDB.clearAll();
      setTracks([]);
      setCurrentTrackIndex(0);
      localStorage.removeItem(PREF_LAST_TRACK_ID);
      localStorage.removeItem(PREF_LAST_POSITION);
    } catch (err) {
      console.error('Failed to clear music library:', err);
    }
  };

  const clearPreferences = () => {
    setMasterEnabled(false);
    setResumeOnReturn(false);
    setVolume(0.5);
    setShuffleEnabled(false);
    setRepeatMode('all');
    localStorage.removeItem(PREF_MASTER_ENABLED);
    localStorage.removeItem(PREF_RESUME_RETURN);
    localStorage.removeItem(PREF_VOLUME);
    localStorage.removeItem(PREF_SHUFFLE);
    localStorage.removeItem(PREF_REPEAT);
    localStorage.removeItem(PREF_LAST_TRACK_ID);
    localStorage.removeItem(PREF_LAST_POSITION);
  };

  return (
    <LocalMusicContext.Provider
      value={{
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
        clearPreferences,
        togglePlayerOpen: () => setIsPlayerOpen((prev) => !prev),
        setIsPlayerOpen,
        toggleExpanded: () => setIsExpanded((prev) => !prev),
        setIsExpanded,
      }}
    >
      {children}
    </LocalMusicContext.Provider>
  );
};

export const useLocalMusic = () => {
  const context = useContext(LocalMusicContext);
  if (!context) {
    throw new Error('useLocalMusic must be used within a LocalMusicProvider');
  }
  return context;
};
