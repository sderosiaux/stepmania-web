import type { Direction, InputEvent } from '../types';
import { KEY_TO_DIRECTION, DIRECTIONS } from '../types';

// ============================================================================
// Input Manager
// ============================================================================

export class InputManager {
  /** Buffer of input events to be processed */
  private inputBuffer: InputEvent[] = [];

  /** Currently held keys */
  private heldKeys: Set<Direction> = new Set();

  /** Whether input is enabled */
  private enabled: boolean = false;

  /** Bound event handlers (for cleanup) */
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;

  constructor() {
    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.boundKeyUp = this.handleKeyUp.bind(this);
  }

  /**
   * Start listening for input events
   */
  start(): void {
    if (this.enabled) return;

    this.enabled = true;
    this.inputBuffer = [];
    this.heldKeys.clear();

    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);
  }

  /**
   * Stop listening for input events
   */
  stop(): void {
    if (!this.enabled) return;

    this.enabled = false;
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);

    this.inputBuffer = [];
    this.heldKeys.clear();
  }

  /**
   * Handle keydown events
   */
  private handleKeyDown(e: KeyboardEvent): void {
    // Ignore repeated keys (key held down)
    if (e.repeat) return;

    const direction = KEY_TO_DIRECTION[e.code];
    if (!direction) return;

    // Prevent default browser behavior for arrow keys
    e.preventDefault();

    // Use high-resolution timestamp
    const timestamp = performance.now();

    // Track held state
    this.heldKeys.add(direction);

    // Buffer the input
    this.inputBuffer.push({
      direction,
      timestamp,
      pressed: true,
    });
  }

  /**
   * Handle keyup events
   */
  private handleKeyUp(e: KeyboardEvent): void {
    const direction = KEY_TO_DIRECTION[e.code];
    if (!direction) return;

    e.preventDefault();

    const timestamp = performance.now();

    // Update held state
    this.heldKeys.delete(direction);

    // Buffer the release (useful for hold notes in future)
    this.inputBuffer.push({
      direction,
      timestamp,
      pressed: false,
    });
  }

  /**
   * Get and clear all buffered inputs
   */
  flush(): InputEvent[] {
    const events = this.inputBuffer;
    this.inputBuffer = [];
    return events;
  }

  /**
   * Check if a direction is currently held
   */
  isHeld(direction: Direction): boolean {
    return this.heldKeys.has(direction);
  }

  /**
   * Get all currently held directions
   */
  getHeldDirections(): Direction[] {
    return DIRECTIONS.filter((d) => this.heldKeys.has(d));
  }

  /**
   * Clear all state (for pause/resume)
   */
  clear(): void {
    this.inputBuffer = [];
    this.heldKeys.clear();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const inputManager = new InputManager();
