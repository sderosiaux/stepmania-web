import type { JudgmentGrade, Note, Judgment, Direction } from '../types';
import { TIMING_WINDOWS } from '../types';

// ============================================================================
// Judgment Calculation
// ============================================================================

/**
 * Determine the judgment grade based on timing difference
 * @param timingDiff - Milliseconds difference (negative = early, positive = late)
 * @returns The judgment grade, or null if too early to judge
 */
export function calculateJudgment(timingDiff: number): JudgmentGrade | null {
  const absDiff = Math.abs(timingDiff);

  // Too early to judge - note hasn't reached the window yet
  if (timingDiff < -TIMING_WINDOWS.boo) {
    return null;
  }

  // Check windows from strictest to loosest
  if (absDiff <= TIMING_WINDOWS.marvelous) {
    return 'marvelous';
  }
  if (absDiff <= TIMING_WINDOWS.perfect) {
    return 'perfect';
  }
  if (absDiff <= TIMING_WINDOWS.great) {
    return 'great';
  }
  if (absDiff <= TIMING_WINDOWS.good) {
    return 'good';
  }
  if (absDiff <= TIMING_WINDOWS.boo) {
    return 'boo';
  }

  return 'miss';
}

/**
 * Check if a note should be marked as missed
 * @param noteTime - The note's target time in ms
 * @param currentTime - Current game time in ms
 * @returns True if the note has passed the miss window
 */
export function isNoteMissed(noteTime: number, currentTime: number): boolean {
  return currentTime - noteTime > TIMING_WINDOWS.boo;
}

/**
 * Check if a note is within the judgeable window
 * @param noteTime - The note's target time in ms
 * @param currentTime - Current game time in ms
 * @returns True if the note can be judged now
 */
export function isNoteJudgeable(noteTime: number, currentTime: number): boolean {
  const diff = currentTime - noteTime;
  return diff >= -TIMING_WINDOWS.boo && diff <= TIMING_WINDOWS.boo;
}

// ============================================================================
// Note Matching
// ============================================================================

/**
 * Find the best matching note for an input
 * @param notes - Array of active (unjudged) notes
 * @param direction - The direction pressed
 * @param currentTime - Current game time in ms
 * @returns The best matching note, or null if none found
 */
export function findMatchingNote(
  notes: Note[],
  direction: Direction,
  currentTime: number
): Note | null {
  let bestNote: Note | null = null;
  let bestDiff = Infinity;

  for (const note of notes) {
    // Skip notes that don't match direction
    if (note.direction !== direction) continue;

    // Skip already judged notes
    if (note.judged) continue;

    // Skip hold notes that have already started
    if (note.type === 'hold' && note.holdState?.started) continue;

    const diff = currentTime - note.time;

    // Skip notes that are too early
    if (diff < -TIMING_WINDOWS.boo) continue;

    // Skip notes that are too late (missed)
    if (diff > TIMING_WINDOWS.boo) continue;

    // Find the closest note
    const absDiff = Math.abs(diff);
    if (absDiff < bestDiff) {
      bestDiff = absDiff;
      bestNote = note;
    }
  }

  return bestNote;
}

/**
 * Create a judgment for a note
 * @param note - The note being judged
 * @param inputTime - When the input was received
 * @returns The judgment result
 */
export function judgeNote(note: Note, inputTime: number): Judgment {
  const timingDiff = inputTime - note.time;
  const grade = calculateJudgment(timingDiff) ?? 'miss';

  return {
    noteId: note.id,
    timingDiff,
    grade,
    time: inputTime,
  };
}

// ============================================================================
// Time Conversion Utilities
// ============================================================================

/**
 * Convert beat number to time in milliseconds
 * @param beat - Beat number (0 = start of song)
 * @param bpm - Beats per minute
 * @param offset - Song offset in ms
 * @returns Time in milliseconds
 */
export function beatToMs(beat: number, bpm: number, offset: number = 0): number {
  const msPerBeat = 60000 / bpm;
  return offset + beat * msPerBeat;
}

/**
 * Convert time in milliseconds to beat number
 * @param ms - Time in milliseconds
 * @param bpm - Beats per minute
 * @param offset - Song offset in ms
 * @returns Beat number
 */
export function msToBeat(ms: number, bpm: number, offset: number = 0): number {
  const msPerBeat = 60000 / bpm;
  return (ms - offset) / msPerBeat;
}

/**
 * Get the current measure and beat within measure
 * @param ms - Time in milliseconds
 * @param bpm - Beats per minute
 * @param offset - Song offset in ms
 * @returns Object with measure index and beat within measure
 */
export function getMeasureInfo(
  ms: number,
  bpm: number,
  offset: number = 0
): { measure: number; beatInMeasure: number } {
  const totalBeats = msToBeat(ms, bpm, offset);
  const measure = Math.floor(totalBeats / 4);
  const beatInMeasure = totalBeats % 4;
  return { measure, beatInMeasure };
}
