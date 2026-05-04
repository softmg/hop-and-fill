import type { TileTheme } from "./Tile";

type GameSfx = "paint" | "win" | "loss";
export type HopSoundTheme = TileTheme;
type EnvironmentHold = "hidden" | "ad";

type BrowserAudioContext = AudioContext;

interface ToneVoice {
  frequency: number;
  endFrequency?: number;
  duration: number;
  type: OscillatorType;
  volume: number;
  delay?: number;
  attack?: number;
}

interface NoiseVoice {
  duration: number;
  volume: number;
  filterType: BiquadFilterType;
  filterFrequency: number;
  filterQ?: number;
  delay?: number;
  attack?: number;
}

interface HopConfig {
  tones: ToneVoice[];
  noise?: NoiseVoice;
}

const SFX_CONFIG: Record<GameSfx, { frequency: number; duration: number; type: OscillatorType; volume: number }> = {
  paint: { frequency: 620, duration: 0.08, type: "sine", volume: 0.04 },
  win: { frequency: 820, duration: 0.2, type: "triangle", volume: 0.05 },
  loss: { frequency: 180, duration: 0.24, type: "sawtooth", volume: 0.035 },
};

const HOP_CONFIG: Record<HopSoundTheme, HopConfig> = {
  default: {
    tones: [
      { frequency: 410, endFrequency: 470, duration: 0.055, type: "triangle", volume: 0.042 },
      { frequency: 620, duration: 0.03, type: "sine", volume: 0.016, delay: 0.008 },
    ],
  },
  slime: {
    tones: [
      { frequency: 235, endFrequency: 165, duration: 0.105, type: "sine", volume: 0.044, attack: 0.012 },
      { frequency: 128, endFrequency: 112, duration: 0.08, type: "triangle", volume: 0.018, delay: 0.012 },
    ],
    noise: { duration: 0.085, volume: 0.016, filterType: "lowpass", filterFrequency: 520, filterQ: 0.7 },
  },
  neon: {
    tones: [
      { frequency: 880, endFrequency: 1320, duration: 0.04, type: "square", volume: 0.028, attack: 0.003 },
      { frequency: 1760, endFrequency: 1320, duration: 0.035, type: "sine", volume: 0.018, delay: 0.014, attack: 0.002 },
    ],
  },
  wood: {
    tones: [
      { frequency: 265, endFrequency: 210, duration: 0.055, type: "triangle", volume: 0.04, attack: 0.002 },
      { frequency: 540, endFrequency: 430, duration: 0.026, type: "square", volume: 0.014, attack: 0.001 },
    ],
    noise: { duration: 0.035, volume: 0.018, filterType: "bandpass", filterFrequency: 900, filterQ: 5, attack: 0.001 },
  },
  paper: {
    tones: [
      { frequency: 330, duration: 0.035, type: "sine", volume: 0.013, delay: 0.01, attack: 0.004 },
    ],
    noise: { duration: 0.08, volume: 0.024, filterType: "highpass", filterFrequency: 2100, filterQ: 1.2, attack: 0.002 },
  },
};

function getAudioContextCtor() {
  if (typeof window === "undefined") return null;
  const audioWindow = window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };
  return audioWindow.AudioContext ?? audioWindow.webkitAudioContext ?? null;
}

export class GameAudio {
  private context: BrowserAudioContext | null = null;
  private muted = false;
  private environmentHolds = new Set<EnvironmentHold>();

  setMuted(muted: boolean) {
    this.muted = muted;
    void this.syncContextState();
  }

  setEnvironmentHold(reason: EnvironmentHold, active: boolean) {
    if (active) {
      this.environmentHolds.add(reason);
    } else {
      this.environmentHolds.delete(reason);
    }
    void this.syncContextState();
  }

  playHop(theme: HopSoundTheme = "default") {
    void this.playHopSound(theme);
  }

  playPaint() {
    void this.play("paint");
  }

  playWin() {
    void this.play("win");
  }

  playPerfectWin() {
    void this.playPerfectWinSound();
  }

  playLoss() {
    void this.play("loss");
  }

  async destroy() {
    if (!this.context) return;
    try {
      await this.context.close();
    } catch {
      // Audio teardown is best-effort only.
    }
    this.context = null;
  }

  private async playHopSound(theme: HopSoundTheme) {
    const context = await this.getRunningContext();
    if (!context) return;

    const config = HOP_CONFIG[theme] ?? HOP_CONFIG.default;
    const now = context.currentTime;
    config.tones.forEach((voice) => this.startTone(context, now, voice));
    if (config.noise) {
      this.startNoise(context, now, config.noise);
    }
  }

  private async playPerfectWinSound() {
    const context = await this.getRunningContext();
    if (!context) return;

    const now = context.currentTime;
    const tones: ToneVoice[] = [
      { frequency: 660, endFrequency: 880, duration: 0.09, type: "triangle", volume: 0.04 },
      { frequency: 990, endFrequency: 1320, duration: 0.1, type: "sine", volume: 0.035, delay: 0.07 },
      { frequency: 1320, endFrequency: 1760, duration: 0.12, type: "triangle", volume: 0.032, delay: 0.15 },
      { frequency: 1760, endFrequency: 2093, duration: 0.2, type: "sine", volume: 0.024, delay: 0.25 },
    ];

    tones.forEach((voice) => this.startTone(context, now, voice));

    this.startNoise(context, now, {
      duration: 0.38,
      volume: 0.018,
      filterType: "highpass",
      filterFrequency: 2400,
      filterQ: 1.4,
      delay: 0.04,
      attack: 0.004,
    });
  }

  private async play(sound: GameSfx) {
    const context = await this.getRunningContext();
    if (!context) return;

    const config = SFX_CONFIG[sound];
    const now = context.currentTime;
    this.startTone(context, now, {
      frequency: config.frequency,
      endFrequency:
        sound === "win"
          ? config.frequency * 1.18
          : sound === "loss"
            ? config.frequency * 0.72
            : undefined,
      duration: config.duration,
      type: config.type,
      volume: config.volume,
    });
  }

  private async getRunningContext() {
    if (this.muted || this.environmentHolds.size > 0) return;
    const context = await this.ensureContext();
    if (!context) return;

    if (context.state !== "running") {
      try {
        await context.resume();
      } catch {
        return;
      }
    }
    if (context.state !== "running") return;
    return context;
  }

  private startTone(context: BrowserAudioContext, baseTime: number, voice: ToneVoice) {
    const start = baseTime + (voice.delay ?? 0);
    const end = start + voice.duration;
    const attackEnd = start + Math.min(voice.attack ?? 0.008, voice.duration * 0.5);
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = voice.type;
    oscillator.frequency.setValueAtTime(voice.frequency, start);
    if (voice.endFrequency !== undefined) {
      oscillator.frequency.linearRampToValueAtTime(voice.endFrequency, end);
    }

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(voice.volume, attackEnd);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(end + 0.02);
  }

  private startNoise(context: BrowserAudioContext, baseTime: number, voice: NoiseVoice) {
    const start = baseTime + (voice.delay ?? 0);
    const end = start + voice.duration;
    const attackEnd = start + Math.min(voice.attack ?? 0.006, voice.duration * 0.5);
    const frameCount = Math.max(1, Math.floor(context.sampleRate * voice.duration));
    const buffer = context.createBuffer(1, frameCount, context.sampleRate);
    const channel = buffer.getChannelData(0);

    for (let index = 0; index < channel.length; index++) {
      const fade = 1 - index / channel.length;
      channel[index] = (Math.random() * 2 - 1) * fade;
    }

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();

    source.buffer = buffer;
    filter.type = voice.filterType;
    filter.frequency.setValueAtTime(voice.filterFrequency, start);
    if (voice.filterQ !== undefined) {
      filter.Q.setValueAtTime(voice.filterQ, start);
    }

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(voice.volume, attackEnd);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    source.start(start);
    source.stop(end + 0.01);
  }

  private async ensureContext() {
    if (this.context) return this.context;
    const AudioContextCtor = getAudioContextCtor();
    if (!AudioContextCtor) return null;

    try {
      this.context = new AudioContextCtor();
    } catch {
      this.context = null;
      return null;
    }

    await this.syncContextState();
    return this.context;
  }

  private async syncContextState() {
    if (!this.context) return;
    const shouldRun = !this.muted && this.environmentHolds.size === 0;
    if (shouldRun) {
      if (this.context.state === "suspended") {
        try {
          await this.context.resume();
        } catch {
          // Resume can fail before the first user gesture. Ignore and retry later.
        }
      }
      return;
    }

    if (this.context.state === "running") {
      try {
        await this.context.suspend();
      } catch {
        // Suspending a context is optional cleanup.
      }
    }
  }
}

export function createGameAudio() {
  return new GameAudio();
}
