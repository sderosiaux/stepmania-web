import type { Song, Chart, Difficulty } from '../types';
import { THEME } from '../render';

// ============================================================================
// Song Select Screen
// ============================================================================

export interface SongSelectCallbacks {
  onSongSelect: (song: Song, chart: Chart) => void;
  onBack?: () => void;
}

export class SongSelectScreen {
  private container: HTMLElement;
  private songs: Song[] = [];
  private selectedIndex: number = 0;
  private selectedDifficultyIndex: number = 0;
  private callbacks: SongSelectCallbacks;
  private boundKeyHandler: (e: KeyboardEvent) => void;

  constructor(container: HTMLElement, callbacks: SongSelectCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.boundKeyHandler = this.handleKey.bind(this);
  }

  /**
   * Show the song select screen
   */
  show(songs: Song[]): void {
    this.songs = songs;
    this.selectedIndex = 0;
    this.selectedDifficultyIndex = 0;

    this.render();
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
    const song = this.songs[this.selectedIndex];

    switch (e.code) {
      case 'ArrowUp':
        e.preventDefault();
        this.selectedIndex = Math.max(0, this.selectedIndex - 1);
        this.selectedDifficultyIndex = 0;
        this.render();
        break;

      case 'ArrowDown':
        e.preventDefault();
        this.selectedIndex = Math.min(this.songs.length - 1, this.selectedIndex + 1);
        this.selectedDifficultyIndex = 0;
        this.render();
        break;

      case 'ArrowLeft':
        e.preventDefault();
        if (song) {
          this.selectedDifficultyIndex = Math.max(0, this.selectedDifficultyIndex - 1);
          this.render();
        }
        break;

      case 'ArrowRight':
        e.preventDefault();
        if (song) {
          this.selectedDifficultyIndex = Math.min(
            song.charts.length - 1,
            this.selectedDifficultyIndex + 1
          );
          this.render();
        }
        break;

      case 'Enter':
        e.preventDefault();
        if (song) {
          const chart = song.charts[this.selectedDifficultyIndex];
          if (chart) {
            this.callbacks.onSongSelect(song, chart);
          }
        }
        break;

      case 'Escape':
        e.preventDefault();
        this.callbacks.onBack?.();
        break;
    }
  }

  /**
   * Render the screen
   */
  private render(): void {
    const selectedSong = this.songs[this.selectedIndex];

    this.container.innerHTML = `
      <div class="song-select">
        <h1 class="title">SELECT SONG</h1>

        <div class="song-list">
          ${this.songs.length === 0 ? this.renderEmptyState() : this.renderSongList()}
        </div>

        ${selectedSong ? this.renderSongDetails(selectedSong) : ''}

        <div class="controls-hint">
          <span><kbd>↑</kbd><kbd>↓</kbd> Select Song</span>
          <span><kbd>←</kbd><kbd>→</kbd> Select Difficulty</span>
          <span><kbd>ENTER</kbd> Start</span>
        </div>
      </div>
      <style>
        .song-select {
          position: fixed;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: ${THEME.bg.primary};
          color: ${THEME.text.primary};
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          padding: 2rem;
        }

        .song-select .title {
          font-size: 2.5rem;
          font-weight: 700;
          margin-bottom: 2rem;
          background: linear-gradient(135deg, ${THEME.accent.primary}, ${THEME.accent.secondary});
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .song-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          max-height: 300px;
          overflow-y: auto;
          width: 100%;
          max-width: 500px;
          margin-bottom: 2rem;
        }

        .song-item {
          padding: 1rem 1.5rem;
          background: ${THEME.bg.secondary};
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
          border: 2px solid transparent;
        }

        .song-item:hover {
          background: ${THEME.bg.tertiary};
        }

        .song-item.selected {
          border-color: ${THEME.accent.primary};
          background: ${THEME.bg.tertiary};
        }

        .song-item .song-title {
          font-size: 1.1rem;
          font-weight: 600;
          margin-bottom: 0.25rem;
        }

        .song-item .song-artist {
          font-size: 0.9rem;
          color: ${THEME.text.secondary};
        }

        .song-details {
          background: ${THEME.bg.secondary};
          border-radius: 12px;
          padding: 1.5rem 2rem;
          margin-bottom: 2rem;
          min-width: 400px;
          text-align: center;
        }

        .song-details h2 {
          font-size: 1.5rem;
          margin-bottom: 0.5rem;
        }

        .song-details .artist {
          color: ${THEME.text.secondary};
          margin-bottom: 1rem;
        }

        .song-details .bpm {
          color: ${THEME.accent.primary};
          font-size: 0.9rem;
          margin-bottom: 1rem;
        }

        .difficulty-select {
          display: flex;
          gap: 0.5rem;
          justify-content: center;
          flex-wrap: wrap;
        }

        .difficulty-item {
          padding: 0.5rem 1rem;
          background: ${THEME.bg.tertiary};
          border-radius: 6px;
          font-size: 0.85rem;
          border: 2px solid transparent;
          transition: all 0.15s ease;
        }

        .difficulty-item.selected {
          border-color: ${THEME.accent.primary};
          background: rgba(0, 212, 255, 0.1);
        }

        .difficulty-item .level {
          display: block;
          font-size: 0.75rem;
          color: ${THEME.text.secondary};
          margin-top: 0.25rem;
        }

        .controls-hint {
          display: flex;
          gap: 2rem;
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

        .empty-state {
          text-align: center;
          padding: 3rem;
          color: ${THEME.text.secondary};
        }

        .empty-state h3 {
          color: ${THEME.text.primary};
          margin-bottom: 1rem;
        }

        .empty-state code {
          display: block;
          background: ${THEME.bg.tertiary};
          padding: 1rem;
          border-radius: 8px;
          margin-top: 1rem;
          font-size: 0.85rem;
          text-align: left;
        }
      </style>
    `;

    // Add click handlers
    const items = this.container.querySelectorAll('.song-item');
    items.forEach((item, index) => {
      item.addEventListener('click', () => {
        this.selectedIndex = index;
        this.selectedDifficultyIndex = 0;
        this.render();
      });
    });

    const diffItems = this.container.querySelectorAll('.difficulty-item');
    diffItems.forEach((item, index) => {
      item.addEventListener('click', () => {
        this.selectedDifficultyIndex = index;
        this.render();

        // Double click to start
        if (selectedSong) {
          const chart = selectedSong.charts[index];
          if (chart) {
            this.callbacks.onSongSelect(selectedSong, chart);
          }
        }
      });
    });
  }

  /**
   * Render empty state when no songs are available
   */
  private renderEmptyState(): string {
    return `
      <div class="empty-state">
        <h3>No Songs Found</h3>
        <p>Add songs to the <code>songs/</code> folder to get started.</p>
        <p>Each song needs:</p>
        <code>
songs/my-song/<br>
├── song.mp3<br>
└── chart.stp
        </code>
      </div>
    `;
  }

  /**
   * Render the song list
   */
  private renderSongList(): string {
    return this.songs
      .map(
        (song, index) => `
        <div class="song-item ${index === this.selectedIndex ? 'selected' : ''}" data-index="${index}">
          <div class="song-title">${escapeHtml(song.title)}</div>
          <div class="song-artist">${escapeHtml(song.artist)}</div>
        </div>
      `
      )
      .join('');
  }

  /**
   * Render song details panel
   */
  private renderSongDetails(song: Song): string {
    return `
      <div class="song-details">
        <h2>${escapeHtml(song.title)}</h2>
        <div class="artist">${escapeHtml(song.artist)}</div>
        <div class="bpm">${song.bpm} BPM</div>
        <div class="difficulty-select">
          ${song.charts
            .map(
              (chart, index) => `
              <div class="difficulty-item ${index === this.selectedDifficultyIndex ? 'selected' : ''}">
                ${chart.difficulty}
                <span class="level">Lv. ${chart.level}</span>
              </div>
            `
            )
            .join('')}
        </div>
      </div>
    `;
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
