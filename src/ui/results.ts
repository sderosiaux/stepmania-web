import type { ResultsData, JudgmentGrade } from '../types';
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
   * Render the results
   */
  private render(results: ResultsData): void {
    const gradeColor = this.getGradeColor(results.grade);

    this.container.innerHTML = `
      <div class="results-screen">
        <div class="results-content">
          <div class="song-info">
            <h2>${escapeHtml(results.song.title)}</h2>
            <p class="artist">${escapeHtml(results.song.artist)}</p>
            <p class="chart-info">${results.chart.difficulty} (Lv. ${results.chart.level})</p>
          </div>

          <div class="grade-display" style="color: ${gradeColor}">
            ${results.grade}
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
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .results-content {
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
      </style>
    `;
  }

  /**
   * Get color for grade
   */
  private getGradeColor(grade: string): string {
    switch (grade) {
      case 'AAA':
        return '#00ffff'; // Cyan
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
