/**
 * Web Audio API based synthesized sound effect engine.
 * Generates pleasing, crisp crystal chimes, joyful bubble pops, and cosmic sparkle tones.
 * 100% offline, zero network requests, zero latency, no external assets needed.
 */

// Pentatonic scale frequencies in Hz (C5, D5, E5, G5, A5, C6) for musical variation on consecutive clicks
const CHIME_FREQUENCIES = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

class SoundEngine {
  private ctx: AudioContext | null = null;
  private soundEnabled: boolean = true;
  private noteIndex: number = 0;
  private lastPlayTime: number = 0;

  constructor() {
    try {
      const saved = localStorage.getItem('streamhub_sound_enabled');
      if (saved !== null) {
        this.soundEnabled = saved === 'true';
      }
    } catch {
      this.soundEnabled = true;
    }
  }

  private initContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public isEnabled(): boolean {
    return this.soundEnabled;
  }

  public toggleSound(): boolean {
    this.soundEnabled = !this.soundEnabled;
    try {
      localStorage.setItem('streamhub_sound_enabled', String(this.soundEnabled));
    } catch {
      // ignore
    }
    // If enabled, play a confirmation chime
    if (this.soundEnabled) {
      this.playSparkleChime();
    }
    return this.soundEnabled;
  }

  public setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
    try {
      localStorage.setItem('streamhub_sound_enabled', String(enabled));
    } catch {
      // ignore
    }
  }

  /**
   * Plays a pleasing, melodious crystal chime / bubble sparkle pop on tap.
   */
  public playSparkleChime(): void {
    if (!this.soundEnabled) return;

    try {
      const ctx = this.initContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // Reset scale progression if user paused clicking for more than 1.2s
      const realNow = Date.now();
      if (realNow - this.lastPlayTime > 1200) {
        this.noteIndex = 0;
      }
      this.lastPlayTime = realNow;

      // Select next note in pentatonic scale and increment
      const baseFreq = CHIME_FREQUENCIES[this.noteIndex % CHIME_FREQUENCIES.length];
      this.noteIndex++;

      // 1. Primary Melody Oscillator (Crystal Sine)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();

      osc1.type = 'sine';
      // Subtle pitch bend upwards for playful tactile feeling
      osc1.frequency.setValueAtTime(baseFreq * 0.96, now);
      osc1.frequency.exponentialRampToValueAtTime(baseFreq, now + 0.04);

      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.linearRampToValueAtTime(0.12, now + 0.012);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.24);

      // 2. Harmonic Shimmer Oscillator (High Shimmer Over-tone)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(baseFreq * 2.0, now);
      osc2.frequency.exponentialRampToValueAtTime(baseFreq * 2.05, now + 0.08);

      gain2.gain.setValueAtTime(0.001, now);
      gain2.gain.linearRampToValueAtTime(0.05, now + 0.015);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc2.start(now);
      osc2.stop(now + 0.18);

      // 3. Ultra-soft tactile pop click (filtered quick transient)
      const oscPop = ctx.createOscillator();
      const gainPop = ctx.createGain();

      oscPop.type = 'sine';
      oscPop.frequency.setValueAtTime(320, now);
      oscPop.frequency.exponentialRampToValueAtTime(70, now + 0.035);

      gainPop.gain.setValueAtTime(0.001, now);
      gainPop.gain.linearRampToValueAtTime(0.08, now + 0.004);
      gainPop.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

      oscPop.connect(gainPop);
      gainPop.connect(ctx.destination);

      oscPop.start(now);
      oscPop.stop(now + 0.045);
    } catch {
      // Audio autoplay policy may block before initial user gesture; ignore safely
    }
  }
}

export const soundService = new SoundEngine();
