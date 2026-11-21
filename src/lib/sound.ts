let ctx: AudioContext | null = null;
let muted = false;

function audio(): AudioContext | null {
  if (muted) return null;
  if (typeof window === "undefined") return null;
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, duration: number, type: OscillatorType, gain: number, delay = 0) {
  const ac = audio();
  if (!ac) return;
  const start = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.015);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(amp);
  amp.connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export const sound = {
  toggle() {
    muted = !muted;
    return muted;
  },
  get muted() {
    return muted;
  },
  bet() {
    tone(420, 0.07, "triangle", 0.035);
    tone(620, 0.055, "sine", 0.02, 0.025);
  },
  win() {
    tone(523, 0.09, "triangle", 0.05);
    tone(659, 0.1, "triangle", 0.05, 0.08);
    tone(784, 0.16, "triangle", 0.05, 0.16);
  },
  result(wager: number, payout: number) {
    if (payout > wager) sound.win();
    else if (payout < wager) sound.lose();
    else tone(392, 0.14, "triangle", 0.035);
  },
  lose() {
    tone(220, 0.14, "triangle", 0.045);
    tone(147, 0.21, "sine", 0.04, 0.07);
  },
  gem() {
    tone(920, 0.06, "sine", 0.04);
  },
  bomb() {
    tone(90, 0.28, "sawtooth", 0.06);
    tone(60, 0.3, "square", 0.03, 0.02);
  },
  pump() {
    tone(300, 0.08, "sine", 0.04);
    tone(420, 0.1, "sine", 0.03, 0.05);
  },
  cash() {
    tone(880, 0.08, "sine", 0.04);
    tone(1320, 0.12, "sine", 0.03, 0.07);
  },
  tick() {
    tone(980, 0.025, "square", 0.012);
  },
  roll() {
    tone(240, 0.07, "triangle", 0.025);
    tone(315, 0.06, "triangle", 0.018, 0.07);
  },
  flip() {
    tone(520, 0.05, "triangle", 0.03);
    tone(740, 0.06, "triangle", 0.025, 0.06);
  },
};
