import type { Song, Chart, Settings, SongPack, Note } from '../types';
import { THEME } from '../render';
import { CMOD_OPTIONS, DEFAULT_SETTINGS } from '../types';

// ============================================================================
// Chart Stats Calculator
// ============================================================================

interface ChartStats {
  totalNotes: number;
  taps: number;
  jumps: number;
  hands: number;
  quads: number;
  durationSec: number;
  nps: number;
  peakNps: number;
}

function calculateChartStats(notes: Note[]): ChartStats {
  if (notes.length === 0) {
    return { totalNotes: 0, taps: 0, jumps: 0, hands: 0, quads: 0, durationSec: 0, nps: 0, peakNps: 0 };
  }

  const notesByTime = new Map<number, Note[]>();
  for (const note of notes) {
    const time = Math.round(note.time);
    if (!notesByTime.has(time)) {
      notesByTime.set(time, []);
    }
    notesByTime.get(time)!.push(note);
  }

  let taps = 0, jumps = 0, hands = 0, quads = 0;

  for (const [, notesAtTime] of notesByTime) {
    const count = notesAtTime.length;
    if (count === 1) taps++;
    else if (count === 2) jumps++;
    else if (count === 3) hands++;
    else if (count >= 4) quads++;
  }

  const firstNote = notes[0]!;
  const lastNote = notes[notes.length - 1]!;
  const durationMs = lastNote.time - firstNote.time;
  const durationSec = Math.max(1, durationMs / 1000);
  const nps = notes.length / durationSec;

  let peakNps = 0;
  for (let windowStart = firstNote.time; windowStart <= lastNote.time; windowStart += 500) {
    const notesInWindow = notes.filter(n => n.time >= windowStart && n.time < windowStart + 1000);
    peakNps = Math.max(peakNps, notesInWindow.length);
  }

  return { totalNotes: notes.length, taps, jumps, hands, quads, durationSec, nps: Math.round(nps * 10) / 10, peakNps };
}

// ============================================================================
// Groove Radar Calculator
// ============================================================================

interface GrooveRadar {
  stream: number;   // Note density (0-100)
  voltage: number;  // Peak difficulty (0-100)
  air: number;      // Jumps/hands (0-100)
  freeze: number;   // Hold notes (0-100)
  chaos: number;    // Pattern complexity (0-100)
}

function calculateGrooveRadar(notes: Note[], durationSec: number): GrooveRadar {
  if (notes.length === 0 || durationSec <= 0) {
    return { stream: 0, voltage: 0, air: 0, freeze: 0, chaos: 0 };
  }

  const notesByTime = new Map<number, Note[]>();
  for (const note of notes) {
    const time = Math.round(note.time);
    if (!notesByTime.has(time)) {
      notesByTime.set(time, []);
    }
    notesByTime.get(time)!.push(note);
  }

  // Stream: Based on average NPS (normalized to 0-100, where 10 NPS = 100)
  const nps = notes.length / durationSec;
  const stream = Math.min(100, (nps / 10) * 100);

  // Voltage: Based on peak NPS (normalized, 15 NPS peak = 100)
  const firstNote = notes[0]!;
  const lastNote = notes[notes.length - 1]!;
  let peakNps = 0;
  for (let windowStart = firstNote.time; windowStart <= lastNote.time; windowStart += 500) {
    const notesInWindow = notes.filter(n => n.time >= windowStart && n.time < windowStart + 1000);
    peakNps = Math.max(peakNps, notesInWindow.length);
  }
  const voltage = Math.min(100, (peakNps / 15) * 100);

  // Air: Percentage of jumps/hands (notes with 2+ at same time)
  let jumpsAndHands = 0;
  for (const [, notesAtTime] of notesByTime) {
    if (notesAtTime.length >= 2) jumpsAndHands++;
  }
  const air = Math.min(100, (jumpsAndHands / notesByTime.size) * 200);

  // Freeze: Percentage of hold notes
  const holdNotes = notes.filter(n => n.type === 'hold').length;
  const freeze = Math.min(100, (holdNotes / notes.length) * 400);

  // Chaos: Based on timing variance (irregular patterns)
  const intervals: number[] = [];
  const sortedTimes = Array.from(notesByTime.keys()).sort((a, b) => a - b);
  for (let i = 1; i < sortedTimes.length; i++) {
    intervals.push(sortedTimes[i]! - sortedTimes[i - 1]!);
  }

  let chaos = 0;
  if (intervals.length > 0) {
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    // High stdDev = irregular patterns = high chaos
    chaos = Math.min(100, (stdDev / avgInterval) * 100);
  }

  return {
    stream: Math.round(stream),
    voltage: Math.round(voltage),
    air: Math.round(air),
    freeze: Math.round(freeze),
    chaos: Math.round(chaos),
  };
}

// ============================================================================
// Score Storage (in-memory)
// ============================================================================

interface ScoreRecord {
  grade: string;
  score: number;
  maxCombo: number;
  accuracy: number;
  date: number;
}

// Map of "songId-difficulty" -> best score
const scoreStorage = new Map<string, ScoreRecord>();

export function saveScore(songId: string, difficulty: string, record: ScoreRecord): void {
  const key = `${songId}-${difficulty}`;
  const existing = scoreStorage.get(key);
  if (!existing || record.score > existing.score) {
    scoreStorage.set(key, record);
  }
}

function getScore(songId: string, difficulty: string): ScoreRecord | null {
  return scoreStorage.get(`${songId}-${difficulty}`) ?? null;
}

// ============================================================================
// Song Select Screen - 3 Column Layout
// ============================================================================

export interface SongSelectCallbacks {
  onSongSelect: (song: Song, chart: Chart, settings: Partial<Settings>) => void;
  onDemo?: (song: Song, chart: Chart, settings: Partial<Settings>) => void;
  onBack?: () => void;
}

const DIFFICULTY_FILTERS = ['All', 'Easy+', 'Medium+', 'Hard+', 'Challenge'] as const;
type DifficultyFilter = typeof DIFFICULTY_FILTERS[number];
const DIFFICULTY_ORDER = ['Beginner', 'Easy', 'Medium', 'Hard', 'Challenge'] as const;

export class SongSelectScreen {
  private container: HTMLElement;
  private allSongs: Song[] = [];
  private packs: SongPack[] = [];
  private selectedPackIndex: number = 0;
  private selectedSongIndex: number = 0;
  private selectedDifficultyIndex: number = 0;
  private selectedCmodIndex: number = 6; // C800 default
  private difficultyFilter: DifficultyFilter = 'All';
  private activeColumn: 'packs' | 'songs' | 'difficulties' = 'packs';
  private callbacks: SongSelectCallbacks;
  private boundKeyHandler: (e: KeyboardEvent) => void;
  private hasBeenShown: boolean = false;
  private pendingRadarData: GrooveRadar | null = null;

  constructor(container: HTMLElement, callbacks: SongSelectCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.boundKeyHandler = this.handleKey.bind(this);
  }

  show(songs: Song[]): void {
    const songsChanged = this.allSongs.length !== songs.length;
    this.allSongs = songs;
    this.applyFilter();

    // Only reset position on first show or if songs changed
    if (!this.hasBeenShown || songsChanged) {
      this.selectedPackIndex = 0;
      this.selectedSongIndex = 0;
      this.selectedDifficultyIndex = 0;
      this.activeColumn = 'packs';
      this.hasBeenShown = true;
    } else {
      // Validate indices are still in range
      this.selectedPackIndex = Math.min(this.selectedPackIndex, Math.max(0, this.packs.length - 1));
      const currentPack = this.packs[this.selectedPackIndex];
      if (currentPack) {
        this.selectedSongIndex = Math.min(this.selectedSongIndex, Math.max(0, currentPack.songs.length - 1));
        const currentSong = currentPack.songs[this.selectedSongIndex];
        if (currentSong) {
          this.selectedDifficultyIndex = Math.min(this.selectedDifficultyIndex, Math.max(0, currentSong.charts.length - 1));
        }
      }
    }

    this.render();
    window.addEventListener('keydown', this.boundKeyHandler);
  }

  hide(): void {
    window.removeEventListener('keydown', this.boundKeyHandler);
    this.container.innerHTML = '';
  }

  private applyFilter(): void {
    const minDifficultyIndex = this.getMinDifficultyIndex();
    const filteredSongs = this.allSongs.map(song => {
      if (minDifficultyIndex === 0) return song;
      const filteredCharts = song.charts.filter(chart => {
        const chartDiffIndex = DIFFICULTY_ORDER.indexOf(chart.difficulty as typeof DIFFICULTY_ORDER[number]);
        return chartDiffIndex >= minDifficultyIndex;
      });
      if (filteredCharts.length === 0) return null;
      return { ...song, charts: filteredCharts };
    }).filter((song): song is Song => song !== null);
    this.packs = this.organizeSongsIntoPacks(filteredSongs);
  }

  private getMinDifficultyIndex(): number {
    switch (this.difficultyFilter) {
      case 'All': return 0;
      case 'Easy+': return 1;
      case 'Medium+': return 2;
      case 'Hard+': return 3;
      case 'Challenge': return 4;
      default: return 0;
    }
  }

  private cycleDifficultyFilter(direction: number): void {
    const currentIndex = DIFFICULTY_FILTERS.indexOf(this.difficultyFilter);
    let newIndex = currentIndex + direction;
    if (newIndex < 0) newIndex = DIFFICULTY_FILTERS.length - 1;
    if (newIndex >= DIFFICULTY_FILTERS.length) newIndex = 0;
    this.difficultyFilter = DIFFICULTY_FILTERS[newIndex]!;
    this.applyFilter();
    this.selectedPackIndex = Math.min(this.selectedPackIndex, Math.max(0, this.packs.length - 1));
    this.selectedSongIndex = 0;
    this.selectedDifficultyIndex = 0;
    this.render();
  }

  private organizeSongsIntoPacks(songs: Song[]): SongPack[] {
    const packMap = new Map<string, Song[]>();
    for (const song of songs) {
      const packName = song.pack || 'Uncategorized';
      if (!packMap.has(packName)) packMap.set(packName, []);
      packMap.get(packName)!.push(song);
    }
    return Array.from(packMap.entries()).map(([name, songs]) => ({ name, songs }));
  }

  private handleKey(e: KeyboardEvent): void {
    const currentPack = this.packs[this.selectedPackIndex];
    const currentSong = currentPack?.songs[this.selectedSongIndex];

    switch (e.code) {
      case 'ArrowUp':
        e.preventDefault();
        if (this.activeColumn === 'packs') {
          this.selectedPackIndex = Math.max(0, this.selectedPackIndex - 1);
          this.selectedSongIndex = 0;
          this.selectedDifficultyIndex = 0;
        } else if (this.activeColumn === 'songs') {
          this.selectedSongIndex = Math.max(0, this.selectedSongIndex - 1);
          this.selectedDifficultyIndex = 0;
        } else if (this.activeColumn === 'difficulties' && currentSong) {
          this.selectedDifficultyIndex = Math.max(0, this.selectedDifficultyIndex - 1);
        }
        this.render();
        break;

      case 'ArrowDown':
        e.preventDefault();
        if (this.activeColumn === 'packs') {
          this.selectedPackIndex = Math.min(this.packs.length - 1, this.selectedPackIndex + 1);
          this.selectedSongIndex = 0;
          this.selectedDifficultyIndex = 0;
        } else if (this.activeColumn === 'songs' && currentPack) {
          this.selectedSongIndex = Math.min(currentPack.songs.length - 1, this.selectedSongIndex + 1);
          this.selectedDifficultyIndex = 0;
        } else if (this.activeColumn === 'difficulties' && currentSong) {
          this.selectedDifficultyIndex = Math.min(currentSong.charts.length - 1, this.selectedDifficultyIndex + 1);
        }
        this.render();
        break;

      case 'ArrowLeft':
        e.preventDefault();
        if (this.activeColumn === 'difficulties') {
          this.activeColumn = 'songs';
        } else if (this.activeColumn === 'songs') {
          this.activeColumn = 'packs';
        } else {
          this.cycleDifficultyFilter(-1);
        }
        this.render();
        break;

      case 'ArrowRight':
        e.preventDefault();
        if (this.activeColumn === 'packs' && currentPack && currentPack.songs.length > 0) {
          this.activeColumn = 'songs';
        } else if (this.activeColumn === 'songs' && currentSong && currentSong.charts.length > 0) {
          this.activeColumn = 'difficulties';
        } else if (this.activeColumn === 'packs') {
          this.cycleDifficultyFilter(1);
        }
        this.render();
        break;

      case 'Enter':
        e.preventDefault();
        if (currentSong) {
          const chart = currentSong.charts[this.selectedDifficultyIndex];
          if (chart) {
            const cmod = CMOD_OPTIONS[this.selectedCmodIndex] ?? DEFAULT_SETTINGS.cmod;
            this.callbacks.onSongSelect(currentSong, chart, { cmod });
          }
        }
        break;

      case 'Tab':
        e.preventDefault();
        if (e.shiftKey) {
          this.selectedCmodIndex = Math.max(0, this.selectedCmodIndex - 1);
        } else {
          this.selectedCmodIndex = Math.min(CMOD_OPTIONS.length - 1, this.selectedCmodIndex + 1);
        }
        this.render();
        break;

      case 'KeyD':
        e.preventDefault();
        if (currentSong && this.callbacks.onDemo) {
          const chart = currentSong.charts[this.selectedDifficultyIndex];
          if (chart) {
            const cmod = CMOD_OPTIONS[this.selectedCmodIndex] ?? DEFAULT_SETTINGS.cmod;
            this.callbacks.onDemo(currentSong, chart, { cmod });
          }
        }
        break;

      case 'Escape':
        e.preventDefault();
        if (this.activeColumn === 'difficulties') {
          this.activeColumn = 'songs';
          this.render();
        } else if (this.activeColumn === 'songs') {
          this.activeColumn = 'packs';
          this.render();
        }
        break;
    }
  }

  private render(): void {
    const currentPack = this.packs[this.selectedPackIndex];
    const currentSong = currentPack?.songs[this.selectedSongIndex];
    const currentChart = currentSong?.charts[this.selectedDifficultyIndex];

    this.container.innerHTML = `
      <div class="song-select-4col">
        <div class="header">
          <h1 class="title">SELECT SONG</h1>
        </div>

        <div class="columns">
          <!-- Packs Column -->
          <div class="column packs-column ${this.activeColumn === 'packs' ? 'active' : ''}">
            <div class="column-header">PACKS</div>
            <div class="column-list">
              ${this.packs.length === 0 ? '<div class="empty">No songs</div>' : this.packs.map((pack, i) => `
                <div class="list-item ${i === this.selectedPackIndex ? 'selected' : ''}" data-pack="${i}">
                  <span class="item-icon">📁</span>
                  <span class="item-name">${escapeHtml(pack.name)}</span>
                  <span class="item-count">${pack.songs.length}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Songs Column -->
          <div class="column songs-column ${this.activeColumn === 'songs' ? 'active' : ''}">
            <div class="column-header">SONGS</div>
            <div class="column-list">
              ${!currentPack ? '<div class="empty">Select a pack</div>' : currentPack.songs.map((song, i) => {
                // Get best grade across all difficulties
                const grades = song.charts.map(c => getScore(song.id, c.difficulty)).filter(Boolean);
                const bestGrade = grades.length > 0 ? grades.sort((a, b) => {
                  const order = ['AAAA', 'AAA', 'AA', 'A', 'B', 'C', 'D'];
                  return order.indexOf(a!.grade) - order.indexOf(b!.grade);
                })[0] : null;
                return `
                  <div class="list-item ${i === this.selectedSongIndex ? 'selected' : ''}" data-song="${i}">
                    <div class="song-row">
                      <span class="item-name">${escapeHtml(song.title)}</span>
                      ${bestGrade ? `<span class="best-grade grade-${bestGrade.grade.toLowerCase()}">${bestGrade.grade}</span>` : ''}
                    </div>
                    <div class="song-meta">
                      <span class="artist">${escapeHtml(song.artist)}</span>
                      <span class="bpm">${song.bpm} BPM</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Difficulties Column -->
          <div class="column difficulties-column ${this.activeColumn === 'difficulties' ? 'active' : ''}">
            <div class="column-header">DIFFICULTY</div>
            <div class="column-list">
              ${!currentSong ? '<div class="empty">Select a song</div>' : currentSong.charts.map((chart, i) => {
                const chartScore = getScore(currentSong.id, chart.difficulty);
                return `
                  <div class="list-item diff-item ${i === this.selectedDifficultyIndex ? 'selected' : ''}" data-diff-idx="${i}">
                    <div class="diff-row">
                      <span class="diff-name" data-diff="${chart.difficulty}">${chart.difficulty}</span>
                      <span class="diff-level">Lv.${chart.level}</span>
                    </div>
                    ${chartScore ? `
                      <div class="diff-score">
                        <span class="diff-grade grade-${chartScore.grade.toLowerCase()}">${chartScore.grade}</span>
                        <span class="diff-score-value">${chartScore.score.toLocaleString()}</span>
                      </div>
                    ` : '<div class="diff-no-score">No play</div>'}
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Stats Column -->
          <div class="column stats-column">
            <div class="column-header">CHART INFO</div>
            ${currentChart ? this.renderChartDetails(currentSong!, currentChart) : '<div class="empty">Select a difficulty</div>'}
          </div>
        </div>

        <div class="footer">
          ${this.renderCmodSelector()}
          <div class="nav-hint">
            <span>↑↓ Navigate</span>
            <span>←→ Columns</span>
            <span>TAB Speed</span>
            <span>ENTER Play</span>
            <span class="demo-hint">D Demo</span>
          </div>
        </div>
      </div>
      ${this.getStyles()}
    `;

    this.addClickHandlers();
    this.drawGrooveRadar();
  }

  private drawGrooveRadar(): void {
    if (!this.pendingRadarData) return;

    const canvas = document.getElementById('groove-radar') as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const radar = this.pendingRadarData;
    const size = canvas.width;
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size * 0.38;

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Radar dimensions - 5 axes for pentagon
    const dimensions = [
      { label: 'STREAM', value: radar.stream, angle: -Math.PI / 2 },
      { label: 'VOLTAGE', value: radar.voltage, angle: -Math.PI / 2 + (2 * Math.PI / 5) },
      { label: 'AIR', value: radar.air, angle: -Math.PI / 2 + (4 * Math.PI / 5) },
      { label: 'FREEZE', value: radar.freeze, angle: -Math.PI / 2 + (6 * Math.PI / 5) },
      { label: 'CHAOS', value: radar.chaos, angle: -Math.PI / 2 + (8 * Math.PI / 5) },
    ];

    // Draw background grid (concentric pentagons)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;

    for (let level = 0.25; level <= 1; level += 0.25) {
      ctx.beginPath();
      for (let i = 0; i <= dimensions.length; i++) {
        const dim = dimensions[i % dimensions.length]!;
        const x = centerX + Math.cos(dim.angle) * radius * level;
        const y = centerY + Math.sin(dim.angle) * radius * level;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.stroke();
    }

    // Draw axis lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    for (const dim of dimensions) {
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(
        centerX + Math.cos(dim.angle) * radius,
        centerY + Math.sin(dim.angle) * radius
      );
      ctx.stroke();
    }

    // Draw filled radar shape with gradient
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    gradient.addColorStop(0, 'rgba(0, 212, 255, 0.8)');
    gradient.addColorStop(1, 'rgba(255, 0, 170, 0.6)');

    ctx.beginPath();
    for (let i = 0; i <= dimensions.length; i++) {
      const dim = dimensions[i % dimensions.length]!;
      const value = dim.value / 100;
      const x = centerX + Math.cos(dim.angle) * radius * value;
      const y = centerY + Math.sin(dim.angle) * radius * value;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw radar outline
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= dimensions.length; i++) {
      const dim = dimensions[i % dimensions.length]!;
      const value = dim.value / 100;
      const x = centerX + Math.cos(dim.angle) * radius * value;
      const y = centerY + Math.sin(dim.angle) * radius * value;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.stroke();

    // Draw data points
    for (const dim of dimensions) {
      const value = dim.value / 100;
      const x = centerX + Math.cos(dim.angle) * radius * value;
      const y = centerY + Math.sin(dim.angle) * radius * value;

      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#00d4ff';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Draw labels
    ctx.font = 'bold 9px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const dim of dimensions) {
      const labelRadius = radius + 18;
      const x = centerX + Math.cos(dim.angle) * labelRadius;
      const y = centerY + Math.sin(dim.angle) * labelRadius;

      // Label background
      const metrics = ctx.measureText(dim.label);
      const padding = 3;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(
        x - metrics.width / 2 - padding,
        y - 6 - padding,
        metrics.width + padding * 2,
        12 + padding * 2
      );

      // Label text
      ctx.fillStyle = '#fff';
      ctx.fillText(dim.label, x, y);

      // Value below label
      ctx.font = 'bold 8px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = '#00d4ff';
      ctx.fillText(`${dim.value}`, x, y + 11);
      ctx.font = 'bold 9px -apple-system, BlinkMacSystemFont, sans-serif';
    }
  }

  private renderChartDetails(song: Song, chart: Chart): string {
    const stats = calculateChartStats(chart.notes);
    const bestScore = getScore(song.id, chart.difficulty);

    // Store radar data for canvas drawing after render
    this.pendingRadarData = calculateGrooveRadar(chart.notes, stats.durationSec);

    const formatDuration = (sec: number) => {
      const min = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return `${min}:${s.toString().padStart(2, '0')}`;
    };

    return `
      <div class="chart-details">
        <div class="chart-header">
          <h2 class="song-title">${escapeHtml(song.title)}</h2>
          <div class="song-artist">${escapeHtml(song.artist)}</div>
          <div class="chart-info-row">
            <span class="diff-badge" data-diff="${chart.difficulty}">${chart.difficulty} Lv.${chart.level}</span>
            <span class="song-bpm">${song.bpm} BPM</span>
          </div>
        </div>

        ${bestScore ? `
          <div class="best-score-section">
            <div class="section-title">BEST SCORE</div>
            <div class="best-score-row">
              <span class="best-grade-large grade-${bestScore.grade.toLowerCase()}">${bestScore.grade}</span>
              <div class="best-details">
                <div class="best-score-value">${bestScore.score.toLocaleString()}</div>
                <div class="best-meta">
                  <span>Combo: ${bestScore.maxCombo}</span>
                  <span>Acc: ${bestScore.accuracy.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>
        ` : `
          <div class="no-score">No score yet</div>
        `}

        <div class="radar-section">
          <div class="section-title">GROOVE RADAR</div>
          <div class="radar-container">
            <canvas id="groove-radar" class="radar-canvas" width="200" height="200"></canvas>
          </div>
        </div>

        <div class="stats-section">
          <div class="section-title">CHART STATS</div>
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-value">${stats.totalNotes}</span>
              <span class="stat-label">Steps</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">${stats.taps}</span>
              <span class="stat-label">Taps</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">${stats.jumps}</span>
              <span class="stat-label">Jumps</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">${stats.hands}</span>
              <span class="stat-label">Hands</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">${formatDuration(stats.durationSec)}</span>
              <span class="stat-label">Length</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">${stats.nps}</span>
              <span class="stat-label">Avg NPS</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">${stats.peakNps}</span>
              <span class="stat-label">Peak NPS</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private renderCmodSelector(): string {
    return `
      <div class="cmod-selector">
        <span class="label">Speed:</span>
        <div class="cmod-options">
          ${CMOD_OPTIONS.map((cmod, i) => `
            <div class="cmod-option ${i === this.selectedCmodIndex ? 'selected' : ''}" data-cmod="${i}">
              ${cmod === 0 ? 'BPM' : `C${cmod}`}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  private addClickHandlers(): void {
    // Pack clicks
    this.container.querySelectorAll('[data-pack]').forEach(el => {
      el.addEventListener('click', () => {
        this.selectedPackIndex = parseInt((el as HTMLElement).dataset.pack!, 10);
        this.selectedSongIndex = 0;
        this.selectedDifficultyIndex = 0;
        this.activeColumn = 'songs';
        this.render();
      });
    });

    // Song clicks
    this.container.querySelectorAll('[data-song]').forEach(el => {
      el.addEventListener('click', () => {
        this.selectedSongIndex = parseInt((el as HTMLElement).dataset.song!, 10);
        this.selectedDifficultyIndex = 0;
        this.activeColumn = 'songs';
        this.render();
      });
    });

    // Difficulty clicks
    this.container.querySelectorAll('[data-diff-idx]').forEach(el => {
      el.addEventListener('click', () => {
        this.selectedDifficultyIndex = parseInt((el as HTMLElement).dataset.diffIdx!, 10);
        this.activeColumn = 'difficulties';
        this.render();
      });
    });

    // CMod clicks
    this.container.querySelectorAll('[data-cmod]').forEach(el => {
      el.addEventListener('click', () => {
        this.selectedCmodIndex = parseInt((el as HTMLElement).dataset.cmod!, 10);
        this.render();
      });
    });
  }

  private getStyles(): string {
    return `<style>
      .song-select-4col {
        position: fixed;
        inset: 0;
        display: flex;
        flex-direction: column;
        background: ${THEME.bg.primary};
        color: ${THEME.text.primary};
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        padding: 1.5rem;
      }

      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid ${THEME.bg.tertiary};
      }

      .title {
        font-size: 1.5rem;
        font-weight: 700;
        background: linear-gradient(135deg, ${THEME.accent.primary}, ${THEME.accent.secondary});
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        margin: 0;
      }

      .difficulty-filter {
        display: flex;
        gap: 0.25rem;
      }

      .filter-option {
        padding: 0.35rem 0.6rem;
        background: ${THEME.bg.secondary};
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 600;
        color: ${THEME.text.secondary};
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .filter-option:hover { background: ${THEME.bg.tertiary}; }
      .filter-option.selected {
        background: rgba(255, 0, 170, 0.2);
        color: ${THEME.accent.secondary};
      }

      .columns {
        display: flex;
        gap: 1rem;
        flex: 1;
        min-height: 0;
      }

      .column {
        background: ${THEME.bg.secondary};
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border: 2px solid transparent;
        transition: border-color 0.15s ease;
      }

      .column.active { border-color: ${THEME.accent.primary}; }

      .packs-column { flex: 0 0 220px; }
      .songs-column { flex: 0 0 280px; }
      .difficulties-column { flex: 0 0 200px; }
      .stats-column { flex: 1; }

      .column-header {
        padding: 0.75rem 1rem;
        font-size: 0.7rem;
        font-weight: 700;
        color: ${THEME.text.muted};
        letter-spacing: 1px;
        border-bottom: 1px solid ${THEME.bg.tertiary};
      }

      .column-list {
        flex: 1;
        overflow-y: auto;
        padding: 0.5rem;
      }

      .empty {
        color: ${THEME.text.muted};
        text-align: center;
        padding: 2rem;
        font-size: 0.85rem;
      }

      .list-item {
        padding: 0.6rem 0.75rem;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.1s ease;
        margin-bottom: 0.25rem;
      }

      .list-item:hover { background: ${THEME.bg.tertiary}; }
      .list-item.selected {
        background: rgba(0, 212, 255, 0.15);
        border-left: 3px solid ${THEME.accent.primary};
      }

      .packs-column .list-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .list-item .item-icon { flex-shrink: 0; }
      .list-item .item-name {
        flex: 1;
        font-size: 0.85rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .list-item .item-count {
        flex-shrink: 0;
        font-size: 0.7rem;
        color: ${THEME.text.muted};
        background: ${THEME.bg.tertiary};
        padding: 0.15rem 0.4rem;
        border-radius: 4px;
      }

      .song-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .song-meta {
        display: flex;
        gap: 0.75rem;
        margin-top: 0.25rem;
        font-size: 0.7rem;
        color: ${THEME.text.muted};
      }

      .best-grade {
        font-size: 0.65rem;
        font-weight: 700;
        padding: 0.1rem 0.3rem;
        border-radius: 3px;
      }

      .grade-aaaa { background: rgba(0, 255, 255, 0.25); color: #00ffff; text-shadow: 0 0 8px currentColor; }
      .grade-aaa { background: rgba(0, 220, 220, 0.2); color: #00dddd; }
      .grade-aa { background: rgba(255, 255, 0, 0.2); color: #ffff00; }
      .grade-a { background: rgba(0, 255, 136, 0.2); color: #00ff88; }
      .grade-b { background: rgba(0, 212, 255, 0.2); color: #00d4ff; }
      .grade-c { background: rgba(255, 170, 0, 0.2); color: #ffaa00; }
      .grade-d, .grade-f { background: rgba(255, 68, 68, 0.2); color: #ff4444; }

      /* Stats Column */
      .song-details { padding: 1rem; }
      .song-title { font-size: 1.25rem; margin: 0 0 0.25rem 0; }
      .song-artist { color: ${THEME.text.secondary}; font-size: 0.9rem; }
      .song-bpm { color: ${THEME.accent.primary}; font-size: 0.8rem; margin-top: 0.5rem; }

      .difficulty-tabs {
        display: flex;
        gap: 0.5rem;
        margin-top: 1rem;
        flex-wrap: wrap;
      }

      .diff-tab {
        padding: 0.5rem 0.75rem;
        background: ${THEME.bg.tertiary};
        border-radius: 6px;
        cursor: pointer;
        text-align: center;
        border: 2px solid transparent;
        transition: all 0.15s ease;
      }

      .diff-tab:hover { background: ${THEME.bg.primary}; }
      .diff-tab.selected { border-color: ${THEME.accent.primary}; }

      .diff-name { font-size: 0.75rem; display: block; }
      .diff-level { font-size: 0.65rem; color: ${THEME.text.muted}; display: block; }
      .diff-grade { font-size: 0.6rem; margin-top: 0.25rem; display: block; color: ${THEME.accent.success}; }

      .diff-tab[data-diff="Beginner"] .diff-name,
      .diff-tab[data-diff="Easy"] .diff-name { color: #88ff88; }
      .diff-tab[data-diff="Medium"] .diff-name { color: #ffff44; }
      .diff-tab[data-diff="Hard"] .diff-name { color: #ff8844; }
      .diff-tab[data-diff="Challenge"] .diff-name { color: #ff4488; }

      /* Difficulty column items */
      .diff-item { display: flex; flex-direction: column; gap: 0.25rem; }
      .diff-row { display: flex; align-items: center; justify-content: space-between; }
      .diff-name[data-diff="Beginner"],
      .diff-name[data-diff="Easy"] { color: #88ff88; }
      .diff-name[data-diff="Medium"] { color: #ffff44; }
      .diff-name[data-diff="Hard"] { color: #ff8844; }
      .diff-name[data-diff="Challenge"] { color: #ff4488; }
      .diff-level { font-size: 0.7rem; color: ${THEME.text.muted}; }
      .diff-score { display: flex; align-items: center; gap: 0.5rem; font-size: 0.75rem; }
      .diff-grade { font-weight: 700; font-size: 0.7rem; padding: 0.1rem 0.3rem; border-radius: 3px; }
      .diff-score-value { color: ${THEME.text.secondary}; font-family: 'SF Mono', Monaco, monospace; font-size: 0.7rem; }
      .diff-no-score { font-size: 0.7rem; color: ${THEME.text.muted}; font-style: italic; }

      /* Chart details in stats column */
      .chart-details { padding: 1rem; }
      .chart-header { margin-bottom: 1rem; }
      .chart-info-row { display: flex; gap: 1rem; align-items: center; margin-top: 0.5rem; }
      .diff-badge {
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 600;
      }
      .diff-badge[data-diff="Beginner"],
      .diff-badge[data-diff="Easy"] { background: rgba(136, 255, 136, 0.15); color: #88ff88; }
      .diff-badge[data-diff="Medium"] { background: rgba(255, 255, 68, 0.15); color: #ffff44; }
      .diff-badge[data-diff="Hard"] { background: rgba(255, 136, 68, 0.15); color: #ff8844; }
      .diff-badge[data-diff="Challenge"] { background: rgba(255, 68, 136, 0.15); color: #ff4488; }

      .section-title {
        font-size: 0.65rem;
        color: ${THEME.text.muted};
        letter-spacing: 1px;
        margin: 1.25rem 0 0.5rem 0;
      }

      .best-score-section { margin-top: 1rem; }
      .best-score-row { display: flex; align-items: center; gap: 1rem; }
      .best-grade-large {
        font-size: 1.5rem;
        font-weight: 700;
        padding: 0.5rem 0.75rem;
        border-radius: 6px;
      }
      .best-details { flex: 1; }
      .best-score-value { font-size: 1.1rem; font-weight: 600; }
      .best-meta { font-size: 0.75rem; color: ${THEME.text.secondary}; margin-top: 0.25rem; display: flex; gap: 1rem; }

      .no-score {
        margin-top: 1rem;
        padding: 1rem;
        background: ${THEME.bg.tertiary};
        border-radius: 6px;
        text-align: center;
        color: ${THEME.text.muted};
        font-size: 0.85rem;
      }

      .stats-section { margin-top: 1rem; }
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.75rem;
      }

      /* Groove Radar */
      .radar-section { margin-top: 1.25rem; }
      .radar-container {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 0.5rem;
      }
      .radar-canvas {
        max-width: 100%;
      }

      .stat-item {
        background: ${THEME.bg.tertiary};
        padding: 0.6rem;
        border-radius: 6px;
        text-align: center;
      }

      .stat-value { font-size: 1rem; font-weight: 700; display: block; }
      .stat-label { font-size: 0.6rem; color: ${THEME.text.muted}; text-transform: uppercase; }

      .footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid ${THEME.bg.tertiary};
      }

      .cmod-selector {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .cmod-selector .label {
        font-size: 0.75rem;
        color: ${THEME.text.secondary};
      }

      .cmod-options { display: flex; gap: 0.2rem; }

      .cmod-option {
        padding: 0.3rem 0.5rem;
        background: ${THEME.bg.secondary};
        border-radius: 4px;
        font-size: 0.7rem;
        font-weight: 600;
        color: ${THEME.text.secondary};
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .cmod-option:hover { background: ${THEME.bg.tertiary}; }
      .cmod-option.selected {
        background: rgba(0, 212, 255, 0.15);
        color: ${THEME.accent.primary};
      }

      .nav-hint {
        display: flex;
        gap: 1.5rem;
        font-size: 0.75rem;
        color: ${THEME.text.muted};
      }

      .demo-hint { color: ${THEME.accent.secondary}; font-weight: 600; }
    </style>`;
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
