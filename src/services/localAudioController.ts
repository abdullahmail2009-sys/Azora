/**
 * LocalAudioController
 * Authoritative single-instance audio controller for user's downloaded local music files.
 * Enforces STRICT FOREGROUND-ONLY PLAYBACK using the Page Visibility API, Capacitor App lifecycle, and Lifecycle events.
 */
import { App as CapApp } from '@capacitor/app';

export type PlaybackStatus =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'paused_background'
  | 'stopped'
  | 'autoplay_blocked'
  | 'error';

export interface LocalAudioCallbacks {
  onTimeUpdate: (currentTime: number, duration: number) => void;
  onStatusChange: (status: PlaybackStatus) => void;
  onEnded: () => void;
  onError: (errorMessage: string) => void;
}

class LocalAudioController {
  private audio: HTMLAudioElement | null = null;
  private currentObjectUrl: string | null = null;
  private currentTrackId: string | null = null;

  private status: PlaybackStatus = 'idle';
  private masterEnabled: boolean = false; // Master OFF by default
  private resumeOnReturn: boolean = false; // Resume on return toggle
  private manuallyPausedByUser: boolean = false;
  private isPausedByBackground: boolean = false;

  private currentVolume: number = 0.5;
  private isMuted: boolean = false;

  private callbacks: LocalAudioCallbacks | null = null;
  private capAppStateHandle: { remove: () => Promise<void> } | null = null;
  private boundVisibilityHandler: (() => void) | null = null;
  private boundPauseBackgroundHandler: (() => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.audio = new Audio();
      this.audio.crossOrigin = 'anonymous';

      // 1. Time Update Listener
      this.audio.addEventListener('timeupdate', () => {
        if (this.callbacks && this.audio) {
          this.callbacks.onTimeUpdate(
            this.audio.currentTime || 0,
            this.audio.duration || 0
          );
        }
      });

      // 2. Ended Listener
      this.audio.addEventListener('ended', () => {
        this.setStatus('stopped');
        if (this.callbacks) {
          this.callbacks.onEnded();
        }
      });

      // 3. Error Listener
      this.audio.addEventListener('error', (e) => {
        console.warn('Audio playback error:', e);
        this.setStatus('error');
        if (this.callbacks) {
          this.callbacks.onError(
            'Unable to play audio file. The file may be corrupt or formatted in an unsupported codec.'
          );
        }
      });

      this.boundVisibilityHandler = () => {
        this.handleVisibilityChange();
      };
      this.boundPauseBackgroundHandler = () => {
        this.pauseForBackground();
      };

      // 4. Page Visibility API Listener (CRITICAL FOR FOREGROUND-ONLY PLAYBACK)
      document.addEventListener('visibilitychange', this.boundVisibilityHandler);
      window.addEventListener('blur', this.boundVisibilityHandler);
      window.addEventListener('focus', this.boundVisibilityHandler);

      // Page unload / freeze / pagehide listener
      window.addEventListener('pagehide', this.boundPauseBackgroundHandler);
      document.addEventListener('freeze', this.boundPauseBackgroundHandler);
      window.addEventListener('beforeunload', this.boundPauseBackgroundHandler);

      // 5. Capacitor Native App State Listener (Android/iOS WebView lifecycle)
      CapApp.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) {
          this.pauseForBackground();
        } else {
          this.handleReturnToForeground(true);
        }
      })
        .then((handle) => {
          this.capAppStateHandle = handle;
        })
        .catch(() => {
          // Ignored when running in standard desktop/mobile browser without native bridge
        });
    }
  }

  public setCallbacks(callbacks: LocalAudioCallbacks) {
    this.callbacks = callbacks;
  }

  private setStatus(newStatus: PlaybackStatus) {
    this.status = newStatus;
    if (this.callbacks) {
      this.callbacks.onStatusChange(newStatus);
    }
  }

  public getStatus(): PlaybackStatus {
    return this.status;
  }

  public isForegroundPaused(): boolean {
    return this.isPausedByBackground;
  }

  public setMasterEnabled(enabled: boolean) {
    this.masterEnabled = enabled;
    if (!enabled) {
      // Immediate hard stop when master switch is turned OFF
      this.stop();
    }
  }

  public setResumeOnReturn(enabled: boolean) {
    this.resumeOnReturn = enabled;
  }

  /**
   * Handle Visibility Change (Foreground vs Background Lifecycle)
   */
  private handleVisibilityChange() {
    const isHidden =
      typeof document !== 'undefined' &&
      (document.visibilityState === 'hidden' || !document.hasFocus());

    if (isHidden) {
      this.pauseForBackground();
    } else {
      this.handleReturnToForeground();
    }
  }

  /**
   * Pause immediately when app leaves foreground
   */
  private pauseForBackground() {
    if (this.status === 'playing' && this.audio) {
      this.audio.pause();
      this.isPausedByBackground = true;
      this.setStatus('paused_background');
    }
  }

  /**
   * Handle Return to Foreground
   */
  private handleReturnToForeground(isNativeActive: boolean = false) {
    // Only attempt resume if:
    // 1. Master toggle is ON
    // 2. Resume on return is ON
    // 3. User did NOT manually press pause before leaving
    // 4. Audio was paused by background transition
    // 5. Document is currently visible (or native Capacitor appStateChange reported isActive: true)
    const isVisible =
      isNativeActive ||
      (typeof document !== 'undefined' && document.visibilityState === 'visible');

    if (
      this.masterEnabled &&
      this.resumeOnReturn &&
      !this.manuallyPausedByUser &&
      this.isPausedByBackground &&
      isVisible &&
      this.audio &&
      this.currentObjectUrl
    ) {
      this.isPausedByBackground = false;
      this.audio
        .play()
        .then(() => {
          this.setStatus('playing');
        })
        .catch((err) => {
          console.warn('Autoplay blocked on foreground return:', err);
          this.setStatus('autoplay_blocked');
        });
    }
  }

  /**
   * Load and play a local audio file Blob
   */
  public async loadAndPlay(trackId: string, audioBlob: Blob, startPosition: number = 0) {
    if (!this.masterEnabled) {
      console.warn('Playback blocked: Master Music Toggle is OFF');
      this.setStatus('stopped');
      return;
    }

    if (!this.audio) return;

    // Check if app is in background
    if (document.visibilityState === 'hidden') {
      console.warn('Playback blocked: App is currently in background');
      return;
    }

    this.setStatus('loading');
    this.manuallyPausedByUser = false;
    this.isPausedByBackground = false;

    // Revoke previous Object URL to avoid memory leaks
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }

    try {
      this.currentTrackId = trackId;
      this.currentObjectUrl = URL.createObjectURL(audioBlob);

      this.audio.src = this.currentObjectUrl;
      this.audio.volume = this.isMuted ? 0 : this.currentVolume;

      if (startPosition > 0 && isFinite(startPosition)) {
        this.audio.currentTime = startPosition;
      }

      await this.audio.play();
      this.setStatus('playing');
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        console.warn('Browser autoplay policy blocked playback. Waiting for user interaction.');
        this.setStatus('autoplay_blocked');
      } else {
        console.error('Failed to play audio:', err);
        this.setStatus('error');
        if (this.callbacks) {
          this.callbacks.onError('Playback failed. Please select a valid local audio file.');
        }
      }
    }
  }

  /**
   * User pressed Play
   */
  public play() {
    if (!this.masterEnabled) return;
    if (document.visibilityState === 'hidden') return;

    this.manuallyPausedByUser = false;
    this.isPausedByBackground = false;

    if (this.audio && this.audio.src) {
      this.audio
        .play()
        .then(() => {
          this.setStatus('playing');
        })
        .catch((err) => {
          console.warn('Play attempt blocked:', err);
          this.setStatus('autoplay_blocked');
        });
    }
  }

  /**
   * User pressed Pause
   */
  public pause(isManual: boolean = true) {
    if (isManual) {
      this.manuallyPausedByUser = true;
      this.isPausedByBackground = false;
    }

    if (this.audio) {
      this.audio.pause();
    }
    this.setStatus('paused');
  }

  /**
   * Toggle Play / Pause
   */
  public togglePlay() {
    if (this.status === 'playing') {
      this.pause(true);
    } else {
      this.play();
    }
  }

  /**
   * Seek to position in seconds
   */
  public seek(seconds: number) {
    if (this.audio && isFinite(seconds) && seconds >= 0) {
      this.audio.currentTime = seconds;
      if (this.callbacks) {
        this.callbacks.onTimeUpdate(seconds, this.audio.duration || 0);
      }
    }
  }

  /**
   * Set Volume (0 to 1)
   */
  public setVolume(val: number) {
    this.currentVolume = Math.min(1, Math.max(0, val));
    if (this.audio) {
      this.audio.volume = this.isMuted ? 0 : this.currentVolume;
    }
  }

  /**
   * Set Muted
   */
  public setMuted(muted: boolean) {
    this.isMuted = muted;
    this.setVolume(this.currentVolume);
  }

  /**
   * Stop and cleanup current track
   */
  public stop() {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio.removeAttribute('src');
      this.audio.load();
    }

    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }

    this.currentTrackId = null;
    this.manuallyPausedByUser = false;
    this.isPausedByBackground = false;
    this.setStatus('stopped');
  }

  /**
   * Cleanly removes lifecycle and Capacitor appStateChange listeners.
   */
  public destroy() {
    this.stop();
    if (typeof window !== 'undefined') {
      if (this.boundVisibilityHandler) {
        document.removeEventListener('visibilitychange', this.boundVisibilityHandler);
        window.removeEventListener('blur', this.boundVisibilityHandler);
        window.removeEventListener('focus', this.boundVisibilityHandler);
      }
      if (this.boundPauseBackgroundHandler) {
        window.removeEventListener('pagehide', this.boundPauseBackgroundHandler);
        document.removeEventListener('freeze', this.boundPauseBackgroundHandler);
        window.removeEventListener('beforeunload', this.boundPauseBackgroundHandler);
      }
    }
    if (this.capAppStateHandle) {
      this.capAppStateHandle.remove().catch(() => {});
      this.capAppStateHandle = null;
    }
  }
}

export const localAudioController = new LocalAudioController();
