# AGENTS.md — blow-balloon

## 1. Project Mission

Build a production-ready **Apps in Toss WebView mini app** named **`blow-balloon`** using **React + TypeScript**.

The app is a playful microphone-controlled balloon game with two modes:

1. **폐활량 테스트**
   - One continuous breath.
   - The user blows into the phone microphone.
   - A single randomly selected 2.5D balloon grows continuously while the breath continues.
   - When the breath is considered ended, stop growth and show the result.

2. **풍선 많이 만들기**
   - 60-second challenge.
   - The user repeatedly blows into the microphone.
   - The current balloon grows while air is detected.
   - Breath pauses are allowed and do not fail the run.
   - When the current balloon reaches its completion size, it becomes a finished helium balloon, floats upward, and joins the balloons packed from the top of the phone screen.
   - Spawn a new random balloon and continue until 60 seconds expires.
   - Show a result screen and provide an in-app result snapshot/image.

The core experience must feel tactile, playful, responsive, and understandable without long instructions.

---

## 2. Non-Negotiable Requirements

- App/repository name: `blow-balloon`
- Platform: Apps in Toss mini app, WebView
- Frontend: React + TypeScript
- Use the current official Apps in Toss Web Framework.
- Microphone input must use the Web API in WebView.
- Target both iPhone/iOS and Android.
- Balloon rendering must have a **2.5D look**, not flat emoji-style graphics.
- Balloon shapes must vary.
- Balloon colors/visual variants must vary.
- Animations must stay smooth on mobile WebView.
- Do not update React state on every animation frame.
- Use `requestAnimationFrame` for continuous game rendering.
- Keep microphone/audio cleanup correct when leaving a game, backgrounding the app, or unmounting.
- Do not introduce large dependencies unless they provide clear value.
- Do not add a backend unless a requirement truly needs one.
- Do not rename the app or change the two requested game modes.

---

## 3. Important Product Accuracy Rule

The UI may use the Korean product name **“폐활량 테스트”** because that is the game concept, but the app must **not claim to medically measure lung capacity or lung volume**.

A phone microphone cannot measure real lung capacity in liters or milliliters.

Therefore:

- Do not display `L`, `mL`, FVC, FEV1, or other medical pulmonary metrics.
- Do not describe the result as a medical measurement.
- Prefer playful metrics such as:
  - 한 번에 분 시간
  - 호흡 지속 시간
  - 평균 바람 세기
  - 최대 바람 세기
  - 풍선 크기
  - 재미용 점수 / 기록
- Add a small unobtrusive note on the result screen such as:
  - `마이크 입력을 이용한 재미용 기록이에요.`

The result should be mainly duration-based so shouting/loudness does not dominate the score.

---

## 4. Official Apps in Toss Integration

For a WebView mini app, use the current official Apps in Toss Web Framework and follow the latest official project configuration.

If the repository is empty:

1. Create a React + TypeScript web project.
2. Install the current official Apps in Toss Web Framework.
3. Initialize Apps in Toss configuration.
4. Keep the generated `granite.config.ts` and related configuration aligned with the current official documentation.

The current official WebView integration uses:

```bash
npm install @apps-in-toss/web-framework
npx ait init
```

Do not blindly pin an old SDK version. Use the version compatible with the current official Apps in Toss documentation and generated project.

Useful official references:

- Apps in Toss WebView integration:
  https://developers-apps-in-toss.toss.im/ai-vibe-coding/tutorials/webview
- Apps in Toss permissions:
  https://developers-apps-in-toss.toss.im/documentation/common/permission
- Apps in Toss Safe Area:
  https://developers-apps-in-toss.toss.im/documentation/common/screen/safe-area
- Apps in Toss screen properties:
  https://developers-apps-in-toss.toss.im/documentation/common/screen/properties

Apps in Toss currently documents microphone framework access as not directly supported for WebView and instructs WebView apps to use the Web API.

---

## 5. Recommended Technical Architecture

Use React for application state and UI, and Canvas for the animated game world.

```text
React
├── home/mode selection
├── permission UI
├── countdown/timer UI
├── game state
├── result UI
└── error/retry UI

HTML Canvas 2D
├── balloon rendering
├── 2.5D shading
├── balloon growth
├── helium floating
├── balloon collisions
├── soft compression
├── top packing
└── particles / small visual effects

Web Audio API
├── microphone stream
├── ambient calibration
├── RMS measurement
├── smoothing
├── dynamic thresholds
└── blow/breath state detection
```

Prefer **Canvas 2D** over rendering every balloon as a React DOM node.

Do not use React `setState()` at 60 FPS for balloon positions, radii, velocities, or deformation.

Keep high-frequency mutable game state inside refs or game-engine classes.

React state should only contain low-frequency UI state such as:

- current screen
- selected mode
- permission state
- countdown
- remaining seconds
- completed balloon count
- final result
- fatal/error state

---

## 6. App Screen Flow

Use a simple state machine. A router is not required unless the project already has one.

Recommended states:

```ts
type AppScreen =
  | 'home'
  | 'mic-permission'
  | 'calibrating'
  | 'countdown'
  | 'lung-test'
  | 'balloon-rush'
  | 'result';
```

### Home screen

The first screen must show exactly two primary choices.

#### Card 1

Title:

```text
폐활량 테스트
```

Description:

```text
한 번의 숨으로 풍선을 얼마나 크게 만들 수 있을까요?
```

#### Card 2

Title:

```text
풍선 많이 만들기
```

Description:

```text
60초 동안 풍선을 최대한 많이 만들어보세요.
```

Both choices should feel like large mobile game cards/buttons.

Do not request microphone permission immediately when the app launches.

Request it only after the user selects a game and intentionally starts.

---

## 7. Microphone and Blow Detection

Use:

```ts
navigator.mediaDevices.getUserMedia({ audio: true })
```

with:

- `AudioContext`
- `MediaStreamAudioSourceNode`
- `AnalyserNode`
- time-domain samples for RMS
- optionally frequency-domain samples for additional noise filtering

Call `AudioContext.resume()` from a user gesture when needed.

### Audio constraints

You may attempt best-effort constraints such as:

```ts
{
  audio: {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  },
}
```

because automatic processing may interfere with raw blow amplitude.

However, these constraints are not guaranteed on every WebView/device.

If constrained acquisition fails, gracefully fall back to:

```ts
{ audio: true }
```

Never make the app unusable because a browser ignores an optional audio constraint.

---

## 8. Ambient Calibration

Microphone sensitivity differs significantly by device.

Do not use one absolute hard-coded volume threshold for every device.

After microphone permission succeeds:

1. Ask the user to stay still for a short calibration.
2. Measure ambient RMS for approximately `700–1000ms`.
3. Derive a baseline noise floor.
4. Derive blow-start and blow-end thresholds relative to the baseline.
5. Use separate start/end thresholds to create hysteresis.

Example configurable constants:

```ts
const CALIBRATION_MS = 800;
const BLOW_START_HOLD_MS = 100;
const BREATH_END_GRACE_MS = 350;
const SMOOTHING_FACTOR = 0.18;
```

These are initial tuning values, not universal physical constants.

Keep all detector tuning constants in one file.

Recommended location:

```text
src/audio/blowConfig.ts
```

---

## 9. Wind Strength

Convert microphone signal into a normalized game value:

```ts
type WindStrength = number; // 0.0 ~ 1.0
```

Recommended pipeline:

```text
microphone
→ RMS
→ subtract/compensate ambient baseline
→ normalize
→ clamp 0..1
→ exponential smoothing
→ windStrength
```

Use smoothing to prevent visual jitter.

Example concept:

```ts
smoothed =
  previous * (1 - SMOOTHING_FACTOR) +
  current * SMOOTHING_FACTOR;
```

Do not make balloon growth react directly to unsmoothed raw samples.

---

## 10. Breath State Machine

Use a detector state machine rather than checking one frame at a time.

Recommended states:

```ts
type BlowState =
  | 'idle'
  | 'candidate'
  | 'blowing'
  | 'ending';
```

Rules:

- A very short spike must not start a breath.
- Require signal over the start threshold for roughly `BLOW_START_HOLD_MS`.
- Once blowing, temporary tiny drops should not immediately end the breath.
- End the breath only when signal remains below the end threshold for approximately `BREATH_END_GRACE_MS`.
- A clap or one-frame spike should be ignored where possible.

Expose a reusable hook/API similar to:

```ts
type BlowDetectorResult = {
  permission: 'idle' | 'requesting' | 'granted' | 'denied' | 'error';
  isCalibrated: boolean;
  isBlowing: boolean;
  windStrength: number;
  currentBreathDurationMs: number;
  requestPermission: () => Promise<void>;
  stop: () => void;
};
```

Recommended hook:

```text
src/hooks/useBlowDetector.ts
```

Keep signal-processing code separate from React where practical so it can be unit-tested.

---

## 11. Mode A — 폐활량 테스트

### Goal

Create the biggest possible single balloon with one uninterrupted breath.

### Entry behavior

Every time the user starts this mode:

- Randomly choose exactly one balloon design.
- The chosen design stays the same for the entire attempt.
- A new attempt may produce a different shape/color.

The balloon begins at a small visible size.

### Start behavior

After:

1. microphone permission
2. calibration
3. optional short countdown

wait for the first valid detected breath.

The attempt timer starts when the breath actually begins.

### Growth behavior

While `isBlowing === true`:

- Grow the balloon every animation frame.
- Growth should depend mostly on **duration**.
- `windStrength` may influence growth speed slightly.
- Loudness alone must not allow a one-second loud noise to beat a long controlled breath.

Example conceptual weighting:

```ts
growthRate =
  BASE_GROWTH_RATE *
  (0.75 + windStrength * 0.25);
```

Do not use this exact formula if a better tuned equivalent is produced during implementation.

### Visual behavior

As the balloon grows:

- smoothly expand
- slightly wobble
- react to wind strength
- increase subtle surface tension
- preserve the selected balloon shape
- maintain 2.5D highlights and shading
- approach screen edges dramatically for very long breaths

Do not immediately pop the balloon when it becomes huge.

Allow it to become comically large and fill/overflow much of the game area while keeping the result readable.

### Attempt end

When the first breath ends according to `BREATH_END_GRACE_MS`:

- freeze growth
- animate the balloon settling/bouncing slightly
- wait briefly
- transition to result

Do not allow a second breath to continue the same 폐활량 attempt.

### Result

Show at least:

- 한 번에 분 시간: `X.X초`
- 평균 바람 세기
- 최대 바람 세기
- 최종 풍선 크기
- 재미용 기록/등급 if useful

Do not show liters.

Provide:

- 다시 도전
- 홈으로
- 결과 이미지 만들기

---

## 12. Mode B — 풍선 많이 만들기

### Goal

Complete as many balloons as possible in 60 seconds.

### Timer

Use a 60-second game timer.

Recommended flow:

```text
permission
→ calibration
→ 3, 2, 1 countdown
→ timer starts at 60.0
→ gameplay
→ timer reaches 0
→ result
```

Do not consume game time during permission or calibration.

### Breath pauses

Breath pauses are allowed.

If the user stops blowing before the current balloon is complete:

- keep the current balloon at its current size
- do not reset it
- do not count it as complete
- when the user blows again, resume growing the same balloon

This mode is explicitly different from 폐활량 테스트.

### Balloon completion

Each active balloon has a target completed size.

When the active balloon reaches the target:

1. mark it `completed`
2. increment completed count
3. give it helium/buoyancy behavior
4. let it float upward
5. include it in the top-packing physics
6. immediately create the next active balloon

The next balloon should be randomly selected.

Avoid using the exact same shape/color combination consecutively when practical.

### End of 60 seconds

At zero:

- stop accepting further growth
- an incomplete active balloon does not increase the completed count
- keep the completed balloons visible
- transition to result after a short finish animation

---

## 13. Helium Balloon Top-Packing Physics

Completed balloons must feel like helium balloons.

They should float toward the top of the phone screen and gradually fill the screen **from top downward**.

The final effect should resemble many soft balloons pressed together against the top and sides of the display.

### Minimum physical properties

Each completed balloon should have mutable properties similar to:

```ts
type BalloonBody = {
  id: string;
  shape: BalloonShape;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radiusX: number;
  radiusY: number;
  targetRadiusX: number;
  targetRadiusY: number;
  rotation: number;
  angularVelocity: number;
  compressionX: number;
  compressionY: number;
  completed: boolean;
  depth: number;
};
```

### Forces

Use lightweight custom physics:

- upward buoyancy
- velocity damping/air drag
- side wall collision
- top boundary collision
- balloon-to-balloon collision
- positional separation
- soft compression
- small spring/wobble response

Do not default to a heavy physics engine.

A lightweight custom circle/ellipse collision approximation is preferred for this app.

### Packing direction

Because helium pulls balloons upward:

- the first balloons should settle against the top
- later balloons should push against previous balloons
- when the top row is crowded, new balloons settle below/among gaps
- the filled area naturally grows downward

Do not simply place balloons in a static grid.

---

## 14. Soft Balloon-to-Balloon Compression

Balloon collisions must look soft rather than like rigid billiard balls.

When two balloons overlap or push against each other:

- separate their centers
- derive a compression amount from overlap depth
- slightly squash each balloon along the collision normal
- slightly expand perpendicular to the collision normal
- smoothly return to its original shape when pressure decreases

Keep deformation subtle.

Suggested limits:

```ts
const MIN_COMPRESSION_SCALE = 0.82;
const MAX_STRETCH_SCALE = 1.10;
```

Tune visually.

Do not let the balloon invert, become paper-thin, or visually explode because of ordinary packing.

If a pop mechanic is added later, it must be a separate intentional rule.

---

## 15. 2.5D Balloon Art Direction

Do not use plain circles with solid colors.

Each balloon should be procedurally rendered with a 2.5D appearance.

Required visual layers:

- base silhouette
- soft gradient or shaded body
- brighter specular highlight
- darker edge / opposite-side shading
- subtle translucent feel where appropriate
- small balloon knot
- optional short string on completed helium balloons
- soft contact/depth shadow where useful

Use Canvas drawing, gradients, clipping, and paths.

Do not require external image assets for the core balloons.

### Balloon shape set

Implement several shapes, for example:

```ts
type BalloonShape =
  | 'round'
  | 'oval'
  | 'pear'
  | 'long'
  | 'heart';
```

At minimum ship with 4 visually distinct shapes.

Collision can use a simplified circle/ellipse proxy even if the visible silhouette is more complex.

### Depth

Give each balloon a small `depth`/z-like value used only for:

- draw order
- scale nuance
- shading nuance
- shadow intensity

This creates a 2.5D layered look without requiring WebGL.

---

## 16. Active Balloon Placement

In 풍선 많이 만들기:

- Keep the balloon currently being inflated in a clear lower or central play area.
- It should not be hidden behind the top balloon pile.
- On completion, transition it from the active inflation position into the helium physics system.
- Spawn the next balloon at the active inflation position with a new random design.

The transition should feel continuous rather than instantly teleporting.

Example:

```text
inflate near lower-middle
→ completion bounce
→ upward acceleration
→ joins top pile
→ next balloon appears
```

---

## 17. Balloon Randomization

Create deterministic reusable helpers.

Recommended files:

```text
src/game/balloons/balloonShapes.ts
src/game/balloons/balloonPalette.ts
src/game/balloons/createBalloon.ts
```

A balloon variant should include:

```ts
type BalloonVariant = {
  shape: BalloonShape;
  paletteId: string;
  seed: number;
};
```

Rules:

- 폐활량 테스트:
  - random once per attempt
- 풍선 많이 만들기:
  - random once per completed/new balloon
- avoid immediate duplicate shape + palette combination
- keep palette pleasant and readable in both bright and dark surrounding UI
- do not create flashing/high-frequency color changes

---

## 18. Canvas Rendering

Recommended component:

```text
src/game/BalloonCanvas.tsx
```

Responsibilities:

- own `<canvas>`
- handle resize
- cap device pixel ratio for performance
- start/stop `requestAnimationFrame`
- update physics
- draw game scene
- expose snapshot/capture capability

Use:

```ts
const dpr = Math.min(window.devicePixelRatio || 1, 2);
```

or another reasonable performance cap.

Use `ResizeObserver` or equivalent responsive sizing.

The game canvas must correctly support:

- small Android phones
- modern iPhones
- safe-area insets
- portrait orientation

Prefer portrait experience.

Avoid document scrolling during active gameplay.

Use `100dvh`-aware layout instead of relying only on legacy `100vh`.

---

## 19. React State and Performance Rules

Do not store per-frame values in React state.

Bad:

```ts
setBalloons(updatedBalloons); // every animation frame
```

Preferred:

```ts
const engineRef = useRef(new BalloonEngine());
```

and render the engine directly into Canvas.

React can receive throttled summary values such as completed count at low frequency or on discrete events.

Target smooth animation on mobile WebView.

Avoid:

- unnecessary DOM nodes per particle
- layout thrashing
- large box-shadow animation
- unbounded particle creation
- creating arrays/objects excessively inside hot loops

Reuse buffers and objects where practical.

---

## 20. Game Engine Suggested Modules

Recommended structure:

```text
src/
├── App.tsx
├── main.tsx
├── audio/
│   ├── blowConfig.ts
│   ├── blowDetector.ts
│   ├── microphone.ts
│   └── rms.ts
├── hooks/
│   └── useBlowDetector.ts
├── components/
│   ├── HomeScreen.tsx
│   ├── MicrophonePermissionScreen.tsx
│   ├── CalibrationScreen.tsx
│   ├── CountdownOverlay.tsx
│   ├── GameHud.tsx
│   └── ResultScreen.tsx
├── game/
│   ├── BalloonCanvas.tsx
│   ├── BalloonEngine.ts
│   ├── types.ts
│   ├── modes/
│   │   ├── LungCapacityMode.ts
│   │   └── BalloonRushMode.ts
│   ├── balloons/
│   │   ├── balloonShapes.ts
│   │   ├── balloonPalette.ts
│   │   ├── createBalloon.ts
│   │   └── drawBalloon.ts
│   └── physics/
│       ├── collision.ts
│       ├── compression.ts
│       ├── buoyancy.ts
│       └── bounds.ts
├── result/
│   ├── createResultSnapshot.ts
│   └── resultTypes.ts
├── styles/
│   └── globals.css
└── utils/
    ├── clamp.ts
    └── random.ts
```

This is a recommended structure, not a reason to create empty abstractions.

Only create modules that are actively used.

---

## 21. Result Snapshot

Both modes should support creating an in-app result image.

Do not depend on remote screenshot services.

Recommended approach:

- create an offscreen canvas
- draw a background
- draw the final game canvas or selected final balloons
- draw result text
- export using `canvas.toBlob()`
- show the generated image inside the result screen

Suggested result image contents:

### 폐활량 테스트

```text
폐활량 테스트
한 번에 분 시간: 8.4초
최종 풍선 크기: 87%
blow-balloon
```

### 풍선 많이 만들기

```text
풍선 많이 만들기
60초 동안 18개 완성!
blow-balloon
```

If the current runtime supports a reliable share API, it may be added behind capability detection.

Do not make sharing a requirement for completing the core app.

---

## 22. UI / UX Style

The app should feel:

- playful
- clean
- light
- tactile
- modern
- mobile-first

Avoid making it look like a diagnostic medical app.

### Home

Use large mode cards with simple balloon illustrations.

### Game

Keep UI minimal so the balloon interaction dominates.

Possible HUD:

#### 폐활량 테스트

- current breath time
- subtle wind indicator

#### 풍선 많이 만들기

- `남은 시간`
- completed count

### Microphone feedback

Show a small live wind indicator so the user understands that blowing is being recognized.

For example:

```text
바람 세기
▰▰▰▰▱
```

or a small animated wind icon.

Do not show raw RMS values to normal users.

---

## 23. Permission and Error UX

Handle these cases explicitly:

- microphone permission denied
- no microphone available
- insecure/unsupported media API
- AudioContext creation failure
- calibration failure
- stream interrupted
- app moved to background

Provide Korean user-facing messages.

Example permission explanation:

```text
풍선을 불기 위해 마이크를 사용해요.
소리는 저장하거나 서버로 전송하지 않아요.
```

Only make the second sentence if the implementation truly performs all audio processing locally and does not transmit/record audio.

The intended architecture is local-only processing.

Do not record audio files.

Do not upload microphone audio.

---

## 24. Lifecycle Cleanup

When leaving a game or the component unmounts:

- cancel `requestAnimationFrame`
- stop every `MediaStreamTrack`
- disconnect Web Audio nodes
- close or suspend `AudioContext` appropriately
- remove event listeners
- stop timers
- reset transient game state

Listen for:

```ts
document.visibilitychange
```

When hidden/backgrounded during gameplay:

- pause gameplay or safely terminate the active attempt
- stop unnecessary processing
- do not let a 60-second timer silently continue in an inconsistent state

Choose one consistent behavior and communicate it to the user.

Recommended behavior for initial implementation:

- pause the 60-second mode while hidden
- terminate a current one-breath 폐활량 attempt if the app becomes hidden
- require the user to retry that attempt

---

## 25. Safe Area and Mobile Layout

Respect Apps in Toss/iOS/Android safe areas.

Important UI such as:

- back button
- countdown
- timer
- result actions

must not overlap notches, dynamic islands, status bars, or home indicators.

Use the current official Apps in Toss safe-area API when appropriate.

Keep the canvas visual world full bleed where possible while positioning actionable UI inside safe areas.

---

## 26. Screen Awake

During an active timed game, use the current Apps in Toss screen-awake capability if supported by the current SDK.

Enable it only while gameplay is active.

Restore the default behavior when leaving gameplay.

Do not keep the screen awake globally for the entire app session.

---

## 27. Sound and Haptics

The microphone input is the main interaction.

Optional lightweight feedback:

- short completion sound when a balloon is finished
- subtle countdown sound
- subtle final-result sound

Do not play constant loud BGM over microphone gameplay because it can interfere with microphone analysis and user experience.

If background music is added later:

- keep it quiet
- pause it during calibration if necessary
- verify it does not contaminate blow detection
- start audio only after user gesture

Haptics may be added only if supported cleanly by the current Apps in Toss APIs.

---

## 28. Mode-Specific Game Data

Use explicit result types.

```ts
type LungTestResult = {
  mode: 'lung-test';
  durationMs: number;
  averageWindStrength: number;
  peakWindStrength: number;
  finalBalloonScale: number;
  balloonVariant: BalloonVariant;
};

type BalloonRushResult = {
  mode: 'balloon-rush';
  durationMs: 60000;
  completedCount: number;
  totalBlowingMs: number;
  balloons: BalloonVariant[];
};
```

Avoid `any`.

---

## 29. Testing Strategy

At minimum, unit-test pure logic for:

- RMS calculation
- normalization/clamping
- blow state transitions
- breath end grace period
- lung-test result calculation
- 60-second completion rules
- balloon completion count
- collision separation
- boundary constraints

If a test framework is not present, use a lightweight setup such as Vitest compatible with the React project.

Do not try to unit-test real microphone hardware.

Separate microphone IO from signal-processing logic so test samples can be injected.

---

## 30. Manual Device Test Matrix

Before considering the task complete, verify behavior in the available Apps in Toss sandbox/test environment and real devices where possible.

Required cases:

### iPhone

- permission accepted
- permission denied
- weak blow
- strong blow
- long breath
- tiny microphone gaps do not split breaths
- background/resume
- safe area

### Android

- same cases as iPhone
- verify device sensitivity is corrected by ambient calibration

### 풍선 많이 만들기

- incomplete balloon survives a breath pause
- completed balloon floats upward
- multiple completed balloons push each other
- top packing fills downward
- no major frame drops with many balloons
- timer ends at 60 seconds
- incomplete final balloon is not counted

### 폐활량 테스트

- random balloon per attempt
- exactly one breath per attempt
- breath end leads to result
- no second breath extends the result
- giant balloon remains visually stable

---

## 31. Acceptance Criteria

The project is complete only when all of these are true:

1. The first screen shows:
   - 폐활량 테스트
   - 풍선 많이 만들기

2. Microphone permission is requested only after a deliberate user action.

3. Real microphone input controls balloon growth.

4. Ambient calibration reduces obvious sensitivity differences.

5. 폐활량 테스트:
   - selects one random balloon per attempt
   - starts on first valid blow
   - balloon grows throughout one continuous breath
   - ends after the breath is truly finished, not on a tiny signal dip
   - displays a result
   - does not claim medical lung volume

6. 풍선 많이 만들기:
   - runs for exactly 60 seconds of active game time
   - breath pauses are allowed
   - unfinished active balloon keeps its size through pauses
   - completed balloon count increases only at target size
   - next balloon receives a new random visual
   - completed balloons float upward
   - balloons collide and softly compress
   - balloons pack from the top downward
   - result shows completed count

7. Balloons visibly have a 2.5D style.

8. At least 4 balloon shapes exist.

9. Canvas animation remains smooth on mobile.

10. Audio tracks and animation loops are correctly cleaned up.

11. The app builds without TypeScript errors.

12. Lint/tests pass if configured.

13. A result snapshot can be generated in-app.

---

## 32. Implementation Order

Build in this order:

### Phase 1 — Project skeleton

- React + TypeScript
- Apps in Toss WebView integration
- home screen
- game state machine
- basic responsive layout

### Phase 2 — Microphone

- permission
- Web Audio pipeline
- RMS
- calibration
- smoothing
- blow state machine
- live debug meter available behind development mode

### Phase 3 — Basic balloon renderer

- Canvas
- one balloon
- multiple shapes
- 2.5D shading
- growth animation

### Phase 4 — 폐활량 테스트

- random attempt balloon
- continuous single-breath growth
- result logic
- retry

### Phase 5 — 풍선 많이 만들기

- 60-second timer
- persistent active balloon through breath pauses
- completion threshold
- next random balloon
- completed count

### Phase 6 — Helium physics

- upward buoyancy
- bounds
- collisions
- top packing
- soft compression
- wobble

### Phase 7 — Result polish

- result screen
- snapshot generation
- replay/home actions

### Phase 8 — Mobile hardening

- safe areas
- visibility lifecycle
- microphone cleanup
- performance tuning
- iOS/Android testing

Do not spend time on decorative polish before microphone detection and both game rules work correctly.

---

## 33. Development Debug Tools

In development mode only, provide a small optional debug overlay containing:

- raw RMS
- baseline RMS
- normalized wind strength
- blow state
- current breath duration
- FPS
- active balloon size
- completed balloon count

Gate it behind a development flag.

Do not show debug data in production.

This is important for tuning iPhone and Android microphone behavior.

---

## 34. Coding Standards

- TypeScript strict mode where practical.
- No `any` unless integration types make it unavoidable and the reason is documented.
- Keep functions small and focused.
- Separate pure math/signal processing from browser APIs.
- Avoid magic numbers scattered across components.
- Put tunable gameplay and audio constants into config modules.
- Prefer readable names over abbreviations.
- Add comments only where behavior is not obvious.
- Do not over-abstract a small feature.
- Do not leave dead code, unused experimental physics, or placeholder screens.
- Do not silently swallow microphone errors.
- User-facing errors must be understandable in Korean.

---

## 35. Commands and Completion Behavior for Codex

When implementing this project:

1. Inspect the existing repository before creating files.
2. Preserve valid existing configuration.
3. Install only required dependencies.
4. Implement the requested experience end-to-end.
5. Run the available:
   - typecheck
   - lint
   - tests
   - production build
6. Fix failures caused by the implementation.
7. Do not stop after creating mock UI.
8. Do not substitute fake slider/mouse input for microphone input in production.
9. A development-only simulated wind control is allowed for desktop testing.
10. Keep real microphone input as the default actual game control.

At completion, report:

- what was implemented
- key files created/changed
- commands used to verify
- any device-specific behavior that still requires real iPhone/Android tuning

Do not ask for minor design decisions that can be safely resolved using the defaults in this file.
