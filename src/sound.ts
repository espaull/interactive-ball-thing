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

// A quick rising "whoop" for going through a portal.
export function playPortal(): void {
  const ctx = getAudio();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(300, now);
  osc.frequency.exponentialRampToValueAtTime(900, now + 0.15);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.2);
}

// A cheerful rising three-note "ta-da" for a ball landing in a cup.
export function playCheer(): void {
  const ctx = getAudio();
  if (!ctx) return;

  const now = ctx.currentTime;
  // C, E, G, one after another.
  [523, 659, 784].forEach((pitch, i) => {
    const start = now + i * 0.09;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(pitch, start);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.15, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      start + (i === 2 ? 0.35 : 0.12),
    );
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.4);
  });
}

// A soft low "thump" for a cannon firing.
export function playThump(): void {
  const ctx = getAudio();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(160, now);
  osc.frequency.exponentialRampToValueAtTime(50, now + 0.15);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.25, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.2);
}

// A bright two-note "ding-ding" for collecting a heart.
export function playHeart(): void {
  const ctx = getAudio();
  if (!ctx) return;

  const now = ctx.currentTime;
  // E and A, high up, the second a touch after the first.
  [1319, 1760].forEach((pitch, i) => {
    const start = now + i * 0.07;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(pitch, start);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.12, start + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.3);
  });
}

// A soft falling "whoosh" for the rider getting lost and going back to the
// start.
export function playWhoosh(): void {
  const ctx = getAudio();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(700, now);
  osc.frequency.exponentialRampToValueAtTime(200, now + 0.25);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.3);
}
