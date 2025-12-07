# Architecture Decision Records

## ADR-001: Use Canvas 2D for Rendering

**Date**: 2024-12-06
**Status**: Accepted

### Context

We need a rendering approach that provides:
- Consistent 60fps performance
- Pixel-perfect positioning for timing accuracy
- Simple implementation

### Options Considered

1. **DOM-based rendering** (CSS transforms)
   - Pros: Simple, familiar, good for UI
   - Cons: Layout thrashing, inconsistent frame timing, GC pressure from style changes

2. **Canvas 2D**
   - Pros: Direct pixel control, predictable performance, no layout/style overhead
   - Cons: Manual everything, no built-in accessibility

3. **WebGL**
   - Pros: GPU acceleration, highest performance ceiling
   - Cons: Complexity overkill for 2D arrows, shader management

### Decision

Use **Canvas 2D** for gameplay rendering.

### Rationale

- DOM rendering introduces unpredictable frame times due to style recalculation and layout
- Canvas 2D gives us exact control over when and what gets drawn
- For a 2D game with simple shapes, Canvas 2D performance is more than sufficient
- WebGL complexity not justified for our visual requirements

### Consequences

- Must implement own rendering pipeline
- Must handle high-DPI displays manually
- UI elements (menus) can still use DOM for simplicity

---

## ADR-002: Web Audio API as Master Clock

**Date**: 2024-12-06
**Status**: Accepted

### Context

Rhythm games require precise timing synchronization. The game clock must be accurate and not drift relative to the audio.

### Options Considered

1. **performance.now() as master clock**
   - Pros: Simple, high resolution
   - Cons: Can drift from audio, no guarantee of sync

2. **AudioContext.currentTime as master clock**
   - Pros: Guaranteed sync with audio output, high precision
   - Cons: Read-only, requires audio context to be running

3. **Hybrid (performance.now + periodic audio sync)**
   - Pros: Works without audio
   - Cons: Complexity, potential for drift between syncs

### Decision

Use **AudioContext.currentTime** as the authoritative game clock during gameplay.

### Rationale

- Audio sync is our #1 priority
- AudioContext.currentTime is the only clock guaranteed to match audio output
- Any visual drift from audio is immediately noticeable in rhythm games
- We always have audio playing during gameplay, so availability isn't an issue

### Consequences

- Game logic must derive timing from audio context
- Cannot run gameplay without audio context
- Pause implementation must handle audio context state
- Need fallback clock for menus (use performance.now())

---

## ADR-003: Fixed Timestep Game Loop

**Date**: 2024-12-06
**Status**: Accepted

### Context

The game loop must update game state consistently regardless of frame rate variations.

### Options Considered

1. **Variable timestep**
   - Pros: Simple, uses delta time
   - Cons: Non-deterministic, floating point errors accumulate

2. **Fixed timestep with interpolation**
   - Pros: Deterministic logic, smooth rendering at any frame rate
   - Cons: More complex, must handle multiple updates per frame

3. **Locked frame rate**
   - Pros: Simple, consistent
   - Cons: Doesn't work across different refresh rates

### Decision

Use **fixed timestep** (e.g., 240Hz logic) **with visual interpolation**.

### Rationale

- Judgment calculations must be deterministic and consistent
- High fixed update rate (240Hz = 4.16ms) provides sub-frame input precision
- Interpolation allows smooth visuals on any display refresh rate
- Industry standard for timing-critical games

### Consequences

- Logic update and render are decoupled
- Must interpolate arrow positions for rendering
- Input timestamps are processed at logic rate, not render rate
- Slight complexity increase but critical for precision

---

## ADR-004: Custom Step File Format (.stp)

**Date**: 2024-12-06
**Status**: Accepted

### Context

We need a step chart format that is:
- Human readable
- Easy for GenAI to generate
- Simple to parse
- Expressive enough for rhythm game patterns

### Options Considered

1. **StepMania .sm format**
   - Pros: Industry standard, lots of existing content
   - Cons: Complex, many features we don't need, harder for AI to generate correctly

2. **JSON format**
   - Pros: Easy to parse, familiar
   - Cons: Verbose, hard to read patterns at a glance

3. **Custom text format (.stp)**
   - Pros: Designed for our needs, human readable, AI-friendly
   - Cons: Custom tooling needed, no existing content

### Decision

Create a **custom .stp text format** optimized for readability and AI generation.

### Rationale

- Primary use case is AI-generated charts, so AI-friendliness is paramount
- Visual pattern recognition (seeing "L..R" vs JSON) helps human verification
- Simpler than .sm means easier to parse correctly
- Can always add an .sm importer later

### Consequences

- Must document format thoroughly (see step-format.md)
- Must build parser from scratch
- Cannot use existing StepMania content directly
- Future: may add .sm import capability

---

## ADR-005: TypeScript with Strict Mode

**Date**: 2024-12-06
**Status**: Accepted

### Context

Choosing the implementation language for a timing-critical application.

### Options Considered

1. **JavaScript**
   - Pros: No build step, simple
   - Cons: No type safety, refactoring risk

2. **TypeScript (strict mode)**
   - Pros: Type safety, better IDE support, catches bugs early
   - Cons: Build step required

3. **Rust/WASM**
   - Pros: Maximum performance, memory safety
   - Cons: Complexity, longer development time, JS interop overhead

### Decision

Use **TypeScript with strict mode** enabled.

### Rationale

- Type safety helps prevent timing-related bugs (wrong units, missing fields)
- Strict mode catches null/undefined issues that could cause frame drops
- Modern TypeScript compiles to efficient JavaScript
- Vite provides fast builds with minimal config
- WASM performance gains don't justify complexity for our use case

### Consequences

- All code must pass strict type checking
- Explicit types for timing values (ms vs seconds)
- Build step required (Vite handles this transparently)

---

## ADR-006: Input Handling with High-Resolution Timestamps

**Date**: 2024-12-06
**Status**: Accepted

### Context

Input timing precision directly affects judgment accuracy. We need the most accurate input timestamps possible.

### Options Considered

1. **Event timestamp (event.timeStamp)**
   - Pros: Built-in, automatically provided
   - Cons: May be coarsened for security, varies by browser

2. **performance.now() in handler**
   - Pros: High resolution, consistent
   - Cons: Slight delay from actual key press to handler execution

3. **Buffered input with timestamps**
   - Pros: Handles rapid inputs, consistent processing
   - Cons: Adds complexity

### Decision

Use **performance.now() immediately in keydown handler**, buffer inputs, process in game loop.

### Rationale

- event.timeStamp is unreliable across browsers and may be rounded
- performance.now() in the handler captures time as close to actual input as possible
- Buffering allows the fixed-timestep loop to process inputs deterministically
- Input handler runs on main thread, so delay is minimal (typically <1ms)

### Consequences

- Input handler is minimal: capture timestamp, add to buffer
- Game loop processes buffered inputs each update
- Must clear input buffer appropriately
- Slightly more complex than direct handling

---

## ADR-007: Object Pooling for Notes

**Date**: 2024-12-06
**Status**: Accepted

### Context

Creating and destroying note objects during gameplay causes garbage collection, which can cause frame drops.

### Options Considered

1. **Create/destroy on demand**
   - Pros: Simple
   - Cons: GC pauses during gameplay

2. **Object pooling**
   - Pros: No GC during gameplay, predictable performance
   - Cons: More complex lifecycle management

3. **Pre-allocate all notes**
   - Pros: Zero allocation during gameplay
   - Cons: Memory usage, complex for variable-length songs

### Decision

Use **object pooling** for note objects and other frequently allocated items.

### Rationale

- Even small GC pauses (5-10ms) are noticeable in a rhythm game
- Pool size can be bounded based on maximum visible notes
- Proven pattern in game development

### Consequences

- Must implement pool manager
- Objects must be resettable
- Pool size tuning required
- Code slightly more complex

---

## ADR-008: Single HTML File Entry Point

**Date**: 2024-12-06
**Status**: Accepted

### Context

How to structure the application for browser delivery.

### Options Considered

1. **Multi-page application**
   - Pros: Natural navigation
   - Cons: Page loads between screens, audio context issues

2. **Single page application with routing**
   - Pros: Smooth transitions
   - Cons: May be overkill

3. **Single HTML file, state-based screens**
   - Pros: Simple, audio context persists, fast
   - Cons: All screens in same context

### Decision

**Single HTML file** with state machine for screens (menu, gameplay, results).

### Rationale

- Audio context must persist across screens for seamless audio
- No need for URL routing for a game
- Simpler build output
- Fast screen transitions

### Consequences

- Single bundle file
- State machine manages current screen
- No back button support (intentional for game)
- Simple deployment (serve static files)

---

## ADR-009: Timing Window Values

**Date**: 2024-12-06
**Status**: Accepted

### Context

Choosing judgment timing windows affects game feel and difficulty.

### Options Considered

1. **Loose windows (DDR style)**
   - Marvelous: ±33ms, Perfect: ±66ms

2. **Standard windows (StepMania/ITG)**
   - Marvelous: ±22.5ms, Perfect: ±45ms, etc.

3. **Strict windows (competitive)**
   - Even tighter than standard

### Decision

Use **StepMania/ITG standard windows**.

### Rationale

- Well-tested and balanced over years
- Familiar to existing rhythm game players
- Marvelous at ±22.5ms rewards precision without being frustrating
- Can add difficulty settings later

### Consequences

- Timing windows as specified in spec.md
- Judgments will feel familiar to StepMania players
- May add configurable windows in future

---

## ADR-010: No Framework (Vanilla TypeScript)

**Date**: 2024-12-06
**Status**: Accepted

### Context

Whether to use a UI framework for the application.

### Options Considered

1. **React**
   - Pros: Familiar, component model
   - Cons: VDOM overhead, reconciliation during gameplay

2. **Vue/Svelte**
   - Pros: Less overhead than React
   - Cons: Still framework overhead

3. **Vanilla TypeScript**
   - Pros: Full control, no abstraction overhead, minimal bundle
   - Cons: More manual DOM management

### Decision

Use **vanilla TypeScript** with no UI framework.

### Rationale

- Any framework adds overhead we don't need
- During gameplay, we're rendering to Canvas anyway
- Menu UI is simple enough to build manually
- Keeps bundle small and performance predictable
- Full control over update timing

### Consequences

- Manual DOM manipulation for menus
- No component abstraction (fine for our scope)
- Smaller bundle size
- Faster initial load
