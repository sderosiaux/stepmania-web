import type { Direction, Note, JudgmentGrade, GameplayState } from '../types';
import { DIRECTIONS } from '../types';

// ============================================================================
// Theme / Design System
// ============================================================================

export const THEME = {
  // Background colors
  bg: {
    primary: '#0a0a0f',
    secondary: '#12121a',
    tertiary: '#1a1a25',
    overlay: 'rgba(0, 0, 0, 0.85)',
  },
  // Text colors
  text: {
    primary: '#ffffff',
    secondary: '#a0a0b0',
    muted: '#606070',
  },
  // Arrow colors by direction
  arrows: {
    left: '#ff3366',    // Pink/Red
    down: '#00ccff',    // Cyan
    up: '#00ff88',      // Green
    right: '#ffaa00',   // Orange
  },
  // Judgment colors
  judgment: {
    marvelous: '#00ffff',
    perfect: '#ffff00',
    great: '#00ff00',
    good: '#0088ff',
    boo: '#ff00ff',
    miss: '#ff0000',
  },
  // UI accents
  accent: {
    primary: '#00d4ff',
    secondary: '#ff00aa',
    success: '#00ff88',
    warning: '#ffaa00',
    error: '#ff4444',
  },
} as const;

// ============================================================================
// Layout Constants
// ============================================================================

export const LAYOUT = {
  /** Distance from top where receptors sit (as fraction of canvas height) */
  receptorY: 0.15,
  /** Arrow size in pixels */
  arrowSize: 64,
  /** Gap between arrow columns */
  arrowGap: 8,
  /** Scroll speed: pixels per millisecond */
  scrollSpeed: 0.6,
  /** How far ahead to render notes (in ms) */
  lookAhead: 2000,
  /** Receptor glow duration on press (ms) */
  receptorGlowDuration: 100,
} as const;

// ============================================================================
// Renderer Class
// ============================================================================

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  /** Canvas dimensions */
  private width: number = 0;
  private height: number = 0;

  /** Device pixel ratio for crisp rendering */
  private dpr: number = 1;

  /** X position for each direction's column */
  private columnX: Record<Direction, number> = {
    left: 0,
    down: 0,
    up: 0,
    right: 0,
  };

  /** Y position of receptors */
  private receptorY: number = 0;

  /** Receptor glow state (timestamp when last pressed) */
  private receptorGlow: Record<Direction, number> = {
    left: 0,
    down: 0,
    up: 0,
    right: 0,
  };

  /** Last judgment to display */
  private lastJudgment: { grade: JudgmentGrade; time: number } | null = null;

  /** Current combo for display */
  private displayCombo: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }
    this.ctx = ctx;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /**
   * Handle canvas resize
   */
  resize(): void {
    this.dpr = window.devicePixelRatio || 1;

    // Get the display size
    const rect = this.canvas.parentElement?.getBoundingClientRect() ?? {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    this.width = rect.width;
    this.height = rect.height;

    // Set canvas size accounting for DPR
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    // Scale context for DPR
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Calculate column positions (centered)
    const totalWidth = LAYOUT.arrowSize * 4 + LAYOUT.arrowGap * 3;
    const startX = (this.width - totalWidth) / 2;

    DIRECTIONS.forEach((dir, i) => {
      this.columnX[dir] = startX + i * (LAYOUT.arrowSize + LAYOUT.arrowGap) + LAYOUT.arrowSize / 2;
    });

    // Calculate receptor Y position
    this.receptorY = this.height * LAYOUT.receptorY;
  }

  /**
   * Clear the canvas
   */
  clear(): void {
    this.ctx.fillStyle = THEME.bg.primary;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  /**
   * Draw the lane backgrounds
   */
  drawLanes(): void {
    const laneWidth = LAYOUT.arrowSize + 4;

    this.ctx.fillStyle = THEME.bg.secondary;

    for (const dir of DIRECTIONS) {
      const x = this.columnX[dir] - laneWidth / 2;
      this.ctx.fillRect(x, 0, laneWidth, this.height);
    }
  }

  /**
   * Draw receptors (target arrows at top)
   */
  drawReceptors(currentTime: number, heldDirections: Set<Direction>): void {
    const size = LAYOUT.arrowSize;

    for (const dir of DIRECTIONS) {
      const x = this.columnX[dir];
      const y = this.receptorY;

      // Check if glowing (recently pressed or held)
      const glowTime = this.receptorGlow[dir];
      const isGlowing =
        heldDirections.has(dir) || currentTime - glowTime < LAYOUT.receptorGlowDuration;

      // Draw receptor
      this.drawArrow(x, y, dir, isGlowing ? 1 : 0.4, true);

      // Draw glow effect
      if (isGlowing) {
        this.ctx.save();
        this.ctx.globalAlpha = 0.3;
        this.ctx.shadowColor = THEME.arrows[dir];
        this.ctx.shadowBlur = 20;
        this.drawArrow(x, y, dir, 1, true);
        this.ctx.restore();
      }
    }
  }

  /**
   * Trigger receptor glow
   */
  triggerReceptorGlow(direction: Direction, time: number): void {
    this.receptorGlow[direction] = time;
  }

  /**
   * Draw a single arrow
   */
  drawArrow(
    x: number,
    y: number,
    direction: Direction,
    alpha: number = 1,
    isReceptor: boolean = false
  ): void {
    const size = LAYOUT.arrowSize;
    const color = THEME.arrows[direction];

    this.ctx.save();
    this.ctx.translate(x, y);

    // Rotate based on direction
    const rotations: Record<Direction, number> = {
      left: Math.PI,
      down: Math.PI / 2,
      up: -Math.PI / 2,
      right: 0,
    };
    this.ctx.rotate(rotations[direction]);

    this.ctx.globalAlpha = alpha;

    // Draw arrow shape (pointing right by default)
    const halfSize = size / 2;
    const innerSize = size * 0.3;

    this.ctx.beginPath();

    if (isReceptor) {
      // Receptor: outline only
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 3;

      // Arrow outline
      this.ctx.moveTo(halfSize, 0);
      this.ctx.lineTo(0, -halfSize);
      this.ctx.lineTo(0, -innerSize);
      this.ctx.lineTo(-halfSize + innerSize, -innerSize);
      this.ctx.lineTo(-halfSize + innerSize, innerSize);
      this.ctx.lineTo(0, innerSize);
      this.ctx.lineTo(0, halfSize);
      this.ctx.closePath();

      this.ctx.stroke();
    } else {
      // Note: filled
      this.ctx.fillStyle = color;

      // Arrow shape
      this.ctx.moveTo(halfSize, 0);
      this.ctx.lineTo(0, -halfSize);
      this.ctx.lineTo(0, -innerSize);
      this.ctx.lineTo(-halfSize + innerSize, -innerSize);
      this.ctx.lineTo(-halfSize + innerSize, innerSize);
      this.ctx.lineTo(0, innerSize);
      this.ctx.lineTo(0, halfSize);
      this.ctx.closePath();

      this.ctx.fill();

      // Add inner highlight
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      this.ctx.beginPath();
      this.ctx.moveTo(halfSize * 0.6, 0);
      this.ctx.lineTo(0, -halfSize * 0.5);
      this.ctx.lineTo(0, halfSize * 0.5);
      this.ctx.closePath();
      this.ctx.fill();
    }

    this.ctx.restore();
  }

  /**
   * Draw all notes
   */
  drawNotes(notes: Note[], currentTime: number, scrollSpeed: number): void {
    // Only draw notes within visible range
    const lookAhead = LAYOUT.lookAhead / scrollSpeed;

    for (const note of notes) {
      if (note.judged) continue;

      const timeDiff = note.time - currentTime;

      // Skip notes that are too far ahead or behind
      if (timeDiff > lookAhead) continue;
      if (timeDiff < -500) continue; // Allow some time for miss animation

      // Calculate Y position
      // Positive timeDiff = note is below receptor (approaching)
      const y = this.receptorY + timeDiff * LAYOUT.scrollSpeed * scrollSpeed;

      // Skip if off screen
      if (y < -LAYOUT.arrowSize || y > this.height + LAYOUT.arrowSize) continue;

      const x = this.columnX[note.direction];

      // Fade out notes that are past the receptor
      const alpha = timeDiff < 0 ? Math.max(0, 1 + timeDiff / 200) : 1;

      this.drawArrow(x, y, note.direction, alpha);
    }
  }

  /**
   * Update and draw judgment display
   */
  setJudgment(grade: JudgmentGrade, time: number): void {
    this.lastJudgment = { grade, time };
  }

  /**
   * Draw judgment text
   */
  drawJudgment(currentTime: number): void {
    if (!this.lastJudgment) return;

    const elapsed = currentTime - this.lastJudgment.time;
    const duration = 500; // Display for 500ms

    if (elapsed > duration) {
      this.lastJudgment = null;
      return;
    }

    const alpha = 1 - elapsed / duration;
    const scale = 1 + elapsed / duration * 0.2;

    const text = this.lastJudgment.grade.toUpperCase();
    const color = THEME.judgment[this.lastJudgment.grade];

    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.font = `bold ${32 * scale}px -apple-system, sans-serif`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    // Draw text shadow
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillText(text, this.width / 2 + 2, this.height * 0.4 + 2);

    // Draw text
    this.ctx.fillStyle = color;
    this.ctx.fillText(text, this.width / 2, this.height * 0.4);

    this.ctx.restore();
  }

  /**
   * Update combo display
   */
  setCombo(combo: number): void {
    this.displayCombo = combo;
  }

  /**
   * Draw combo counter
   */
  drawCombo(): void {
    if (this.displayCombo < 4) return; // Only show combo at 4+

    this.ctx.save();
    this.ctx.font = 'bold 48px -apple-system, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    const text = `${this.displayCombo}`;

    // Draw shadow
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillText(text, this.width / 2 + 2, this.height * 0.5 + 2);

    // Draw text with gradient based on combo
    const hue = (this.displayCombo * 3) % 360;
    this.ctx.fillStyle = `hsl(${hue}, 100%, 60%)`;
    this.ctx.fillText(text, this.width / 2, this.height * 0.5);

    // Draw "COMBO" label
    this.ctx.font = 'bold 16px -apple-system, sans-serif';
    this.ctx.fillStyle = THEME.text.secondary;
    this.ctx.fillText('COMBO', this.width / 2, this.height * 0.5 + 35);

    this.ctx.restore();
  }

  /**
   * Draw score
   */
  drawScore(score: number): void {
    this.ctx.save();
    this.ctx.font = 'bold 24px -apple-system, sans-serif';
    this.ctx.textAlign = 'right';
    this.ctx.textBaseline = 'top';
    this.ctx.fillStyle = THEME.text.primary;

    const text = score.toString().padStart(7, '0');
    this.ctx.fillText(text, this.width - 20, 20);

    this.ctx.restore();
  }

  /**
   * Draw progress bar
   */
  drawProgress(current: number, total: number): void {
    if (total <= 0) return;

    const progress = Math.min(1, current / total);
    const barWidth = 200;
    const barHeight = 4;
    const x = 20;
    const y = 20;

    // Background
    this.ctx.fillStyle = THEME.bg.tertiary;
    this.ctx.fillRect(x, y, barWidth, barHeight);

    // Progress
    this.ctx.fillStyle = THEME.accent.primary;
    this.ctx.fillRect(x, y, barWidth * progress, barHeight);
  }

  /**
   * Draw pause overlay
   */
  drawPauseOverlay(): void {
    // Darken background
    this.ctx.fillStyle = THEME.bg.overlay;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Draw pause text
    this.ctx.save();
    this.ctx.font = 'bold 48px -apple-system, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle = THEME.text.primary;
    this.ctx.fillText('PAUSED', this.width / 2, this.height / 2 - 30);

    this.ctx.font = '20px -apple-system, sans-serif';
    this.ctx.fillStyle = THEME.text.secondary;
    this.ctx.fillText('Press ENTER to resume', this.width / 2, this.height / 2 + 20);
    this.ctx.fillText('Press ESCAPE to quit', this.width / 2, this.height / 2 + 50);

    this.ctx.restore();
  }

  /**
   * Draw countdown
   */
  drawCountdown(count: number): void {
    this.ctx.save();
    this.ctx.font = 'bold 120px -apple-system, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle = THEME.accent.primary;
    this.ctx.fillText(count.toString(), this.width / 2, this.height / 2);
    this.ctx.restore();
  }

  /**
   * Full render frame for gameplay
   */
  renderGameplay(state: GameplayState, currentTime: number, heldDirections: Set<Direction>): void {
    this.clear();
    this.drawLanes();
    this.drawReceptors(currentTime, heldDirections);
    this.drawNotes(state.activeNotes, currentTime, 1); // TODO: use settings scroll speed
    this.drawJudgment(currentTime);
    this.setCombo(state.combo);
    this.drawCombo();
    this.drawScore(state.score);
    this.drawProgress(currentTime, state.song.charts[0]?.notes.length ?
      state.chart.notes[state.chart.notes.length - 1]?.time ?? 0 : 0);

    if (state.paused) {
      this.drawPauseOverlay();
    }
  }

  /**
   * Get canvas dimensions
   */
  getDimensions(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }
}
