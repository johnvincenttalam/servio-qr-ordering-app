/**
 * Tone-generated kitchen chime via the Web Audio API. No audio file
 * needed; we synthesise a quick descending two-note "doorbell" pattern
 * that's pleasant but cuts through ambient kitchen noise.
 *
 * Browsers block AudioContext from playing until the user has
 * interacted with the page. The kitchen page primes the context the
 * first time the user toggles the sound on (the click is the gesture)
 * so subsequent realtime-driven chimes play immediately.
 */

let cachedContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (cachedContext) return cachedContext;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  try {
    cachedContext = new Ctor();
  } catch {
    return null;
  }
  return cachedContext;
}

/** Call from a click handler to unlock the audio context for later use. */
export function primeChime(): void {
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    void ctx.resume();
  }
}

function playNote(
  ctx: AudioContext,
  freq: number,
  startOffset: number,
  duration: number,
  volume: number
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain).connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.value = freq;

  const start = ctx.currentTime + startOffset;
  const peak = start + 0.02;
  const end = start + duration;

  // exponentialRamp can't reach exactly 0 — use a tiny floor instead.
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, peak);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  osc.start(start);
  osc.stop(end);
}

/**
 * Plays a soft two-note chime. Safe to call any number of times — falls
 * silent if the audio context is suspended or unavailable.
 */
export function playChime(volume = 0.18): void {
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    // Try to resume but don't block — if the browser refuses (no
    // gesture yet) the chime is silently skipped this round.
    void ctx.resume();
    if (ctx.state === "suspended") return;
  }
  // Descending major-third "ding-dong": B5 → G5
  playNote(ctx, 988, 0, 0.18, volume);
  playNote(ctx, 784, 0.13, 0.3, volume);
}
