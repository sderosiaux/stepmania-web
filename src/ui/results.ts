import type { ResultsData } from '../types';
import { THEME } from '../render';

// ============================================================================
// Results Screen
// ============================================================================

export interface ResultsCallbacks {
  onContinue: () => void;
  onRetry?: () => void;
}

export class ResultsScreen {
  private container: HTMLElement;
  private callbacks: ResultsCallbacks;
  private boundKeyHandler: (e: KeyboardEvent) => void;

  constructor(container: HTMLElement, callbacks: ResultsCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.boundKeyHandler = this.handleKey.bind(this);
  }

  /**
   * Show the results screen
   */
  show(results: ResultsData): void {
    this.render(results);
    window.addEventListener('keydown', this.boundKeyHandler);
  }

  /**
   * Hide the screen
   */
  hide(): void {
    window.removeEventListener('keydown', this.boundKeyHandler);
    this.container.innerHTML = '';
  }

  /**
   * Handle keyboard input
   */
  private handleKey(e: KeyboardEvent): void {
    switch (e.code) {
      case 'Enter':
        e.preventDefault();
        this.callbacks.onContinue();
        break;

      case 'KeyR':
        e.preventDefault();
        this.callbacks.onRetry?.();
        break;

      case 'Escape':
        e.preventDefault();
        this.callbacks.onContinue();
        break;
    }
  }

  /**
   * Get gradient colors for grade-based animated background (intense)
   */
  private getGradeGradientColors(grade: string, failed: boolean): string[] {
    if (failed) {
      return ['#2a0808', '#450e0e', '#2a0808'];
    }
    switch (grade) {
      case 'AAAA':
        return ['#0a2828', '#124040', '#0a2828', '#0e3535']; // Intense cyan/teal
      case 'AAA':
        return ['#0a2525', '#103838', '#0a2525']; // Cyan tones
      case 'AA':
        return ['#282808', '#404010', '#282808']; // Yellow tones
      case 'A':
        return ['#0a280a', '#104010', '#0a280a']; // Green tones
      case 'B':
        return ['#0a0a28', '#101040', '#0a0a28']; // Blue tones
      case 'C':
        return ['#28200a', '#403510', '#28200a']; // Orange tones
      case 'D':
        return ['#280a0a', '#401010', '#280a0a']; // Red tones
      default:
        return ['#0d0d0d', '#1a1a1a', '#0d0d0d'];
    }
  }

  /**
   * Render the results
   */
  private render(results: ResultsData): void {
    const gradeColor = results.failed ? '#ff2222' : this.getGradeColor(results.grade);
    const gradeText = results.failed ? 'FAILED' : results.grade;
    const gradientColors = this.getGradeGradientColors(results.grade, results.failed ?? false);
    const gradientCSS = gradientColors.join(', ');

    this.container.innerHTML = `
      <div class="results-screen ${results.failed ? 'failed' : ''}" data-grade="${results.grade}">
        <div class="results-bg"></div>
        <div class="results-content">
          <div class="song-info">
            <h2>${escapeHtml(results.song.title)}</h2>
            <p class="artist">${escapeHtml(results.song.artist)}</p>
            <p class="chart-info">${results.chart.difficulty} (Lv. ${results.chart.level})</p>
          </div>

          <div class="grade-display" style="color: ${gradeColor}">
            ${gradeText}
          </div>

          <div class="score-display">
            <div class="score-value">${results.score.toString().padStart(7, '0')}</div>
            <div class="percentage">${results.percentage.toFixed(2)}%</div>
          </div>

          <div class="stats-grid">
            <div class="stat-row">
              <span class="stat-label" style="color: ${THEME.judgment.marvelous}">MARVELOUS</span>
              <span class="stat-value">${results.judgmentCounts.marvelous}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label" style="color: ${THEME.judgment.perfect}">PERFECT</span>
              <span class="stat-value">${results.judgmentCounts.perfect}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label" style="color: ${THEME.judgment.great}">GREAT</span>
              <span class="stat-value">${results.judgmentCounts.great}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label" style="color: ${THEME.judgment.good}">GOOD</span>
              <span class="stat-value">${results.judgmentCounts.good}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label" style="color: ${THEME.judgment.boo}">BOO</span>
              <span class="stat-value">${results.judgmentCounts.boo}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label" style="color: ${THEME.judgment.miss}">MISS</span>
              <span class="stat-value">${results.judgmentCounts.miss}</span>
            </div>
          </div>

          <div class="combo-display">
            ${results.isFullCombo ? '<div class="full-combo">★ FULL COMBO ★</div>' : ''}
            MAX COMBO: <span class="combo-value">${results.maxCombo}</span>
          </div>

          <div class="controls-hint">
            <span><kbd>ENTER</kbd> Continue</span>
            <span><kbd>R</kbd> Retry</span>
          </div>
        </div>
      </div>
      <style>
        .results-screen {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: ${THEME.bg.primary};
          color: ${THEME.text.primary};
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          animation: fadeIn 0.3s ease;
          overflow: hidden;
        }

        .results-bg {
          position: absolute;
          inset: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(ellipse at center, ${gradientCSS});
          animation: bgRotate 12s linear infinite, bgPulse 3s ease-in-out infinite;
          opacity: 1;
          z-index: 0;
        }

        .results-screen[data-grade="AAAA"] .results-bg {
          background:
            radial-gradient(ellipse at 30% 30%, rgba(0, 255, 255, 0.35) 0%, transparent 40%),
            radial-gradient(ellipse at 70% 70%, rgba(0, 200, 200, 0.25) 0%, transparent 40%),
            radial-gradient(ellipse at 50% 50%, rgba(0, 180, 180, 0.2) 0%, transparent 60%),
            radial-gradient(ellipse at center, #0a2828, #124040, #0a2828);
          animation: bgRotate 8s linear infinite, bgPulse 2s ease-in-out infinite, shimmer 1.5s ease-in-out infinite;
        }

        .results-screen[data-grade="AAA"] .results-bg {
          background:
            radial-gradient(ellipse at 40% 40%, rgba(0, 220, 220, 0.25) 0%, transparent 45%),
            radial-gradient(ellipse at 60% 60%, rgba(0, 180, 180, 0.15) 0%, transparent 50%),
            radial-gradient(ellipse at center, #0a2525, #103838, #0a2525);
        }

        .results-screen[data-grade="AA"] .results-bg {
          background:
            radial-gradient(ellipse at 40% 40%, rgba(255, 255, 0, 0.2) 0%, transparent 45%),
            radial-gradient(ellipse at 60% 60%, rgba(200, 200, 0, 0.12) 0%, transparent 50%),
            radial-gradient(ellipse at center, #282808, #404010, #282808);
        }

        .results-screen[data-grade="A"] .results-bg {
          background:
            radial-gradient(ellipse at 45% 45%, rgba(0, 255, 100, 0.18) 0%, transparent 45%),
            radial-gradient(ellipse at center, #0a280a, #104010, #0a280a);
        }

        .results-screen[data-grade="B"] .results-bg {
          background:
            radial-gradient(ellipse at 45% 45%, rgba(0, 150, 255, 0.18) 0%, transparent 45%),
            radial-gradient(ellipse at center, #0a0a28, #101040, #0a0a28);
        }

        .results-screen[data-grade="C"] .results-bg {
          background:
            radial-gradient(ellipse at 45% 45%, rgba(255, 150, 0, 0.18) 0%, transparent 45%),
            radial-gradient(ellipse at center, #28200a, #403510, #28200a);
        }

        .results-screen[data-grade="D"] .results-bg {
          background:
            radial-gradient(ellipse at 45% 45%, rgba(255, 50, 50, 0.15) 0%, transparent 45%),
            radial-gradient(ellipse at center, #280a0a, #401010, #280a0a);
        }

        .results-screen.failed .results-bg {
          background:
            radial-gradient(ellipse at 50% 50%, rgba(255, 0, 0, 0.25) 0%, transparent 50%),
            radial-gradient(ellipse at center, #2a0808, #450e0e, #2a0808);
          animation: bgRotate 12s linear infinite, failPulse 0.8s ease-in-out infinite;
        }

        @keyframes bgRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes bgPulse {
          0%, 100% { transform: rotate(0deg) scale(1); opacity: 0.7; }
          50% { transform: rotate(180deg) scale(1.1); opacity: 0.9; }
        }

        @keyframes shimmer {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.2); }
        }

        @keyframes failPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 0.8; }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .results-content {
          position: relative;
          z-index: 1;
          text-align: center;
          max-width: 500px;
          padding: 2rem;
        }

        .song-info {
          margin-bottom: 2rem;
        }

        .song-info h2 {
          font-size: 1.5rem;
          margin-bottom: 0.5rem;
        }

        .song-info .artist {
          color: ${THEME.text.secondary};
          margin-bottom: 0.25rem;
        }

        .song-info .chart-info {
          color: ${THEME.accent.primary};
          font-size: 0.9rem;
        }

        .grade-display {
          font-size: 8rem;
          font-weight: 900;
          line-height: 1;
          margin-bottom: 1rem;
          text-shadow: 0 0 30px currentColor;
          animation: gradeIn 0.5s ease-out;
        }

        @keyframes gradeIn {
          from {
            transform: scale(1.5);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        .score-display {
          margin-bottom: 2rem;
        }

        .score-value {
          font-size: 3rem;
          font-weight: 700;
          font-family: 'SF Mono', Monaco, monospace;
          letter-spacing: 0.1em;
        }

        .percentage {
          font-size: 1.25rem;
          color: ${THEME.text.secondary};
        }

        .stats-grid {
          display: grid;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
          background: ${THEME.bg.secondary};
          padding: 1rem 1.5rem;
          border-radius: 12px;
        }

        .stat-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 1rem;
        }

        .stat-label {
          font-weight: 600;
        }

        .stat-value {
          font-family: 'SF Mono', Monaco, monospace;
          font-size: 1.1rem;
        }

        .combo-display {
          font-size: 1.1rem;
          color: ${THEME.text.secondary};
          margin-bottom: 2rem;
        }

        .combo-value {
          color: ${THEME.accent.primary};
          font-weight: 700;
          font-size: 1.3rem;
        }

        .full-combo {
          font-size: 1.8rem;
          font-weight: 900;
          color: #ffdd00;
          text-shadow: 0 0 20px #ffdd00, 0 0 40px #ff8800;
          margin-bottom: 0.5rem;
          animation: fcPulse 1s ease-in-out infinite, fcIn 0.5s ease-out;
        }

        @keyframes fcPulse {
          0%, 100% {
            text-shadow: 0 0 20px #ffdd00, 0 0 40px #ff8800;
            transform: scale(1);
          }
          50% {
            text-shadow: 0 0 30px #ffdd00, 0 0 60px #ff8800, 0 0 80px #ffaa00;
            transform: scale(1.05);
          }
        }

        @keyframes fcIn {
          from {
            transform: scale(1.5);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        .controls-hint {
          display: flex;
          gap: 2rem;
          justify-content: center;
          color: ${THEME.text.secondary};
          font-size: 0.85rem;
        }

        .controls-hint kbd {
          display: inline-block;
          padding: 0.2rem 0.5rem;
          background: ${THEME.bg.tertiary};
          border-radius: 4px;
          margin-right: 0.25rem;
          font-family: inherit;
        }

        .results-screen.failed .grade-display {
          font-size: 5rem;
          animation: failShake 0.5s ease-out;
        }

        @keyframes failShake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
      </style>
    `;
  }

  /**
   * Get color for grade
   */
  private getGradeColor(grade: string): string {
    switch (grade) {
      case 'AAAA':
        return '#00ffff'; // Bright cyan with glow
      case 'AAA':
        return '#00dddd'; // Cyan
      case 'AA':
        return '#ffff00'; // Yellow
      case 'A':
        return '#00ff00'; // Green
      case 'B':
        return '#0088ff'; // Blue
      case 'C':
        return '#ff8800'; // Orange
      case 'D':
        return '#ff0000'; // Red
      default:
        return THEME.text.primary;
    }
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
