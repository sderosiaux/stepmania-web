import type { Song, Chart, GameScreen, ResultsData } from './types';
import { audioManager } from './audio';
import { GameController } from './core/game';
import { loadAllSongs, createDemoSong } from './core/loader';
import { SongSelectScreen } from './ui/song-select';
import { ResultsScreen } from './ui/results';

// ============================================================================
// Main Application
// ============================================================================

class App {
  private canvas: HTMLCanvasElement;
  private uiContainer: HTMLElement;
  private loadingElement: HTMLElement;

  private gameController: GameController | null = null;
  private songSelectScreen: SongSelectScreen | null = null;
  private resultsScreen: ResultsScreen | null = null;

  private currentScreen: GameScreen = 'loading';
  private songs: Song[] = [];
  private lastPlayedSong: Song | null = null;
  private lastPlayedChart: Chart | null = null;

  constructor() {
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.loadingElement = document.getElementById('loading') as HTMLElement;

    // Create UI container
    this.uiContainer = document.createElement('div');
    this.uiContainer.id = 'ui-container';
    document.getElementById('app')!.appendChild(this.uiContainer);

    // Initialize screens
    this.songSelectScreen = new SongSelectScreen(this.uiContainer, {
      onSongSelect: (song, chart) => this.startGame(song, chart),
    });

    this.resultsScreen = new ResultsScreen(this.uiContainer, {
      onContinue: () => this.showSongSelect(),
      onRetry: () => this.retryLastSong(),
    });

    // Global keyboard handler for pause
    window.addEventListener('keydown', this.handleGlobalKey.bind(this));
  }

  /**
   * Initialize the application
   */
  async init(): Promise<void> {
    try {
      // Initialize audio (requires user interaction in most browsers)
      await this.waitForUserInteraction();
      await audioManager.init();

      // Load songs
      this.songs = await loadAllSongs();

      // Add demo song if no songs found
      if (this.songs.length === 0) {
        this.songs.push(createDemoSong());
      }

      // Hide loading, show song select
      this.hideLoading();
      this.showSongSelect();
    } catch (error) {
      console.error('Failed to initialize:', error);
      this.showError('Failed to initialize. Please refresh the page.');
    }
  }

  /**
   * Wait for user interaction (needed for audio autoplay policy)
   */
  private waitForUserInteraction(): Promise<void> {
    return new Promise((resolve) => {
      const handler = () => {
        document.removeEventListener('click', handler);
        document.removeEventListener('keydown', handler);
        resolve();
      };

      // Check if we already have interaction
      if (document.hasFocus()) {
        // Add click/key prompt
        const prompt = document.createElement('p');
        prompt.textContent = 'Click or press any key to start';
        prompt.style.cssText = 'color: #a0a0b0; margin-top: 1rem;';
        this.loadingElement.appendChild(prompt);
      }

      document.addEventListener('click', handler);
      document.addEventListener('keydown', handler);
    });
  }

  /**
   * Hide loading screen
   */
  private hideLoading(): void {
    this.loadingElement.classList.add('hidden');
  }

  /**
   * Show error message
   */
  private showError(message: string): void {
    this.loadingElement.innerHTML = `
      <h1 style="color: #ff4444;">Error</h1>
      <p>${message}</p>
    `;
  }

  /**
   * Show song select screen
   */
  private showSongSelect(): void {
    this.currentScreen = 'song-select';
    this.canvas.classList.add('hidden');
    this.uiContainer.classList.remove('hidden');
    this.resultsScreen?.hide();
    this.songSelectScreen?.show(this.songs);
  }

  /**
   * Start a game
   */
  private async startGame(song: Song, chart: Chart): Promise<void> {
    this.currentScreen = 'gameplay';
    this.lastPlayedSong = song;
    this.lastPlayedChart = chart;

    // Hide UI, show canvas
    this.songSelectScreen?.hide();
    this.uiContainer.classList.add('hidden');
    this.canvas.classList.remove('hidden');

    // Create game controller
    this.gameController = new GameController(this.canvas);

    // Listen for game events
    this.gameController.addEventListener((event) => {
      if (event.type === 'song-end') {
        this.showResults(event.data as ResultsData);
      }
    });

    // Start the game
    try {
      await this.gameController.start(song, chart);
    } catch (error) {
      console.error('Failed to start game:', error);
      this.showSongSelect();
    }
  }

  /**
   * Show results screen
   */
  private showResults(results: ResultsData): void {
    this.currentScreen = 'results';
    this.gameController?.stop();
    this.gameController = null;

    this.canvas.classList.add('hidden');
    this.uiContainer.classList.remove('hidden');
    this.resultsScreen?.show(results);
  }

  /**
   * Retry the last played song
   */
  private retryLastSong(): void {
    if (this.lastPlayedSong && this.lastPlayedChart) {
      this.resultsScreen?.hide();
      this.startGame(this.lastPlayedSong, this.lastPlayedChart);
    }
  }

  /**
   * Handle global keyboard events
   */
  private handleGlobalKey(e: KeyboardEvent): void {
    if (this.currentScreen === 'gameplay' && this.gameController) {
      if (e.code === 'Escape') {
        e.preventDefault();
        this.gameController.togglePause();
      } else if (e.code === 'Enter' && this.gameController.isPaused()) {
        e.preventDefault();
        this.gameController.resume();
      }
    }
  }
}

// ============================================================================
// Bootstrap
// ============================================================================

const app = new App();
app.init().catch(console.error);
