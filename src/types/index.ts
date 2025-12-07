// ============================================================================
// Core Game Types
// ============================================================================

/** Arrow directions matching keyboard layout */
export type Direction = 'left' | 'down' | 'up' | 'right';

/** All possible directions as array for iteration */
export const DIRECTIONS: readonly Direction[] = ['left', 'down', 'up', 'right'] as const;

/** Map keyboard keys to directions */
export const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowLeft: 'left',
  ArrowDown: 'down',
  ArrowUp: 'up',
  ArrowRight: 'right',
};

/** Difficulty levels */
export type Difficulty = 'Beginner' | 'Easy' | 'Medium' | 'Hard' | 'Challenge';

/** Judgment grades from best to worst */
export type JudgmentGrade = 'marvelous' | 'perfect' | 'great' | 'good' | 'boo' | 'miss';

/** Letter grades for final score */
export type LetterGrade = 'AAA' | 'AA' | 'A' | 'B' | 'C' | 'D';

// ============================================================================
// Timing Windows (in milliseconds)
// ============================================================================

export const TIMING_WINDOWS: Record<Exclude<JudgmentGrade, 'miss'>, number> = {
  marvelous: 22.5,
  perfect: 45,
  great: 90,
  good: 135,
  boo: 180,
};

/** Score percentages for each judgment */
export const JUDGMENT_SCORES: Record<JudgmentGrade, number> = {
  marvelous: 100,
  perfect: 98,
  great: 65,
  good: 25,
  boo: 0,
  miss: 0,
};

/** Whether judgment maintains combo */
export const JUDGMENT_MAINTAINS_COMBO: Record<JudgmentGrade, boolean> = {
  marvelous: true,
  perfect: true,
  great: true,
  good: true,
  boo: false,
  miss: false,
};

/** Grade thresholds (percentage required) */
export const GRADE_THRESHOLDS: { grade: LetterGrade; threshold: number }[] = [
  { grade: 'AAA', threshold: 100 },
  { grade: 'AA', threshold: 93 },
  { grade: 'A', threshold: 80 },
  { grade: 'B', threshold: 65 },
  { grade: 'C', threshold: 45 },
  { grade: 'D', threshold: 0 },
];

// ============================================================================
// Data Structures
// ============================================================================

/** A single note/arrow in the chart */
export interface Note {
  /** Unique ID for this note */
  id: number;
  /** Time in milliseconds from song start */
  time: number;
  /** Arrow direction */
  direction: Direction;
  /** Whether this note has been judged */
  judged: boolean;
  /** The judgment received (if judged) */
  judgment?: Judgment;
}

/** Result of judging a note */
export interface Judgment {
  /** The note that was judged */
  noteId: number;
  /** Timing difference in ms (negative = early, positive = late) */
  timingDiff: number;
  /** The grade received */
  grade: JudgmentGrade;
  /** Time when judgment occurred */
  time: number;
}

/** A single difficulty chart */
export interface Chart {
  /** Difficulty name */
  difficulty: Difficulty;
  /** Numeric difficulty level (1-20) */
  level: number;
  /** All notes in this chart, sorted by time */
  notes: Note[];
}

/** Complete song data */
export interface Song {
  /** Unique identifier */
  id: string;
  /** Song title */
  title: string;
  /** Artist name */
  artist: string;
  /** Beats per minute */
  bpm: number;
  /** Audio offset in milliseconds */
  offset: number;
  /** Path to music file */
  musicFile: string;
  /** Preview start time in seconds */
  previewStart: number;
  /** Available charts */
  charts: Chart[];
}

// ============================================================================
// Input Types
// ============================================================================

/** A buffered input event */
export interface InputEvent {
  /** Direction pressed */
  direction: Direction;
  /** High-resolution timestamp (performance.now()) */
  timestamp: number;
  /** Whether key is being pressed (true) or released (false) */
  pressed: boolean;
}

// ============================================================================
// Game State Types
// ============================================================================

/** Current screen in the game */
export type GameScreen = 'loading' | 'song-select' | 'gameplay' | 'results' | 'settings';

/** State during gameplay */
export interface GameplayState {
  /** Current song */
  song: Song;
  /** Selected chart */
  chart: Chart;
  /** Active notes (not yet judged) */
  activeNotes: Note[];
  /** All judgments made */
  judgments: Judgment[];
  /** Current score (0-1000000) */
  score: number;
  /** Current combo */
  combo: number;
  /** Max combo achieved */
  maxCombo: number;
  /** Game start time (AudioContext.currentTime when started) */
  startTime: number;
  /** Is game paused */
  paused: boolean;
  /** Has song ended */
  ended: boolean;
}

/** Results after completing a song */
export interface ResultsData {
  /** The song played */
  song: Song;
  /** The chart played */
  chart: Chart;
  /** Final score */
  score: number;
  /** Final grade */
  grade: LetterGrade;
  /** Max combo */
  maxCombo: number;
  /** Judgment counts */
  judgmentCounts: Record<JudgmentGrade, number>;
  /** Total notes */
  totalNotes: number;
  /** Percentage (0-100) */
  percentage: number;
}

/** User settings */
export interface Settings {
  /** Audio offset in ms (positive = audio plays later) */
  audioOffset: number;
  /** Visual offset in ms (positive = arrows appear later) */
  visualOffset: number;
  /** Scroll speed multiplier */
  scrollSpeed: number;
  /** Background dim (0-1) */
  backgroundDim: number;
}

/** Default settings */
export const DEFAULT_SETTINGS: Settings = {
  audioOffset: 0,
  visualOffset: 0,
  scrollSpeed: 1,
  backgroundDim: 0.8,
};
