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
  // Arrow colors by direction (classic DDR style)
  arrows: {
    left: '#c850c0',    // Magenta/Pink
    down: '#4fc3f7',    // Light Blue
    up: '#66bb6a',      // Green
    right: '#ff7043',   // Orange/Red
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
  receptorY: 0.12,
  /** Arrow size in pixels */
  arrowSize: 80,
  /** Gap between arrow columns */
  arrowGap: 4,
  /** Scroll speed: pixels per millisecond */
  scrollSpeed: 0.5,
  /** How far ahead to render notes (in ms) */
  lookAhead: 2500,
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
    const laneWidth = LAYOUT.arrowSize;

    this.ctx.fillStyle = THEME.bg.secondary;

    for (const dir of DIRECTIONS) {
      const x = this.columnX[dir] - laneWidth / 2;
      this.ctx.fillRect(x, 0, laneWidth, this.height);
    }

    // Draw subtle lane separators
    this.ctx.strokeStyle = THEME.bg.tertiary;
    this.ctx.lineWidth = 1;
    for (const dir of DIRECTIONS) {
      const x = this.columnX[dir] - laneWidth / 2;
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.height);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(x + laneWidth, 0);
      this.ctx.lineTo(x + laneWidth, this.height);
      this.ctx.stroke();
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
   * Draw a single arrow - simple, large, easy to see
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

    // Rotate based on direction (arrow points up by default)
    const rotations: Record<Direction, number> = {
      up: 0,
      down: Math.PI,
      left: -Math.PI / 2,
      right: Math.PI / 2,
    };
    this.ctx.rotate(rotations[direction]);

    this.ctx.globalAlpha = alpha;

    const s = size / 2;

    // Simple large arrow shape - maximum coverage
    const drawArrowShape = () => {
      this.ctx.beginPath();
      // Top point
      this.ctx.moveTo(0, -s * 0.95);
      // Right side of arrow head
      this.ctx.lineTo(s * 0.95, s * 0.1);
      // Inner corner right
      this.ctx.lineTo(s * 0.35, s * 0.1);
      // Right side of stem
      this.ctx.lineTo(s * 0.35, s * 0.95);
      // Bottom of stem
      this.ctx.lineTo(-s * 0.35, s * 0.95);
      // Left side of stem
      this.ctx.lineTo(-s * 0.35, s * 0.1);
      // Inner corner left
      this.ctx.lineTo(-s * 0.95, s * 0.1);
      this.ctx.closePath();
    };

    if (isReceptor) {
      // Receptor: dark with colored outline when active
      if (alpha > 0.5) {
        this.ctx.shadowColor = color;
        this.ctx.shadowBlur = 15;
      }

      this.ctx.fillStyle = '#151518';
      drawArrowShape();
      this.ctx.fill();

      this.ctx.shadowBlur = 0;

      this.ctx.strokeStyle = alpha > 0.5 ? color : '#3a3a45';
      this.ctx.lineWidth = 3;
      this.ctx.lineJoin = 'miter';
      this.ctx.stroke();

    } else {
      // Note arrow

      // Dark outline
      this.ctx.strokeStyle = '#000000';
      this.ctx.lineWidth = 4;
      this.ctx.lineJoin = 'miter';
      drawArrowShape();
      this.ctx.stroke();

      // Main gradient fill
      const gradient = this.ctx.createLinearGradient(0, -s, 0, s);
      gradient.addColorStop(0, this.lightenColor(color, 35));
      gradient.addColorStop(0.5, color);
      gradient.addColorStop(1, this.darkenColor(color, 20));

      this.ctx.fillStyle = gradient;
      drawArrowShape();
      this.ctx.fill();

      // White inner outline
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      this.ctx.lineWidth = 2;
      this.ctx.save();
      this.ctx.scale(0.85, 0.85);
      drawArrowShape();
      this.ctx.restore();
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  /**
   * Lighten a hex color
   */
  private lightenColor(hex: string, percent: number): string {
    const num = parseInt(hex.slice(1), 16);
    const r = Math.min(255, (num >> 16) + Math.round(255 * percent / 100));
    const g = Math.min(255, ((num >> 8) & 0x00FF) + Math.round(255 * percent / 100));
    const b = Math.min(255, (num & 0x0000FF) + Math.round(255 * percent / 100));
    return `rgb(${r}, ${g}, ${b})`;
  }

  /**
   * Darken a hex color
   */
  private darkenColor(hex: string, percent: number): string {
    const num = parseInt(hex.slice(1), 16);
    const r = Math.max(0, (num >> 16) - Math.round(255 * percent / 100));
    const g = Math.max(0, ((num >> 8) & 0x00FF) - Math.round(255 * percent / 100));
    const b = Math.max(0, (num & 0x0000FF) - Math.round(255 * percent / 100));
    return `rgb(${r}, ${g}, ${b})`;
  }

  /**
   * Draw all notes
   * @param cmod - CMod speed in pixels/second (0 = use BPM-based)
   * @param bpm - BPM for BPM-based scrolling (when cmod is 0)
   */
  drawNotes(notes: Note[], currentTime: number, cmod: number = 500, bpm: number = 120): void {
    // Calculate pixels per millisecond
    // CMod 500 = 500 pixels/second = 0.5 pixels/ms
    // When cmod is 0, derive speed from BPM (4 beats visible on screen)
    let pixelsPerMs: number;
    if (cmod === 0) {
      // BPM-based: aim for ~4 beats visible on screen
      const msPerBeat = 60000 / bpm;
      const beatsVisible = 4;
      pixelsPerMs = (this.height - this.receptorY) / (msPerBeat * beatsVisible);
    } else {
      pixelsPerMs = cmod / 1000;
    }

    // Calculate look-ahead time based on screen height
    const lookAheadMs = this.height / pixelsPerMs;

    for (const note of notes) {
      if (note.judged) continue;

      const timeDiff = note.time - currentTime;

      // Skip notes that are too far ahead or behind
      if (timeDiff > lookAheadMs) continue;
      if (timeDiff < -500) continue; // Allow some time for miss animation

      // Calculate Y position
      // Positive timeDiff = note is below receptor (approaching from bottom)
      const y = this.receptorY + timeDiff * pixelsPerMs;

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

    this.ctx.font = '18px -apple-system, sans-serif';
    this.ctx.fillStyle = THEME.text.secondary;
    this.ctx.fillText('ENTER - Resume', this.width / 2, this.height / 2 + 25);
    this.ctx.fillText('ESCAPE - Quit to menu', this.width / 2, this.height / 2 + 55);

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
  renderGameplay(state: GameplayState, currentTime: number, heldDirections: Set<Direction>, cmod: number = 500, health: number = 50): void {
    this.clear();
    this.drawLanes();
    this.drawReceptors(currentTime, heldDirections);
    this.drawNotes(state.activeNotes, currentTime, cmod, state.song.bpm);
    this.drawJudgment(currentTime);
    this.setCombo(state.combo);
    this.drawCombo();
    this.drawScore(state.score);
    this.drawHealthBar(health);
    this.drawCmodIndicator(cmod, state.song.bpm);
    this.drawProgress(currentTime, state.song.charts[0]?.notes.length ?
      state.chart.notes[state.chart.notes.length - 1]?.time ?? 0 : 0);

    if (state.paused) {
      this.drawPauseOverlay();
    }
  }

  /**
   * Draw CMod indicator
   */
  drawCmodIndicator(cmod: number, bpm: number = 120): void {
    this.ctx.save();
    this.ctx.font = 'bold 14px -apple-system, sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    this.ctx.fillStyle = THEME.text.secondary;
    // Show "BPM" when cmod is 0, otherwise show "C{speed}"
    const label = cmod === 0 ? `${bpm} BPM` : `C${cmod}`;
    this.ctx.fillText(label, 20, 35);
    this.ctx.restore();
  }

  /**
   * Draw health bar (vertical bar on the left side)
   */
  drawHealthBar(health: number): void {
    const barWidth = 16;
    const barHeight = this.height * 0.4;
    const x = 15;
    const y = this.height * 0.3;
    const radius = 4;

    // Background
    this.ctx.fillStyle = THEME.bg.tertiary;
    this.roundRect(x, y, barWidth, barHeight, radius);
    this.ctx.fill();

    // Health fill (from bottom up)
    const fillHeight = (health / 100) * barHeight;
    const fillY = y + barHeight - fillHeight;

    // Color based on health level
    let healthColor: string;
    if (health > 60) {
      healthColor = '#00ff88'; // Green
    } else if (health > 30) {
      healthColor = '#ffaa00'; // Orange
    } else {
      healthColor = '#ff4444'; // Red
    }

    // Create gradient for health bar
    const gradient = this.ctx.createLinearGradient(x, fillY, x, fillY + fillHeight);
    gradient.addColorStop(0, this.lightenColor(healthColor, 20));
    gradient.addColorStop(1, healthColor);

    this.ctx.fillStyle = gradient;

    // Draw filled portion with rounded bottom corners
    this.ctx.beginPath();
    if (fillHeight >= radius * 2) {
      // Full rounded corners at bottom
      this.ctx.moveTo(x + radius, fillY);
      this.ctx.lineTo(x + barWidth - radius, fillY);
      this.ctx.lineTo(x + barWidth - radius, fillY + fillHeight - radius);
      this.ctx.quadraticCurveTo(x + barWidth, fillY + fillHeight, x + barWidth - radius, fillY + fillHeight);
      this.ctx.lineTo(x + radius, fillY + fillHeight);
      this.ctx.quadraticCurveTo(x, fillY + fillHeight, x, fillY + fillHeight - radius);
      this.ctx.lineTo(x, fillY);
    } else {
      // Simple rect for small amounts
      this.ctx.rect(x, fillY, barWidth, fillHeight);
    }
    this.ctx.fill();

    // Border
    this.ctx.strokeStyle = THEME.text.muted;
    this.ctx.lineWidth = 1;
    this.roundRect(x, y, barWidth, barHeight, radius);
    this.ctx.stroke();

    // 50% marker line
    const markerY = y + barHeight * 0.5;
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(x, markerY);
    this.ctx.lineTo(x + barWidth, markerY);
    this.ctx.stroke();
  }

  /**
   * Helper to draw rounded rectangle
   */
  private roundRect(x: number, y: number, w: number, h: number, r: number): void {
    this.ctx.beginPath();
    this.ctx.moveTo(x + r, y);
    this.ctx.lineTo(x + w - r, y);
    this.ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    this.ctx.lineTo(x + w, y + h - r);
    this.ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.ctx.lineTo(x + r, y + h);
    this.ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    this.ctx.lineTo(x, y + r);
    this.ctx.quadraticCurveTo(x, y, x + r, y);
    this.ctx.closePath();
  }

  /**
   * Get canvas dimensions
   */
  getDimensions(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }
}
