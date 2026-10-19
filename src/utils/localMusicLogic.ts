export type RepeatMode = 'none' | 'one' | 'all';

export function formatAudioTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0 || !isFinite(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const formattedMins = mins < 10 ? `0${mins}` : `${mins}`;
  const formattedSecs = secs < 10 ? `0${secs}` : `${secs}`;
  return `${formattedMins}:${formattedSecs}`;
}

export function formatRemainingTime(seconds: number, duration: number): string {
  if (isNaN(seconds) || isNaN(duration) || duration <= 0) return '-00:00';
  const remaining = Math.max(0, duration - seconds);
  return `-${formatAudioTime(remaining)}`;
}

export function cleanFilenameToTitle(filename: string): string {
  if (!filename) return 'Untitled Local Track';

  // Remove file extension (.mp3, .m4a, .wav, .ogg, .flac, .aac)
  let nameWithoutExt = filename.replace(/\.(mp3|m4a|wav|ogg|flac|aac|wma)$/i, '');

  // Replace underscores and multiple dashes with spaces
  nameWithoutExt = nameWithoutExt.replace(/[-_]+/g, ' ').trim();

  if (!nameWithoutExt) return filename;

  // Title-case words nicely
  return nameWithoutExt
    .split(' ')
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : ''))
    .join(' ');
}

export function clampVolume(volume: number): number {
  if (isNaN(volume)) return 0.5;
  return Math.min(1, Math.max(0, volume));
}

export function formatFileSize(bytes: number): string {
  if (isNaN(bytes) || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = (bytes / Math.pow(k, i)).toFixed(1);
  return `${value} ${sizes[i]}`;
}

export function validateAudioFile(file: File): { isValid: boolean; message?: string } {
  if (!file) {
    return { isValid: false, message: 'No file provided.' };
  }

  const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/aac', 'audio/mp4', 'audio/m4a', 'audio/x-m4a'];
  const validExtensions = /\.(mp3|wav|ogg|m4a|aac|flac)$/i;

  const typeMatch = validTypes.includes(file.type.toLowerCase()) || file.type.startsWith('audio/');
  const extMatch = validExtensions.test(file.name);

  if (!typeMatch && !extMatch) {
    return {
      isValid: false,
      message: `"${file.name}" is not a supported local audio format (MP3, WAV, OGG, M4A, AAC).`,
    };
  }

  return { isValid: true };
}

export function getNextTrackIndex(
  currentIndex: number,
  totalTracks: number,
  shuffle: boolean = false,
  repeatMode: RepeatMode = 'all'
): number {
  if (totalTracks <= 0) return 0;

  if (repeatMode === 'one') {
    return currentIndex;
  }

  if (shuffle && totalTracks > 1) {
    let nextIdx = currentIndex;
    // Pick a random track that isn't the current index if possible
    while (nextIdx === currentIndex) {
      nextIdx = Math.floor(Math.random() * totalTracks);
    }
    return nextIdx;
  }

  if (currentIndex >= totalTracks - 1) {
    return repeatMode === 'all' ? 0 : currentIndex;
  }

  return currentIndex + 1;
}

export function getPrevTrackIndex(
  currentIndex: number,
  totalTracks: number,
  shuffle: boolean = false
): number {
  if (totalTracks <= 0) return 0;

  if (shuffle && totalTracks > 1) {
    let prevIdx = currentIndex;
    while (prevIdx === currentIndex) {
      prevIdx = Math.floor(Math.random() * totalTracks);
    }
    return prevIdx;
  }

  return (currentIndex - 1 + totalTracks) % totalTracks;
}
