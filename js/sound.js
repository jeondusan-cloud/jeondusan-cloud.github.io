/**
 * Web Audio API 기반 마이크로 사운드 엔진
 * 외부 음원 파일 없이 순수 파형 합성으로 아날로그 스위치/플립 사운드를 제공합니다.
 */
class SoundEngine {
  constructor() {
    this.enabled = localStorage.getItem('omni_sound_enabled') !== 'false';
    this.ctx = null;
  }

  initContext() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('omni_sound_enabled', String(this.enabled));
    if (this.enabled) {
      this.playPop();
    }
    return this.enabled;
  }

  // 추출 시 경쾌한 기계식 플립 사운드
  playDraw() {
    if (!this.enabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;

      // 짧은 틱(Click) + 저음 텀프(Thump)
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(68, now + 0.065);

      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.075);

      // 두 번째 미세 하모닉
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(520, now + 0.015);
      osc2.frequency.exponentialRampToValueAtTime(880, now + 0.06);

      gain2.gain.setValueAtTime(0.06, now + 0.015);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);

      osc2.start(now + 0.015);
      osc2.stop(now + 0.07);
    } catch (_) {
      // 오디오 제한 환경 무시
    }
  }

  // 북마크/저장 차임 사운드
  playSave() {
    if (!this.enabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const notes = [587.33, 880]; // D5 -> A5
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.055);

        gain.gain.setValueAtTime(0.09, now + idx * 0.055);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.055 + 0.14);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + idx * 0.055);
        osc.stop(now + idx * 0.055 + 0.15);
      });
    } catch (_) {}
  }

  // 가벼운 UI 전환 사운드
  playPop() {
    if (!this.enabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(660, now + 0.04);

      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch (_) {}
  }
}

window.soundEngine = new SoundEngine();
