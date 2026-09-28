// Tiny synthesised sound effects, so there are no audio files to load.

let audio: AudioContext | null = null;

function getAudio(): AudioContext | null {
  try {
    audio ??= new AudioContext();
    // Browsers start audio suspended until the page has been clicked.
    if (audio.state === "suspended") void audio.resume();
    return audio;
  } catch {
    return null; // no audio support; stay silent
  }
}

// A short "blip" that drops in pitch. Bigger bubbles pop lower.
export function playPop(radiusPx: number): void {
  const ctx = getAudio();
  if (!ctx) return;

  const now = ctx.currentTime;
  const pitch =
    Math.max(350, 1100 - radiusPx * 22) * (0.9 + Math.random() * 0.2);

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(pitch, now);
  osc.frequency.exponentialRampToValueAtTime(pitch * 0.35, now + 0.08);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.2, now + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.12);
}
