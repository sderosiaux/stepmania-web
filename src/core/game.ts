import type { Song, Chart, Note, GameplayState, Direction, Settings, ResultsData } from '../types';
import { DEFAULT_SETTINGS, DIRECTIONS } from '../types';
import { audioManager } from '../audio';
import { inputManager } from '../input';
import { Renderer } from '../render';
import { findMatchingNote, judgeNote, isNoteMissed } from './timing';
import { createScoreState, applyJudgment, calculateFinalScore, generateResults, type ScoreState } from './score';

// ============================================================================
// Game Controller
// ============================================================================

export type GameEventType = 'judgment' | 'combo-break' | 'song-end' | 'pause' | 'resume';

export interface GameEvent {
  type: GameEventType;
  data?: unknown;
}

export type GameEventListener = (event: GameEvent) => void;

export class GameController {
  private renderer: Renderer;
  private settings: Settings;

  /** Current gameplay state */
  private state: GameplayState | null = null;

  /** Score tracking */
  private scoreState: ScoreState | null = null;

  /** Animation frame ID */
  private frameId: number | null = null;

  /** Game timing - when we started (performance.now) */
  private gameStartTime: number = 0;

  /** Audio start offset for sync */
  private audioStartOffset: number = 0;

  /** Preparation time before first note (ms) - lets arrows scroll up from bottom */
  private readonly PREP_TIME: number = 3000;

  /** Is game running */
  private running: boolean = false;

  /** Event listeners */
  private listeners: GameEventListener[] = [];

  /** Countdown state */
  private countdown: { active: boolean; count: number; startTime: number } = {
    active: false,
    count: 3,
    startTime: 0,
  };

  /** Whether audio is available for this song */
  private hasAudio: boolean = false;

  constructor(canvas: HTMLCanvasElement, settings: Settings = DEFAULT_SETTINGS) {
    this.renderer = new Renderer(canvas);
    this.settings = settings;
  }

  /**
   * Add event listener
   */
  addEventListener(listener: GameEventListener): void {
    this.listeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: GameEventListener): void {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Emit event to listeners
   */
  private emit(event: GameEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  /**
   * Start a new game with the given song and chart
   */
  async start(song: Song, chart: Chart): Promise<void> {
    // Try to load audio (may fail for demo songs)
    this.hasAudio = false;
    try {
      const audioPath = `songs/${song.id}/${song.musicFile}`;
      await audioManager.load(audioPath);
      this.hasAudio = true;
    } catch (error) {
      console.warn('Audio not available, running in silent mode:', error);
      this.hasAudio = false;
    }

    // Create fresh notes array (clone to avoid mutating original)
    const activeNotes: Note[] = chart.notes.map((n) => ({ ...n, judged: false }));

    // Initialize state
    this.state = {
      song,
      chart,
      activeNotes,
      judgments: [],
      score: 0,
      combo: 0,
      maxCombo: 0,
      startTime: 0,
      paused: false,
      ended: false,
    };

    this.scoreState = createScoreState(chart.notes.length);

    // Start input listening
    inputManager.start();

    // Start countdown
    this.countdown = {
      active: true,
      count: 3,
      startTime: performance.now(),
    };

    this.running = true;
    this.frameId = requestAnimationFrame(this.loop.bind(this));
  }

  /**
   * Main game loop
   */
  private loop(timestamp: number): void {
    if (!this.running || !this.state) return;

    // Handle countdown
    if (this.countdown.active) {
      this.handleCountdown(timestamp);
      this.frameId = requestAnimationFrame(this.loop.bind(this));
      return;
    }

    // Handle pause
    if (this.state.paused) {
      this.renderer.renderGameplay(
        this.state,
        this.getCurrentGameTime(),
        new Set(inputManager.getHeldDirections()),
        this.settings.cmod,
        this.scoreState?.health ?? 50
      );
      this.frameId = requestAnimationFrame(this.loop.bind(this));
      return;
    }

    // Get current game time (synced to audio)
    const currentTime = this.getCurrentGameTime();

    // Process inputs
    this.processInputs(currentTime);

    // Check for missed notes
    this.checkMisses(currentTime);

    // Update score display
    if (this.scoreState) {
      this.state.score = calculateFinalScore(this.scoreState);
    }

    // Check for song end
    this.checkSongEnd(currentTime);

    // Render
    this.renderer.renderGameplay(
      this.state,
      currentTime,
      new Set(inputManager.getHeldDirections()),
      this.settings.cmod,
      this.scoreState?.health ?? 50
    );

    // Continue loop
    if (this.running && !this.state.ended) {
      this.frameId = requestAnimationFrame(this.loop.bind(this));
    }
  }

  /**
   * Handle countdown before song starts
   */
  private handleCountdown(timestamp: number): void {
    const elapsed = timestamp - this.countdown.startTime;
    const countdownDuration = 1000; // 1 second per count

    const currentCount = 3 - Math.floor(elapsed / countdownDuration);

    if (currentCount <= 0) {
      // Countdown finished, start the preparation phase
      this.countdown.active = false;
      this.gameStartTime = performance.now();
      // Add prep time offset so game time starts negative, giving notes time to scroll up
      this.audioStartOffset = this.state!.song.offset + this.settings.audioOffset - this.PREP_TIME;

      // Delay audio start by prep time (only if audio is available)
      if (this.hasAudio) {
        setTimeout(() => {
          if (this.running && !this.state?.paused) {
            audioManager.play(Math.max(0, -this.state!.song.offset / 1000));
          }
        }, this.PREP_TIME);
      }
    } else {
      this.countdown.count = currentCount;
    }

    // Render countdown
    this.renderer.clear();
    this.renderer.drawLanes();
    this.renderer.drawReceptors(timestamp, new Set());
    this.renderer.drawCountdown(this.countdown.count);
  }

  /**
   * Get current game time in milliseconds
   */
  private getCurrentGameTime(): number {
    if (this.countdown.active) return -this.PREP_TIME - 1000;

    // Use audio time as master clock when playing (if audio is available)
    if (this.hasAudio && audioManager.isPlaying) {
      return audioManager.getCurrentTimeMs() + this.audioStartOffset;
    }

    // Fallback to performance timing (always used in silent mode)
    return performance.now() - this.gameStartTime + this.audioStartOffset;
  }

  /**
   * Process buffered inputs
   */
  private processInputs(currentTime: number): void {
    if (!this.state || !this.scoreState) return;

    const inputs = inputManager.flush();

    for (const input of inputs) {
      if (!input.pressed) continue; // Only process key presses

      // Convert input timestamp to game time
      const inputGameTime = input.timestamp - this.gameStartTime + this.audioStartOffset;

      // Find matching note
      const note = findMatchingNote(this.state.activeNotes, input.direction, inputGameTime);

      if (note) {
        // Judge the note
        const judgment = judgeNote(note, inputGameTime);
        note.judged = true;
        note.judgment = judgment;

        this.state.judgments.push(judgment);

        // Update score
        const prevCombo = this.scoreState.combo;
        this.scoreState = applyJudgment(this.scoreState, judgment);

        // Update state
        this.state.combo = this.scoreState.combo;
        this.state.maxCombo = this.scoreState.maxCombo;

        // Trigger visual feedback
        this.renderer.triggerReceptorGlow(input.direction, currentTime);
        this.renderer.setJudgment(judgment.grade, currentTime);
        this.renderer.addHitEffect(input.direction, judgment.grade, currentTime);

        // Emit events
        this.emit({ type: 'judgment', data: judgment });

        if (prevCombo > 0 && this.scoreState.combo === 0) {
          this.emit({ type: 'combo-break' });
        }
      } else {
        // No matching note - still show receptor press
        this.renderer.triggerReceptorGlow(input.direction, currentTime);
      }
    }
  }

  /**
   * Check for missed notes
   */
  private checkMisses(currentTime: number): void {
    if (!this.state || !this.scoreState) return;

    for (const note of this.state.activeNotes) {
      if (note.judged) continue;

      if (isNoteMissed(note.time, currentTime)) {
        note.judged = true;

        const judgment = {
          noteId: note.id,
          timingDiff: currentTime - note.time,
          grade: 'miss' as const,
          time: currentTime,
        };

        note.judgment = judgment;
        this.state.judgments.push(judgment);

        // Update score
        const prevCombo = this.scoreState.combo;
        this.scoreState = applyJudgment(this.scoreState, judgment);

        this.state.combo = this.scoreState.combo;
        this.state.maxCombo = this.scoreState.maxCombo;

        // Visual feedback
        this.renderer.setJudgment('miss', currentTime);

        // Emit events
        this.emit({ type: 'judgment', data: judgment });

        if (prevCombo > 0) {
          this.emit({ type: 'combo-break' });
        }
      }
    }
  }

  /**
   * Check if song has ended
   */
  private checkSongEnd(currentTime: number): void {
    if (!this.state) return;

    // Check if all notes are judged
    const allJudged = this.state.activeNotes.every((n) => n.judged);

    // Check if we've passed the last note by a margin
    const lastNote = this.state.activeNotes[this.state.activeNotes.length - 1];
    const pastLastNote = lastNote ? currentTime > lastNote.time + 2000 : true;

    // Check if audio has ended (only if we have audio)
    let pastAudioEnd = false;
    if (this.hasAudio) {
      const audioDuration = audioManager.getDurationMs();
      pastAudioEnd = audioDuration > 0 && currentTime > audioDuration + 1000;
    }

    if ((allJudged && pastLastNote) || pastAudioEnd) {
      this.endSong();
    }
  }

  /**
   * End the current song
   */
  private endSong(): void {
    if (!this.state || this.state.ended) return;

    this.state.ended = true;
    if (this.hasAudio) {
      audioManager.stop();
    }
    inputManager.stop();
    this.running = false;

    this.emit({ type: 'song-end', data: this.getResults() });
  }

  /**
   * Pause the game
   */
  pause(): void {
    if (!this.state || this.state.paused || this.state.ended || this.countdown.active) return;

    this.state.paused = true;
    if (this.hasAudio) {
      audioManager.pause();
    }
    inputManager.clear();

    this.emit({ type: 'pause' });
  }

  /**
   * Resume the game
   */
  resume(): void {
    if (!this.state || !this.state.paused) return;

    // Start a short countdown before resuming
    this.countdown = {
      active: true,
      count: 3,
      startTime: performance.now(),
    };

    this.state.paused = false;

    // Audio will be resumed after countdown
  }

  /**
   * Toggle pause state
   */
  togglePause(): void {
    if (!this.state) return;

    if (this.state.paused) {
      this.resume();
    } else {
      this.pause();
    }
  }

  /**
   * Stop the game completely
   */
  stop(): void {
    this.running = false;

    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }

    if (this.hasAudio) {
      audioManager.stop();
    }
    inputManager.stop();

    this.state = null;
    this.scoreState = null;
  }

  /**
   * Get current results
   */
  getResults(): ResultsData | null {
    if (!this.state || !this.scoreState) return null;

    return generateResults(this.scoreState, this.state.song, this.state.chart);
  }

  /**
   * Check if game is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Check if game is paused
   */
  isPaused(): boolean {
    return this.state?.paused ?? false;
  }

  /**
   * Update settings
   */
  setSettings(settings: Partial<Settings>): void {
    this.settings = { ...this.settings, ...settings };
  }
}
