import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatAudioTime,
  formatRemainingTime,
  cleanFilenameToTitle,
  clampVolume,
  formatFileSize,
  validateAudioFile,
  getNextTrackIndex,
  getPrevTrackIndex,
} from './localMusicLogic.ts';

test('formatAudioTime formats seconds correctly', () => {
  assert.equal(formatAudioTime(0), '00:00');
  assert.equal(formatAudioTime(65), '01:05');
  assert.equal(formatAudioTime(255), '04:15');
  assert.equal(formatAudioTime(-10), '00:00');
  assert.equal(formatAudioTime(NaN), '00:00');
});

test('formatRemainingTime returns formatted negative remaining time', () => {
  assert.equal(formatRemainingTime(60, 240), '-03:00');
  assert.equal(formatRemainingTime(0, 100), '-01:40');
  assert.equal(formatRemainingTime(100, 100), '-00:00');
});

test('cleanFilenameToTitle cleans file extension and formats title', () => {
  assert.equal(cleanFilenameToTitle('Tere_Vaaste_Song.mp3'), 'Tere Vaaste Song');
  assert.equal(cleanFilenameToTitle('kesariya-bollywood-mix.wav'), 'Kesariya Bollywood Mix');
  assert.equal(cleanFilenameToTitle('Ranga_Instrumental.m4a'), 'Ranga Instrumental');
  assert.equal(cleanFilenameToTitle(''), 'Untitled Local Track');
});

test('clampVolume clamps volume between 0 and 1', () => {
  assert.equal(clampVolume(0.8), 0.8);
  assert.equal(clampVolume(1.5), 1);
  assert.equal(clampVolume(-0.5), 0);
  assert.equal(clampVolume(NaN), 0.5);
});

test('formatFileSize formats bytes to human readable string', () => {
  assert.equal(formatFileSize(1024), '1.0 KB');
  assert.equal(formatFileSize(1048576 * 4.5), '4.5 MB');
  assert.equal(formatFileSize(0), '0 B');
});

test('validateAudioFile accepts audio formats and rejects non-audio', () => {
  const mp3File = new File(['dummy'], 'song.mp3', { type: 'audio/mpeg' });
  assert.equal(validateAudioFile(mp3File).isValid, true);

  const txtFile = new File(['text'], 'notes.txt', { type: 'text/plain' });
  assert.equal(validateAudioFile(txtFile).isValid, false);
});

test('getNextTrackIndex respects repeatMode one and all', () => {
  assert.equal(getNextTrackIndex(1, 5, false, 'one'), 1);
  assert.equal(getNextTrackIndex(4, 5, false, 'all'), 0);
  assert.equal(getNextTrackIndex(4, 5, false, 'none'), 4);
  assert.equal(getNextTrackIndex(1, 5, false, 'all'), 2);
});

test('getPrevTrackIndex wraps correctly', () => {
  assert.equal(getPrevTrackIndex(0, 5, false), 4);
  assert.equal(getPrevTrackIndex(3, 5, false), 2);
});
