import type { JudgmentGrade, LetterGrade, Judgment, ResultsData, Song, Chart } from '../types';
import { JUDGMENT_SCORES, JUDGMENT_MAINTAINS_COMBO, JUDGMENT_HEALTH, GRADE_THRESHOLDS } from '../types';

// ============================================================================
// Constants
// ============================================================================

const MAX_SCORE = 1_000_000;
const COMBO_MULTIPLIER_THRESHOLDS = [10, 20, 30]; // Combo thresholds for multiplier increases
const MAX_MULTIPLIER = 4;
const INITIAL_HEALTH = 50; // Start at 50%
const MAX_HEALTH = 100;
const MIN_HEALTH = 0;

// ============================================================================
// Score State
// ============================================================================

export interface ScoreState {
  /** Raw accumulated score points */
  rawScore: number;
  /** Maximum possible raw score so far */
  maxPossibleScore: number;
  /** Current combo */
  combo: number;
  /** Maximum combo achieved */
  maxCombo: number;
  /** Count of each judgment type */
  judgmentCounts: Record<JudgmentGrade, number>;
  /** Total notes judged */
  totalJudged: number;
  /** Total notes in chart */
  totalNotes: number;
  /** Current health (0-100) */
  health: number;
  /** Whether player has failed (health reached 0) */
  failed: boolean;
}

/**
 * Create initial score state
 */
export function createScoreState(totalNotes: number): ScoreState {
  return {
    rawScore: 0,
    maxPossibleScore: 0,
    combo: 0,
    maxCombo: 0,
    judgmentCounts: {
      marvelous: 0,
      perfect: 0,
      great: 0,
      good: 0,
      boo: 0,
      miss: 0,
    },
    totalJudged: 0,
    totalNotes,
    health: INITIAL_HEALTH,
    failed: false,
  };
}

// ============================================================================
// Combo Calculation
// ============================================================================

/**
 * Get the current combo multiplier
 */
export function getComboMultiplier(combo: number): number {
  if (combo >= COMBO_MULTIPLIER_THRESHOLDS[2]!) return MAX_MULTIPLIER;
  if (combo >= COMBO_MULTIPLIER_THRESHOLDS[1]!) return 3;
  if (combo >= COMBO_MULTIPLIER_THRESHOLDS[0]!) return 2;
  return 1;
}

// ============================================================================
// Score Updates
// ============================================================================

/**
 * Update score state with a new judgment
 */
export function applyJudgment(state: ScoreState, judgment: Judgment): ScoreState {
  const { grade } = judgment;
  const scoreValue = JUDGMENT_SCORES[grade];
  const maintainsCombo = JUDGMENT_MAINTAINS_COMBO[grade];
  const healthChange = JUDGMENT_HEALTH[grade];

  // Calculate new combo
  const newCombo = maintainsCombo ? state.combo + 1 : 0;
  const newMaxCombo = Math.max(state.maxCombo, newCombo);

  // Calculate score with multiplier
  const multiplier = getComboMultiplier(state.combo);
  const scoreGain = scoreValue * multiplier;

  // Update judgment counts
  const newCounts = { ...state.judgmentCounts };
  newCounts[grade]++;

  // Update health (clamp between 0 and 100)
  const newHealth = Math.max(MIN_HEALTH, Math.min(MAX_HEALTH, state.health + healthChange));
  const hasFailed = newHealth <= MIN_HEALTH;

  return {
    rawScore: state.rawScore + scoreGain,
    maxPossibleScore: state.maxPossibleScore + 100 * MAX_MULTIPLIER,
    combo: newCombo,
    maxCombo: newMaxCombo,
    judgmentCounts: newCounts,
    totalJudged: state.totalJudged + 1,
    totalNotes: state.totalNotes,
    health: newHealth,
    failed: state.failed || hasFailed,
  };
}

// ============================================================================
// Final Score Calculation
// ============================================================================

/**
 * Calculate normalized score (0 to MAX_SCORE)
 */
export function calculateFinalScore(state: ScoreState): number {
  if (state.totalNotes === 0) return 0;

  // Simple percentage-based scoring
  // Each note is worth equal points, weighted by judgment
  const maxRaw = state.totalNotes * 100;
  const actualRaw =
    state.judgmentCounts.marvelous * JUDGMENT_SCORES.marvelous +
    state.judgmentCounts.perfect * JUDGMENT_SCORES.perfect +
    state.judgmentCounts.great * JUDGMENT_SCORES.great +
    state.judgmentCounts.good * JUDGMENT_SCORES.good +
    state.judgmentCounts.boo * JUDGMENT_SCORES.boo +
    state.judgmentCounts.miss * JUDGMENT_SCORES.miss;

  const percentage = actualRaw / maxRaw;
  return Math.round(percentage * MAX_SCORE);
}

/**
 * Calculate percentage (0 to 100)
 */
export function calculatePercentage(state: ScoreState): number {
  if (state.totalNotes === 0) return 0;

  const maxRaw = state.totalNotes * 100;
  const actualRaw =
    state.judgmentCounts.marvelous * JUDGMENT_SCORES.marvelous +
    state.judgmentCounts.perfect * JUDGMENT_SCORES.perfect +
    state.judgmentCounts.great * JUDGMENT_SCORES.great +
    state.judgmentCounts.good * JUDGMENT_SCORES.good +
    state.judgmentCounts.boo * JUDGMENT_SCORES.boo +
    state.judgmentCounts.miss * JUDGMENT_SCORES.miss;

  return (actualRaw / maxRaw) * 100;
}

/**
 * Determine letter grade from percentage
 */
export function calculateGrade(percentage: number, isFullMarvelous: boolean = false): LetterGrade {
  // Full marvelous (all notes are marvelous) gets AAAA
  if (isFullMarvelous && percentage >= 100) {
    return 'AAAA';
  }

  for (const { grade, threshold } of GRADE_THRESHOLDS) {
    if (percentage >= threshold) {
      return grade;
    }
  }
  return 'D';
}

// ============================================================================
// Results Generation
// ============================================================================

/**
 * Generate final results data
 */
export function generateResults(state: ScoreState, song: Song, chart: Chart): ResultsData {
  const percentage = calculatePercentage(state);
  const score = calculateFinalScore(state);

  // Check if all notes were marvelous (full marvelous = AAAA)
  const isFullMarvelous = state.judgmentCounts.marvelous === state.totalNotes;
  const grade = calculateGrade(percentage, isFullMarvelous);

  // Full combo = no judgments below great (no good, boo, or miss)
  const isFullCombo =
    state.judgmentCounts.good === 0 &&
    state.judgmentCounts.boo === 0 &&
    state.judgmentCounts.miss === 0 &&
    state.totalJudged > 0;

  return {
    song,
    chart,
    score,
    grade,
    maxCombo: state.maxCombo,
    judgmentCounts: { ...state.judgmentCounts },
    totalNotes: state.totalNotes,
    percentage,
    failed: state.failed,
    isFullCombo,
  };
}
