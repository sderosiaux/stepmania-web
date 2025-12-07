# Implementation Plan

## Overview

This plan follows TDD principles: write tests first, then implement. Each milestone is shippable and testable.

## Tech Stack Setup

- **Language**: TypeScript (strict mode)
- **Build**: Vite
- **Testing**: Vitest (unit/integration), Playwright (e2e)
- **Linting**: ESLint + Prettier

---

## Milestone 1: Project Foundation

### Objective
Set up project structure, build system, and core types.

### Tasks

1. **Initialize project**
   - [ ] `npm init` with TypeScript config
   - [ ] Vite configuration
   - [ ] ESLint + Prettier setup
   - [ ] Vitest configuration
   - [ ] Directory structure

2. **Core types** (`src/types/`)
   - [ ] `Song`, `Chart`, `Note` interfaces
   - [ ] `Judgment` enum and related types
   - [ ] `GameState` interface
   - [ ] `InputEvent` type

3. **Project structure**
   ```
   stepmania/
   ├── docs/                 # Documentation
   ├── songs/                # Song folders
   ├── src/
   │   ├── types/           # TypeScript types
   │   ├── core/            # Core game logic
   │   ├── audio/           # Audio handling
   │   ├── input/           # Input handling
   │   ├── render/          # Canvas rendering
   │   ├── ui/              # Menu/UI screens
   │   ├── parser/          # Step file parser
   │   └── main.ts          # Entry point
   ├── tests/
   │   ├── unit/
   │   ├── integration/
   │   └── e2e/
   ├── public/
   │   └── index.html
   └── package.json
   ```

### Tests to Write First
- Type compilation tests (TypeScript will validate)
- Basic project structure validation

### Deliverable
Project builds successfully, TypeScript compiles, tests run.

---

## Milestone 2: Step File Parser

### Objective
Parse .stp files into Song objects with complete test coverage.

### Tasks

1. **Header parser** (`src/parser/header.ts`)
   - [ ] Parse required headers (#TITLE, #BPM, #MUSIC)
   - [ ] Parse optional headers (#ARTIST, #OFFSET, etc.)
   - [ ] Validate header values

2. **Note parser** (`src/parser/notes.ts`)
   - [ ] Parse note rows (4 characters)
   - [ ] Handle different divisions (4, 8, 16, etc.)
   - [ ] Calculate timing from position
   - [ ] Parse jumps (multiple arrows same row)

3. **Chart parser** (`src/parser/chart.ts`)
   - [ ] Parse difficulty declarations
   - [ ] Parse measures (comma-separated)
   - [ ] Support multiple charts per file

4. **Main parser** (`src/parser/index.ts`)
   - [ ] Combine header + chart parsing
   - [ ] Validation and error messages
   - [ ] Export parsed Song object

### Tests to Write First
```typescript
// tests/unit/parser/header.test.ts
describe('Header Parser', () => {
  test('parses required headers')
  test('parses optional headers')
  test('throws on missing required header')
  test('throws on invalid BPM')
})

// tests/unit/parser/notes.test.ts
describe('Note Parser', () => {
  test('parses quarter notes (4 rows)')
  test('parses eighth notes (8 rows)')
  test('parses sixteenth notes (16 rows)')
  test('calculates correct timing at 120 BPM')
  test('calculates correct timing at 140 BPM')
  test('parses jump (L..R)')
  test('throws on invalid row length')
  test('throws on invalid character')
})

// tests/unit/parser/chart.test.ts
describe('Chart Parser', () => {
  test('parses difficulty declaration')
  test('parses multiple charts')
  test('handles empty measures')
})
```

### Deliverable
Can parse any valid .stp file into a Song object with notes array.

---

## Milestone 3: Timing Engine

### Objective
Implement precise timing calculations and judgment system.

### Tasks

1. **Beat calculator** (`src/core/timing.ts`)
   - [ ] Time to beat conversion
   - [ ] Beat to time conversion
   - [ ] Handle BPM and offset

2. **Judgment calculator** (`src/core/judgment.ts`)
   - [ ] Timing window constants
   - [ ] Calculate judgment from timing difference
   - [ ] Symmetric early/late handling

3. **Score calculator** (`src/core/score.ts`)
   - [ ] Base score calculation
   - [ ] Combo tracking
   - [ ] Multiplier logic
   - [ ] Final grade calculation

### Tests to Write First
```typescript
// tests/unit/core/timing.test.ts
describe('Timing', () => {
  test('beat 0 at 120 BPM = 0ms')
  test('beat 1 at 120 BPM = 500ms')
  test('beat 4 at 120 BPM = 2000ms')
  test('applies offset correctly')
  test('time to beat conversion')
})

// tests/unit/core/judgment.test.ts
describe('Judgment', () => {
  test('0ms diff = marvelous')
  test('22ms diff = marvelous')
  test('23ms diff = perfect')
  test('45ms diff = perfect')
  test('46ms diff = great')
  test('symmetric windows (early = late)')
})

// tests/unit/core/score.test.ts
describe('Score', () => {
  test('all marvelous = max score')
  test('combo multiplier at 10 = 2x')
  test('combo breaks on miss')
  test('grade thresholds correct')
})
```

### Deliverable
Timing and scoring systems fully tested and working.

---

## Milestone 4: Input System

### Objective
Capture keyboard input with high-resolution timestamps.

### Tasks

1. **Input handler** (`src/input/keyboard.ts`)
   - [ ] Keydown event capture
   - [ ] High-resolution timestamp (performance.now())
   - [ ] Buffer inputs
   - [ ] Map keys to directions

2. **Input buffer** (`src/input/buffer.ts`)
   - [ ] Store timestamped inputs
   - [ ] Flush processed inputs
   - [ ] Handle rapid inputs

3. **Input processor** (`src/input/processor.ts`)
   - [ ] Match inputs to notes
   - [ ] Handle note consumption
   - [ ] Prevent double-hits

### Tests to Write First
```typescript
// tests/unit/input/keyboard.test.ts
describe('Keyboard Input', () => {
  test('maps arrow keys to directions')
  test('captures timestamp with input')
  test('buffers multiple inputs')
})

// tests/unit/input/processor.test.ts
describe('Input Processor', () => {
  test('matches input to nearest note')
  test('consumes matched note')
  test('ignores input with no nearby note')
  test('handles jump inputs')
})
```

### Deliverable
Inputs are captured accurately and matched to notes.

---

## Milestone 5: Audio System

### Objective
Implement precise audio playback using Web Audio API.

### Tasks

1. **Audio context manager** (`src/audio/context.ts`)
   - [ ] Create/resume AudioContext
   - [ ] Handle browser autoplay policy
   - [ ] Expose currentTime as master clock

2. **Audio loader** (`src/audio/loader.ts`)
   - [ ] Load MP3 files
   - [ ] Decode to AudioBuffer
   - [ ] Cache loaded audio

3. **Audio player** (`src/audio/player.ts`)
   - [ ] Play loaded buffer
   - [ ] Pause/resume
   - [ ] Get current playback time

### Tests to Write First
```typescript
// tests/unit/audio/context.test.ts
describe('Audio Context', () => {
  test('creates audio context')
  test('provides currentTime')
})

// tests/integration/audio/player.test.ts
describe('Audio Player', () => {
  test('plays audio buffer')
  test('pause stops playback')
  test('resume continues from position')
  test('currentTime advances during playback')
})
```

### Deliverable
Audio plays with accurate time reporting.

---

## Milestone 6: Rendering System

### Objective
Render arrows and receptors on Canvas with smooth animation.

### Tasks

1. **Canvas setup** (`src/render/canvas.ts`)
   - [ ] Create canvas, handle DPI
   - [ ] Clear/render loop
   - [ ] Handle resize

2. **Arrow renderer** (`src/render/arrows.ts`)
   - [ ] Draw arrow sprites (4 directions)
   - [ ] Position based on time and scroll speed
   - [ ] Color code by beat division (optional)

3. **Receptor renderer** (`src/render/receptors.ts`)
   - [ ] Draw receptor targets
   - [ ] Flash on keypress
   - [ ] Judgment explosion effects

4. **HUD renderer** (`src/render/hud.ts`)
   - [ ] Score display
   - [ ] Combo display
   - [ ] Judgment text

### Tests to Write First
```typescript
// tests/unit/render/arrows.test.ts
describe('Arrow Renderer', () => {
  test('calculates correct Y position from time')
  test('arrow at receptor when time matches')
  test('arrow above receptor when time is future')
})

// tests/visual/
// Screenshot tests for visual verification
```

### Deliverable
Arrows scroll smoothly, receptors respond to input.

---

## Milestone 7: Game Loop

### Objective
Implement fixed-timestep game loop with interpolated rendering.

### Tasks

1. **Game loop** (`src/core/loop.ts`)
   - [ ] requestAnimationFrame wrapper
   - [ ] Fixed timestep accumulator
   - [ ] Update/render separation
   - [ ] FPS monitoring

2. **Game state** (`src/core/state.ts`)
   - [ ] Current song/chart
   - [ ] Active notes
   - [ ] Judgments list
   - [ ] Score state

3. **Gameplay update** (`src/core/gameplay.ts`)
   - [ ] Process buffered inputs
   - [ ] Update note positions
   - [ ] Detect misses
   - [ ] Update score

### Tests to Write First
```typescript
// tests/unit/core/loop.test.ts
describe('Game Loop', () => {
  test('calls update at fixed rate')
  test('calls render each frame')
  test('handles slow frames (catch up)')
})

// tests/integration/gameplay.test.ts
describe('Gameplay', () => {
  test('notes move toward receptor over time')
  test('input matches nearest note')
  test('miss triggered when note passes window')
})
```

### Deliverable
Complete gameplay loop running at stable frame rate.

---

## Milestone 8: Screens & UI

### Objective
Implement menu screens and navigation.

### Tasks

1. **Screen manager** (`src/ui/screens.ts`)
   - [ ] Screen state machine
   - [ ] Transitions between screens

2. **Song select screen** (`src/ui/song-select.ts`)
   - [ ] List available songs
   - [ ] Show song metadata
   - [ ] Select and confirm

3. **Gameplay screen** (`src/ui/gameplay.ts`)
   - [ ] Initialize from song select
   - [ ] Pause overlay
   - [ ] Transition to results

4. **Results screen** (`src/ui/results.ts`)
   - [ ] Final score display
   - [ ] Grade display
   - [ ] Judgment breakdown
   - [ ] Return to song select

### Tests to Write First
```typescript
// tests/e2e/flow.test.ts
describe('Game Flow', () => {
  test('navigate from song select to gameplay')
  test('pause during gameplay')
  test('complete song shows results')
  test('return to song select from results')
})
```

### Deliverable
Full game flow from song select through results.

---

## Milestone 9: Calibration & Settings

### Objective
Allow users to calibrate timing and configure options.

### Tasks

1. **Settings storage** (`src/core/settings.ts`)
   - [ ] LocalStorage persistence
   - [ ] Audio offset
   - [ ] Visual offset
   - [ ] Scroll speed

2. **Calibration tool** (`src/ui/calibration.ts`)
   - [ ] Audio sync test
   - [ ] Visual sync test
   - [ ] Calculate recommended offset

3. **Settings screen** (`src/ui/settings.ts`)
   - [ ] Adjust offsets manually
   - [ ] Adjust scroll speed
   - [ ] Reset to defaults

### Tests to Write First
```typescript
// tests/unit/core/settings.test.ts
describe('Settings', () => {
  test('saves to localStorage')
  test('loads from localStorage')
  test('applies offset to timing')
})
```

### Deliverable
Users can calibrate and customize their experience.

---

## Milestone 10: Polish & Ship

### Objective
Final polish, testing, and release preparation.

### Tasks

1. **Visual polish**
   - [ ] Smooth animations
   - [ ] Particle effects (optional)
   - [ ] Theme consistency

2. **Performance optimization**
   - [ ] Profile and optimize hot paths
   - [ ] Verify object pooling works
   - [ ] Test on lower-end hardware

3. **Testing**
   - [ ] Full e2e test suite passing
   - [ ] Performance benchmarks passing
   - [ ] Cross-browser testing

4. **Documentation**
   - [ ] README with setup instructions
   - [ ] How to add songs
   - [ ] Step file format guide

5. **Sample content**
   - [ ] Create 2-3 sample songs
   - [ ] Various difficulties
   - [ ] Test timing accuracy

### Deliverable
Shippable v1.0 with sample content.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Audio sync drift | High | Use AudioContext.currentTime as master clock, test extensively |
| Frame drops affect timing | High | Fixed timestep loop, object pooling, profile early |
| Browser differences | Medium | Test on all target browsers, use standard APIs |
| Input latency varies | Medium | Calibration tool, document expected latency |
| Canvas performance on hi-DPI | Medium | Test on retina displays, optimize draw calls |

---

## Spike Investigations

Before starting implementation, these unknowns should be prototyped:

1. **Audio latency measurement**
   - How accurately can we detect audio output latency?
   - Does Web Audio API provide reliable currentTime?

2. **Input timestamp precision**
   - What's the actual precision of performance.now() in keydown?
   - How much variance across browsers?

3. **Canvas rendering performance**
   - How many arrows can we render at 60fps?
   - Is sprite batching needed?

---

## Definition of Done

Each milestone is complete when:

1. All tests pass
2. Code reviewed
3. No TypeScript errors
4. Performance targets met (where applicable)
5. Documentation updated
