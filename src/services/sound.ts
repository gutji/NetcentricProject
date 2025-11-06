// src/services/sound.ts
// Simple sound helper that respects Settings (mute flags saved on <html> dataset)

import hitUrl from '../assets/hit.mp3';
import missUrl from '../assets/not hit.mp3';

let hitAudio: HTMLAudioElement | null = null;
let missAudio: HTMLAudioElement | null = null;

function ensureHit(): HTMLAudioElement {
  if (!hitAudio) {
    hitAudio = new Audio(hitUrl);
    hitAudio.preload = 'auto';
    hitAudio.volume = 0.8;
  }
  return hitAudio;
}

function ensureMiss(): HTMLAudioElement {
  if (!missAudio) {
    missAudio = new Audio(missUrl);
    missAudio.preload = 'auto';
    missAudio.volume = 0.7;
  }
  return missAudio;
}

function isSfxMuted(): boolean {
  try {
    return (document.documentElement.dataset.muteSfx ?? 'false') === 'true';
  } catch {
    return false;
  }
}

export function playHit() {
  if (isSfxMuted()) return;
  const a = ensureHit();
  try {
    a.currentTime = 0;
    void a.play().catch(() => {});
  } catch {}
}

export function playMiss() {
  if (isSfxMuted()) return;
  const a = ensureMiss();
  try {
    a.currentTime = 0;
    void a.play().catch(() => {});
  } catch {}
}
