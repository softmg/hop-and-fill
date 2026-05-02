type GameSfx = "hop" | "paint" | "win" | "loss";
type EnvironmentHold = "hidden" | "ad";

type BrowserAudioContext = AudioContext;

const SFX_CONFIG: Record<GameSfx, { frequency: number; duration: number; type: OscillatorType; volume: number }> = {
  hop: { frequency: 420, duration: 0.06, type: "triangle", volume: 0.045 },
  paint: { frequency: 620, duration: 0.08, type: "sine", volume: 0.04 },
  win: { frequency: 820, duration: 0.2, type: "triangle", volume: 0.05 },
  loss: { frequency: 180, duration: 0.24, type: "sawtooth", volume: 0.035 },
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

  playHop() {
    void this.play("hop");
  }

  playPaint() {
    void this.play("paint");
  }

  playWin() {
    void this.play("win");
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

  private async play(sound: GameSfx) {
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

    const config = SFX_CONFIG[sound];
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = config.type;
    oscillator.frequency.setValueAtTime(config.frequency, now);
    if (sound === "win") {
      oscillator.frequency.linearRampToValueAtTime(config.frequency * 1.18, now + config.duration);
    }
    if (sound === "loss") {
      oscillator.frequency.linearRampToValueAtTime(config.frequency * 0.72, now + config.duration);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(config.volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + config.duration);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + config.duration + 0.02);
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
