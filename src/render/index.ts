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


  /** Time when combo last increased */
  private comboIncreaseTime: number = 0;

  /** Hit effects queue */
  private hitEffects: { direction: Direction; grade: JudgmentGrade; time: number }[] = [];

  /** Health orb bubble animation */
  private healthBubbles: { x: number; y: number; size: number; speed: number; opacity: number }[] = [];

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
   * Add a hit effect at a direction
   */
  addHitEffect(direction: Direction, grade: JudgmentGrade, time: number): void {
    this.hitEffects.push({ direction, grade, time });
    // Keep only recent effects
    this.hitEffects = this.hitEffects.filter(e => time - e.time < 500);
  }

  /**
   * Draw hit effects (expanding arrow flash at receptors)
   */
  drawHitEffects(currentTime: number): void {
    const effectDuration = 150; // Quick effect

    for (const effect of this.hitEffects) {
      const elapsed = currentTime - effect.time;
      if (elapsed > effectDuration) continue;

      const x = this.columnX[effect.direction];
      const y = this.receptorY;
      const progress = elapsed / effectDuration;

      // Skip drawing for misses
      if (effect.grade === 'miss') continue;

      this.ctx.save();
      this.ctx.translate(x, y);

      // Rotate based on direction
      const rotations: Record<Direction, number> = {
        up: 0,
        down: Math.PI,
        left: -Math.PI / 2,
        right: Math.PI / 2,
      };
      this.ctx.rotate(rotations[effect.direction]);

      // Get color based on judgment
      const color = THEME.judgment[effect.grade];

      // Expanding arrow effect
      const baseSize = LAYOUT.arrowSize / 2;
      const scale = 1 + progress * 0.5; // Expand to 1.5x
      const alpha = 1 - progress; // Fade out

      this.ctx.globalAlpha = alpha * 0.9;
      this.ctx.scale(scale, scale);

      // Draw arrow shape (outline only)
      const s = baseSize;
      this.ctx.beginPath();
      this.ctx.moveTo(0, -s * 0.95);
      this.ctx.lineTo(s * 0.95, s * 0.1);
      this.ctx.lineTo(s * 0.35, s * 0.1);
      this.ctx.lineTo(s * 0.35, s * 0.95);
      this.ctx.lineTo(-s * 0.35, s * 0.95);
      this.ctx.lineTo(-s * 0.35, s * 0.1);
      this.ctx.lineTo(-s * 0.95, s * 0.1);
      this.ctx.closePath();

      // Glow effect
      this.ctx.shadowColor = color;
      this.ctx.shadowBlur = 20 * alpha;

      // Stroke only (no fill) with judgment color
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 4;
      this.ctx.lineJoin = 'miter';
      this.ctx.stroke();

      this.ctx.restore();
    }

    // Clean up old effects
    this.hitEffects = this.hitEffects.filter(e => currentTime - e.time < effectDuration);
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
  setCombo(combo: number, currentTime: number): void {
    if (combo > this.displayCombo && this.displayCombo > 0) {
      this.comboIncreaseTime = currentTime;
    }
    this.displayCombo = combo;
  }

  /**
   * Draw combo counter with effects
   */
  drawCombo(currentTime: number): void {
    if (this.displayCombo < 4) return; // Only show combo at 4+

    this.ctx.save();

    // Calculate animation based on combo increase
    const timeSinceIncrease = currentTime - this.comboIncreaseTime;
    const animProgress = Math.min(1, timeSinceIncrease / 200);

    // Scale effect on combo increase
    let scale = 1;
    if (timeSinceIncrease < 200) {
      scale = 1 + 0.3 * (1 - animProgress);
    }

    // Position
    const centerX = this.width / 2;
    const centerY = this.height * 0.48;

    this.ctx.translate(centerX, centerY);
    this.ctx.scale(scale, scale);
    this.ctx.translate(-centerX, -centerY);

    // Glow effect for high combos
    if (this.displayCombo >= 20) {
      const glowIntensity = Math.min(1, (this.displayCombo - 20) / 50);
      const pulsePhase = (currentTime / 100) % (Math.PI * 2);
      const pulse = 0.5 + 0.5 * Math.sin(pulsePhase);

      this.ctx.shadowColor = this.getComboColor(this.displayCombo);
      this.ctx.shadowBlur = 20 + pulse * 15 * glowIntensity;
    }

    const text = `${this.displayCombo}`;

    // Font size based on combo
    const baseSize = this.displayCombo >= 100 ? 56 : this.displayCombo >= 50 ? 52 : 48;
    this.ctx.font = `bold ${baseSize}px -apple-system, sans-serif`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    // Multi-layer text effect
    // Outer shadow
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    this.ctx.fillText(text, centerX + 3, centerY + 3);

    // Color based on combo tier
    const color = this.getComboColor(this.displayCombo);

    // Main text with gradient for high combos
    if (this.displayCombo >= 50) {
      const gradient = this.ctx.createLinearGradient(
        centerX - 50, centerY - 30,
        centerX + 50, centerY + 30
      );
      gradient.addColorStop(0, this.lightenColor(color, 20));
      gradient.addColorStop(0.5, color);
      gradient.addColorStop(1, this.lightenColor(color, 20));
      this.ctx.fillStyle = gradient;
    } else {
      this.ctx.fillStyle = color;
    }

    this.ctx.fillText(text, centerX, centerY);

    // Inner highlight
    this.ctx.globalAlpha = 0.4;
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillText(text, centerX, centerY - 2);

    this.ctx.globalAlpha = 1;
    this.ctx.shadowBlur = 0;

    // "COMBO" label with tier color
    this.ctx.font = 'bold 14px -apple-system, sans-serif';
    this.ctx.fillStyle = color;
    this.ctx.globalAlpha = 0.9;
    this.ctx.fillText('COMBO', centerX, centerY + 38);

    // Milestone indicator
    if (this.displayCombo % 50 === 0 && timeSinceIncrease < 500) {
      const milestoneAlpha = 1 - timeSinceIncrease / 500;
      this.ctx.globalAlpha = milestoneAlpha;
      this.ctx.font = 'bold 20px -apple-system, sans-serif';
      this.ctx.fillStyle = '#ffdd00';
      this.ctx.fillText('★ MILESTONE ★', centerX, centerY - 50);
    }

    this.ctx.restore();
  }

  /**
   * Get color based on combo tier
   */
  private getComboColor(combo: number): string {
    if (combo >= 100) return '#ff00ff'; // Magenta - legendary
    if (combo >= 50) return '#ffdd00';  // Gold - amazing
    if (combo >= 30) return '#00ffff';  // Cyan - great
    if (combo >= 20) return '#00ff88';  // Green - good
    if (combo >= 10) return '#88aaff';  // Blue - building
    return '#aaaaaa';                   // Gray - starting
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
   * Draw progress bar (centered, Diablo 3 fluid style)
   */
  drawProgress(current: number, total: number): void {
    if (total <= 0) return;

    const progress = Math.min(1, Math.max(0, current / total));
    const barWidth = LAYOUT.arrowSize * 4 + LAYOUT.arrowGap * 3;
    const barHeight = 10;
    const x = (this.width - barWidth) / 2;
    const y = this.height - 32;
    const radius = 5;

    this.ctx.save();

    // Background with glass effect
    const bgGradient = this.ctx.createLinearGradient(x, y, x, y + barHeight);
    bgGradient.addColorStop(0, '#0a0a12');
    bgGradient.addColorStop(0.5, '#151520');
    bgGradient.addColorStop(1, '#0a0a12');

    this.roundRect(x, y, barWidth, barHeight, radius);
    this.ctx.fillStyle = bgGradient;
    this.ctx.fill();

    // Progress fill with fluid effect
    if (progress > 0) {
      // Clipping for fill
      this.ctx.save();
      this.roundRect(x + 2, y + 2, barWidth - 4, barHeight - 4, radius - 2);
      this.ctx.clip();

      const fillWidth = (barWidth - 4) * progress;
      const waveTime = Date.now() / 300;

      // Liquid gradient (vertical for depth)
      const liquidGradient = this.ctx.createLinearGradient(x, y, x, y + barHeight);
      liquidGradient.addColorStop(0, '#2266cc');
      liquidGradient.addColorStop(0.3, '#4488ff');
      liquidGradient.addColorStop(0.5, '#66aaff');
      liquidGradient.addColorStop(0.7, '#4488ff');
      liquidGradient.addColorStop(1, '#2266cc');

      // Draw liquid with wave on right edge
      this.ctx.beginPath();
      this.ctx.moveTo(x + 2, y + 2);

      // Top edge
      this.ctx.lineTo(x + 2 + fillWidth - 3, y + 2);

      // Right edge with wave
      for (let wy = 0; wy <= barHeight - 4; wy += 2) {
        const waveX = x + 2 + fillWidth + Math.sin(waveTime + wy * 0.5) * 2;
        this.ctx.lineTo(waveX, y + 2 + wy);
      }

      // Bottom and left edges
      this.ctx.lineTo(x + 2, y + barHeight - 2);
      this.ctx.closePath();

      this.ctx.fillStyle = liquidGradient;
      this.ctx.fill();

      // Highlight streak on top
      const streakGradient = this.ctx.createLinearGradient(x, y + 3, x, y + 5);
      streakGradient.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
      streakGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

      this.ctx.fillStyle = streakGradient;
      this.ctx.fillRect(x + 4, y + 3, fillWidth - 6, 2);

      this.ctx.restore();
    }

    // Glass rim (outer border)
    const rimGradient = this.ctx.createLinearGradient(x, y, x + barWidth, y + barHeight);
    rimGradient.addColorStop(0, '#555566');
    rimGradient.addColorStop(0.5, '#333340');
    rimGradient.addColorStop(1, '#444455');

    this.ctx.strokeStyle = rimGradient;
    this.ctx.lineWidth = 2;
    this.roundRect(x, y, barWidth, barHeight, radius);
    this.ctx.stroke();

    // Inner highlight
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    this.ctx.lineWidth = 1;
    this.roundRect(x + 1, y + 1, barWidth - 2, barHeight - 2, radius - 1);
    this.ctx.stroke();

    this.ctx.restore();
  }

  /**
   * Draw difficulty indicator
   */
  drawDifficulty(difficulty: string, level: number): void {
    const totalWidth = LAYOUT.arrowSize * 4 + LAYOUT.arrowGap * 3;
    const x = (this.width - totalWidth) / 2;
    const y = this.height - 55;

    this.ctx.save();

    // Difficulty name with color based on difficulty
    const diffColors: Record<string, string> = {
      'Beginner': '#88ff88',
      'Easy': '#88ff88',
      'Medium': '#ffff44',
      'Hard': '#ff8844',
      'Challenge': '#ff4488',
    };

    // Draw difficulty and level together
    this.ctx.font = 'bold 14px -apple-system, sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle = diffColors[difficulty] ?? THEME.text.primary;

    const text = `${difficulty} Lv.${level}`;
    this.ctx.fillText(text, x, y);

    this.ctx.restore();
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
    this.drawHitEffects(currentTime);
    this.drawNotes(state.activeNotes, currentTime, cmod, state.song.bpm);
    this.drawJudgment(currentTime);
    this.setCombo(state.combo, currentTime);
    this.drawCombo(currentTime);
    this.drawScore(state.score);
    this.drawHealthBar(health);
    this.drawCmodIndicator(cmod, state.song.bpm);
    this.drawDifficulty(state.chart.difficulty, state.chart.level);
    this.drawProgress(currentTime, state.chart.notes[state.chart.notes.length - 1]?.time ?? 0);

    if (state.paused) {
      this.drawPauseOverlay();
    }
  }

  /**
   * Draw CMod indicator (positioned near the game area)
   */
  drawCmodIndicator(cmod: number, bpm: number = 120): void {
    const totalLaneWidth = LAYOUT.arrowSize * 4 + LAYOUT.arrowGap * 3;
    const lanesEndX = (this.width + totalLaneWidth) / 2;

    this.ctx.save();
    this.ctx.font = 'bold 14px -apple-system, sans-serif';
    this.ctx.textAlign = 'right';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle = THEME.text.secondary;
    // Show "BPM" when cmod is 0, otherwise show "C{speed}"
    const label = cmod === 0 ? `${bpm} BPM` : `C${cmod}`;
    this.ctx.fillText(label, lanesEndX, this.height - 55);
    this.ctx.restore();
  }

  /**
   * Draw Diablo 3 style health bar (vertical, with fluid animation)
   */
  drawHealthBar(health: number): void {
    // Position to the left of the lanes
    const totalLaneWidth = LAYOUT.arrowSize * 4 + LAYOUT.arrowGap * 3;
    const lanesX = (this.width - totalLaneWidth) / 2;
    const barWidth = 16;
    const barHeight = this.height * 0.45;
    const x = lanesX - barWidth - 25;
    const y = (this.height - barHeight) / 2;
    const radius = 8;

    this.ctx.save();

    // Outer glow for low health - pulsing red
    if (health < 30) {
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 150);
      this.ctx.shadowColor = '#ff2200';
      this.ctx.shadowBlur = 15 + pulse * 10;
    }

    // Draw bar background (dark glass)
    const bgGradient = this.ctx.createLinearGradient(x, y, x + barWidth, y);
    bgGradient.addColorStop(0, '#0a0a12');
    bgGradient.addColorStop(0.5, '#151520');
    bgGradient.addColorStop(1, '#0a0a12');

    this.roundRect(x, y, barWidth, barHeight, radius);
    this.ctx.fillStyle = bgGradient;
    this.ctx.fill();

    this.ctx.shadowBlur = 0;

    // Draw liquid health fill
    if (health > 0) {
      // Clipping path for bar
      this.ctx.save();
      this.roundRect(x + 2, y + 2, barWidth - 4, barHeight - 4, radius - 2);
      this.ctx.clip();

      // Calculate fill level (from bottom)
      const fillHeight = (health / 100) * (barHeight - 4);
      const fillTop = y + barHeight - 2 - fillHeight;

      // Animated wave effect on top of liquid
      const waveTime = Date.now() / 400;
      const waveHeight = 2 + (health < 30 ? Math.sin(Date.now() / 100) * 1.5 : 0);

      // Health color based on level
      let liquidColor: string;
      let liquidHighlight: string;
      let liquidDark: string;
      if (health > 60) {
        liquidColor = '#cc2222';
        liquidHighlight = '#ff4444';
        liquidDark = '#881111';
      } else if (health > 30) {
        liquidColor = '#cc6600';
        liquidHighlight = '#ff8800';
        liquidDark = '#884400';
      } else {
        liquidColor = '#aa1111';
        liquidHighlight = '#dd2222';
        liquidDark = '#660808';
      }

      // Liquid gradient (horizontal for depth effect)
      const liquidGradient = this.ctx.createLinearGradient(x, y, x + barWidth, y);
      liquidGradient.addColorStop(0, liquidDark);
      liquidGradient.addColorStop(0.3, liquidColor);
      liquidGradient.addColorStop(0.5, liquidHighlight);
      liquidGradient.addColorStop(0.7, liquidColor);
      liquidGradient.addColorStop(1, liquidDark);

      // Draw liquid with wave on top
      this.ctx.beginPath();
      this.ctx.moveTo(x, y + barHeight);

      // Wave effect on top surface
      for (let wx = 0; wx <= barWidth; wx += 2) {
        const waveY = fillTop + Math.sin(waveTime + wx * 0.3) * waveHeight;
        this.ctx.lineTo(x + wx, waveY);
      }

      this.ctx.lineTo(x + barWidth, y + barHeight);
      this.ctx.closePath();
      this.ctx.fillStyle = liquidGradient;
      this.ctx.fill();

      // Bubbles animation
      this.updateHealthBubbles(x + barWidth / 2, y + barHeight - fillHeight / 2, barWidth / 2, fillTop);
      this.drawHealthBubbles(liquidHighlight);

      // Vertical highlight streak (glass effect)
      const streakGradient = this.ctx.createLinearGradient(x + 3, y, x + 6, y);
      streakGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
      streakGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.15)');
      streakGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

      this.ctx.fillStyle = streakGradient;
      this.ctx.fillRect(x + 3, fillTop + 5, 4, fillHeight - 10);

      this.ctx.restore();
    }

    // Glass rim (outer border)
    const rimGradient = this.ctx.createLinearGradient(x, y, x + barWidth, y + barHeight);
    rimGradient.addColorStop(0, '#555566');
    rimGradient.addColorStop(0.3, '#333340');
    rimGradient.addColorStop(0.7, '#222230');
    rimGradient.addColorStop(1, '#444455');

    this.ctx.strokeStyle = rimGradient;
    this.ctx.lineWidth = 3;
    this.roundRect(x, y, barWidth, barHeight, radius);
    this.ctx.stroke();

    // Inner highlight
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    this.ctx.lineWidth = 1;
    this.roundRect(x + 2, y + 2, barWidth - 4, barHeight - 4, radius - 2);
    this.ctx.stroke();

    // Health percentage text below bar
    this.ctx.font = 'bold 12px -apple-system, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';

    if (health < 30) {
      this.ctx.shadowColor = '#ff4444';
      this.ctx.shadowBlur = 8;
    }

    const textColor = health > 60 ? '#ff6666' : health > 30 ? '#ffaa44' : '#ff4444';
    this.ctx.fillStyle = textColor;
    this.ctx.fillText(`${Math.round(health)}%`, x + barWidth / 2, y + barHeight + 8);

    this.ctx.restore();
  }

  /**
   * Update health bar bubbles
   */
  private updateHealthBubbles(centerX: number, centerY: number, halfWidth: number, fillTop: number): void {
    // Add new bubbles occasionally
    if (Math.random() < 0.08 && this.healthBubbles.length < 5) {
      const xOffset = (Math.random() - 0.5) * halfWidth * 1.5;
      this.healthBubbles.push({
        x: centerX + xOffset,
        y: centerY + halfWidth * 2,
        size: 1.5 + Math.random() * 2.5,
        speed: 0.4 + Math.random() * 0.8,
        opacity: 0.3 + Math.random() * 0.4,
      });
    }

    // Update existing bubbles
    for (let i = this.healthBubbles.length - 1; i >= 0; i--) {
      const bubble = this.healthBubbles[i]!;
      bubble.y -= bubble.speed;
      bubble.x += Math.sin(Date.now() / 300 + i) * 0.2;

      // Remove bubbles that reach the top
      if (bubble.y < fillTop - 3) {
        this.healthBubbles.splice(i, 1);
      }
    }
  }

  /**
   * Draw health bar bubbles
   */
  private drawHealthBubbles(color: string): void {
    for (const bubble of this.healthBubbles) {
      this.ctx.globalAlpha = bubble.opacity;
      this.ctx.fillStyle = color;
      this.ctx.beginPath();
      this.ctx.arc(bubble.x, bubble.y, bubble.size, 0, Math.PI * 2);
      this.ctx.fill();

      // Bubble highlight
      this.ctx.globalAlpha = bubble.opacity * 0.5;
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(bubble.x - bubble.size * 0.3, bubble.y - bubble.size * 0.3, bubble.size * 0.3, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.globalAlpha = 1;
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
