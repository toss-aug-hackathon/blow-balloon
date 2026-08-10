import { calculateRms } from './rms';

export class MicrophoneInput {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private samples: Float32Array<ArrayBuffer> | null = null;

  async start(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('이 기기에서는 마이크를 사용할 수 없어요.');
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        throw error;
      }
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }

    const AudioContextClass =
      window.AudioContext ??
      (
        window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;
    if (!AudioContextClass) {
      this.stop();
      throw new Error('이 기기에서는 오디오 분석을 지원하지 않아요.');
    }

    this.context = new AudioContextClass();
    await this.context.resume();
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0;
    this.source = this.context.createMediaStreamSource(this.stream);
    this.source.connect(this.analyser);
    this.samples = new Float32Array(this.analyser.fftSize);
  }

  readRms(): number {
    if (!this.analyser || !this.samples) return 0;
    this.analyser.getFloatTimeDomainData(this.samples);
    return calculateRms(this.samples);
  }

  async resume(): Promise<void> {
    if (this.context?.state === 'suspended') {
      await this.context.resume();
    }
  }

  stop(): void {
    this.source?.disconnect();
    this.analyser?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    void this.context?.close();
    this.stream = null;
    this.context = null;
    this.analyser = null;
    this.source = null;
    this.samples = null;
  }
}
