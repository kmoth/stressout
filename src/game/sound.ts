import { Howl } from 'howler';

export type ToneName = 'launch' | 'paddle' | 'brick' | 'wall' | 'life' | 'level' | 'split' | 'auto' | 'extraLife';

type ToneOptions = {
  frequency: number;
  duration: number;
  volume: number;
  wave?: 'sine' | 'square' | 'triangle';
};

export class SoundBank {
  private readonly sounds: Record<ToneName, Howl>;

  constructor() {
    this.sounds = {
      launch: this.makeTone({ frequency: 330, duration: 0.12, volume: 0.28 }),
      paddle: this.makeTone({ frequency: 220, duration: 0.08, volume: 0.24, wave: 'square' }),
      brick: this.makeTone({ frequency: 680, duration: 0.09, volume: 0.22 }),
      wall: this.makeTone({ frequency: 460, duration: 0.06, volume: 0.18 }),
      life: this.makeTone({ frequency: 130, duration: 0.22, volume: 0.26, wave: 'triangle' }),
      level: this.makeTone({ frequency: 880, duration: 0.28, volume: 0.24 }),
      split: this.makeTone({ frequency: 1040, duration: 0.36, volume: 0.24, wave: 'triangle' }),
      auto: this.makeTone({ frequency: 540, duration: 0.34, volume: 0.23, wave: 'sine' }),
      extraLife: this.makeTone({ frequency: 760, duration: 0.3, volume: 0.24, wave: 'triangle' })
    };
  }

  play(name: ToneName, volume = 1): void {
    const sound = this.sounds[name];
    const playbackId = sound.play();
    sound.volume(clamp(volume, 0, 1), playbackId);
  }

  private makeTone(options: ToneOptions): Howl {
    return new Howl({
      src: [createWavDataUri(options)],
      html5: false,
      preload: true
    });
  }
}

function createWavDataUri({ frequency, duration, volume, wave = 'sine' }: ToneOptions): string {
  const sampleRate = 44_100;
  const sampleCount = Math.floor(sampleRate * duration);
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const buffer = new ArrayBuffer(44 + sampleCount * bytesPerSample);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + sampleCount * bytesPerSample, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 8 * bytesPerSample, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, sampleCount * bytesPerSample, true);

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate;
    const phase = (time * frequency) % 1;
    const envelope = Math.sin(Math.PI * index / sampleCount);
    const sample = getWaveSample(phase, wave) * envelope * volume;
    view.setInt16(44 + index * bytesPerSample, Math.max(-1, Math.min(1, sample)) * 0x7fff, true);
  }

  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return `data:audio/wav;base64,${btoa(binary)}`;
}

function getWaveSample(phase: number, wave: NonNullable<ToneOptions['wave']>): number {
  if (wave === 'square') {
    return phase < 0.5 ? 1 : -1;
  }

  if (wave === 'triangle') {
    return 1 - 4 * Math.abs(Math.round(phase - 0.25) - (phase - 0.25));
  }

  return Math.sin(phase * Math.PI * 2);
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let index = 0; index < text.length; index += 1) {
    view.setUint8(offset + index, text.charCodeAt(index));
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
