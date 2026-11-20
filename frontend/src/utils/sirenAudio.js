// Lightweight Web Audio API synthesizer for disaster alarms and haptic sound effects
class EmergencyAudioEngine {
  constructor() {
    this.audioCtx = null;
    this.oscillator = null;
    this.gainNode = null;
    this.isPlaying = false;
    this.interval = null;
  }

  init() {
    if (!this.audioCtx && typeof window !== "undefined") {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
  }

  startAlarm() {
    this.init();
    if (!this.audioCtx || this.isPlaying) return;
    if (this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }

    this.isPlaying = true;
    this.oscillator = this.audioCtx.createOscillator();
    this.gainNode = this.audioCtx.createGain();

    this.oscillator.type = "sawtooth";
    this.gainNode.gain.setValueAtTime(0.05, this.audioCtx.currentTime);

    this.oscillator.connect(this.gainNode);
    this.gainNode.connect(this.audioCtx.destination);
    this.oscillator.start();

    // Modulate pitch up and down (European fire / campus emergency siren sound)
    let high = true;
    this.interval = setInterval(() => {
      if (!this.oscillator || !this.audioCtx) return;
      const targetFreq = high ? 880 : 640;
      this.oscillator.frequency.setTargetAtTime(
        targetFreq,
        this.audioCtx.currentTime,
        0.12
      );
      high = !high;
    }, 400);
  }

  stopAlarm() {
    if (!this.isPlaying) return;
    if (this.interval) clearInterval(this.interval);
    try {
      if (this.oscillator) {
        this.oscillator.stop();
        this.oscillator.disconnect();
      }
    } catch {
      // audio cleanup fallback
    }
    this.isPlaying = false;
  }

  playBeep(success = true) {
    this.init();
    if (!this.audioCtx) return;
    if (this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(success ? 880 : 300, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.2);
    } catch {
      // ignore
    }
  }
}

export const sirenEngine = new EmergencyAudioEngine();
