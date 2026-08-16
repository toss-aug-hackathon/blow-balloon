import { useCallback, useEffect, useRef, useState } from 'react';
import { BLOW_CONFIG } from '../audio/blowConfig';
import {
  BlowDetector,
  type DetectorFrame,
} from '../audio/blowDetector';
import { MicrophoneInput } from '../audio/microphone';
import { clamp } from '../utils/math';

export type MicrophonePermission =
  | 'idle'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'error';

const EMPTY_FRAME: DetectorFrame = {
  rawRms: 0,
  baselineRms: 0,
  windStrength: 0,
  displayWindStrength: 0,
  hasStrongSignal: false,
  isBlowing: false,
  state: 'idle',
  currentBreathDurationMs: 0,
};

export function useBlowDetector(publishUiFrames = true) {
  const microphoneRef = useRef<MicrophoneInput | null>(null);
  const detectorRef = useRef(new BlowDetector());
  const animationRef = useRef<number | null>(null);
  const signalRef = useRef<DetectorFrame>({ ...EMPTY_FRAME });
  const simulatedWindRef = useRef(0);
  const publishUiFramesRef = useRef(publishUiFrames);
  const testModeEnabled = import.meta.env.VITE_BLOW_BALLOON_TEST_MODE === 'true';
  const [simulationEnabled] = useState(
    () =>
      (import.meta.env.DEV &&
        new URLSearchParams(window.location.search).has('simulate')) ||
      testModeEnabled,
  );
  const [permission, setPermission] =
    useState<MicrophonePermission>('idle');
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [frame, setFrame] = useState<DetectorFrame>(EMPTY_FRAME);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    publishUiFramesRef.current = publishUiFrames;
  }, [publishUiFrames]);

  const stop = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    microphoneRef.current?.stop();
    microphoneRef.current = null;
    simulatedWindRef.current = 0;
    detectorRef.current.reset();
    signalRef.current = { ...EMPTY_FRAME };
    setFrame(EMPTY_FRAME);
    setIsCalibrated(false);
    setPermission('idle');
  }, []);

  const requestPermission = useCallback(async (onCalibrated?: () => void) => {
    stop();
    setPermission('requesting');
    setErrorMessage(null);
    try {
      let readSignal: (isCalibrating?: boolean) => { rms: number; breathiness: number };
      if (simulationEnabled) {
        readSignal = (isCalibrating = false) => ({
          rms: 0.005 + (isCalibrating ? 0 : simulatedWindRef.current) * 0.18,
          breathiness: 1,
        });
      } else {
        const microphone = new MicrophoneInput();
        microphoneRef.current = microphone;
        await microphone.start();
        readSignal = () => microphone.readSignal();
      }
      setPermission('granted');
      const calibrationSamples: number[] = [];
      const calibrationStartedAt = performance.now();
      let lastUiUpdate = 0;
      let didCalibrate = false;

      const readFrame = (now: number) => {
        const isCalibrating = now - calibrationStartedAt < BLOW_CONFIG.calibrationMs;
        const { rms, breathiness } = readSignal(isCalibrating);
        if (isCalibrating) {
          calibrationSamples.push(rms);
          signalRef.current = { ...EMPTY_FRAME, rawRms: rms };
        } else {
          if (!didCalibrate) {
            detectorRef.current.setBaseline(calibrationSamples);
            didCalibrate = true;
            setIsCalibrated(true);
            onCalibrated?.();
          }
          signalRef.current = detectorRef.current.update(rms, now, breathiness);
        }

        if (
          publishUiFramesRef.current &&
          now - lastUiUpdate >= BLOW_CONFIG.uiUpdateIntervalMs
        ) {
          setFrame({ ...signalRef.current });
          lastUiUpdate = now;
        }
        animationRef.current = requestAnimationFrame(readFrame);
      };
      animationRef.current = requestAnimationFrame(readFrame);
    } catch (error) {
      microphoneRef.current?.stop();
      microphoneRef.current = null;
      const denied =
        error instanceof DOMException && error.name === 'NotAllowedError';
      setPermission(denied ? 'denied' : 'error');
      setErrorMessage(
        denied
          ? '마이크 권한이 꺼져 있어요. 권한을 허용한 뒤 다시 시도해 주세요.'
          : error instanceof Error
            ? error.message
            : '마이크를 시작하지 못했어요.',
      );
    }
  }, [simulationEnabled, stop]);

  const setSimulatedWind = useCallback((strength: number) => {
    simulatedWindRef.current = clamp(strength, 0, 1);
  }, []);

  const resetBreath = useCallback(() => {
    detectorRef.current.reset();
    signalRef.current = {
      ...signalRef.current,
      isBlowing: false,
      windStrength: 0,
      displayWindStrength: 0,
      state: 'idle',
      currentBreathDurationMs: 0,
    };
  }, []);

  const resume = useCallback(async () => {
    await microphoneRef.current?.resume();
  }, []);

  useEffect(() => stop, [stop]);

  return {
    permission,
    isCalibrated,
    frame,
    signalRef,
    errorMessage,
    requestPermission,
    resetBreath,
    resume,
    stop,
    simulationEnabled,
    testModeEnabled,
    setSimulatedWind,
  };
}
