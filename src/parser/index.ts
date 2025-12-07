import type { Song, Chart, Note, Direction, Difficulty } from '../types';

// ============================================================================
// Parser Types
// ============================================================================

interface ParsedHeader {
  title?: string;
  artist?: string;
  bpm?: number;
  offset?: number;
  music?: string;
  preview?: number;
}

interface ParserError {
  line: number;
  message: string;
}

// ============================================================================
// Constants
// ============================================================================

const CHAR_TO_DIRECTION: Record<string, Direction> = {
  L: 'left',
  D: 'down',
  U: 'up',
  R: 'right',
};

const VALID_CHARS = new Set(['.', 'L', 'D', 'U', 'R']);
const VALID_DIFFICULTIES = new Set<Difficulty>(['Beginner', 'Easy', 'Medium', 'Hard', 'Challenge']);
const VALID_MEASURE_LENGTHS = new Set([4, 8, 12, 16, 24, 32, 48, 64, 96, 192]);

// ============================================================================
// Header Parsing
// ============================================================================

function parseHeader(line: string): [string, string] | null {
  if (!line.startsWith('#')) return null;
  const colonIndex = line.indexOf(':');
  if (colonIndex === -1) return null;

  const key = line.slice(1, colonIndex).toUpperCase();
  const value = line.slice(colonIndex + 1).trim();
  return [key, value];
}

function parseHeaders(lines: string[]): { headers: ParsedHeader; errors: ParserError[] } {
  const headers: ParsedHeader = {};
  const errors: ParserError[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? '';
    if (!line.startsWith('#')) continue;

    const parsed = parseHeader(line);
    if (!parsed) {
      errors.push({ line: i + 1, message: `Invalid header format: ${line}` });
      continue;
    }

    const [key, value] = parsed;

    switch (key) {
      case 'TITLE':
        headers.title = value;
        break;
      case 'ARTIST':
        headers.artist = value || 'Unknown';
        break;
      case 'BPM': {
        const bpm = parseFloat(value);
        if (isNaN(bpm) || bpm <= 0) {
          errors.push({ line: i + 1, message: `Invalid BPM: ${value}. Must be a positive number.` });
        } else {
          headers.bpm = bpm;
        }
        break;
      }
      case 'OFFSET': {
        const offset = parseFloat(value);
        if (isNaN(offset)) {
          errors.push({ line: i + 1, message: `Invalid offset: ${value}` });
        } else {
          // Convert seconds to milliseconds
          headers.offset = offset * 1000;
        }
        break;
      }
      case 'MUSIC':
        headers.music = value;
        break;
      case 'PREVIEW': {
        const preview = parseFloat(value);
        if (!isNaN(preview)) {
          headers.preview = preview;
        }
        break;
      }
    }
  }

  return { headers, errors };
}

// ============================================================================
// Chart Declaration Parsing
// ============================================================================

const CHART_HEADER_REGEX = /^\/\/---\s*CHART:\s*(\w+)\s*\(Level\s*(\d+)\)\s*---$/i;

function parseChartDeclaration(line: string): { difficulty: Difficulty; level: number } | null {
  const match = line.match(CHART_HEADER_REGEX);
  if (!match) return null;

  const difficultyStr = match[1];
  const level = parseInt(match[2] ?? '1', 10);

  // Normalize difficulty name
  const difficulty = difficultyStr
    ? (difficultyStr.charAt(0).toUpperCase() + difficultyStr.slice(1).toLowerCase()) as Difficulty
    : 'Easy';

  if (!VALID_DIFFICULTIES.has(difficulty)) {
    return null;
  }

  return { difficulty, level: Math.max(1, Math.min(20, level)) };
}

// ============================================================================
// Note Row Parsing
// ============================================================================

function validateNoteRow(row: string, lineNum: number): ParserError | null {
  if (row.length !== 4) {
    return { line: lineNum, message: `Invalid row length: expected 4 characters, got ${row.length}` };
  }

  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char && !VALID_CHARS.has(char)) {
      return { line: lineNum, message: `Invalid character '${char}' at position ${i + 1}` };
    }
  }

  return null;
}

function parseNoteRow(row: string): Direction[] {
  const directions: Direction[] = [];

  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char && char !== '.') {
      const direction = CHAR_TO_DIRECTION[char];
      if (direction) {
        directions.push(direction);
      }
    }
  }

  return directions;
}

// ============================================================================
// Measure Processing
// ============================================================================

function processMeasure(
  measureRows: string[],
  measureIndex: number,
  bpm: number,
  offset: number,
  noteIdStart: number
): { notes: Note[]; errors: ParserError[] } {
  const notes: Note[] = [];
  const errors: ParserError[] = [];

  const rowCount = measureRows.length;

  // Validate measure length
  if (!VALID_MEASURE_LENGTHS.has(rowCount)) {
    // Allow any reasonable measure length, just warn
    if (rowCount < 1 || rowCount > 192) {
      errors.push({
        line: 0,
        message: `Unusual measure length: ${rowCount} rows`,
      });
    }
  }

  // Calculate ms per beat (quarter note)
  const msPerBeat = 60000 / bpm;

  let noteId = noteIdStart;

  for (let rowIndex = 0; rowIndex < measureRows.length; rowIndex++) {
    const row = measureRows[rowIndex];
    if (!row) continue;

    const directions = parseNoteRow(row);

    if (directions.length > 0) {
      // Calculate time for this row
      const beatInMeasure = (rowIndex / rowCount) * 4;
      const time = offset + (measureIndex * 4 + beatInMeasure) * msPerBeat;

      for (const direction of directions) {
        notes.push({
          id: noteId++,
          time,
          direction,
          type: 'tap',
          judged: false,
        });
      }
    }
  }

  return { notes, errors };
}

// ============================================================================
// Main Parser
// ============================================================================

export interface ParseResult {
  song: Song | null;
  errors: ParserError[];
}

export function parseStpFile(content: string, songId: string): ParseResult {
  const lines = content.split(/\r?\n/);
  const errors: ParserError[] = [];

  // Parse headers
  const { headers, errors: headerErrors } = parseHeaders(lines);
  errors.push(...headerErrors);

  // Validate required headers
  if (!headers.title) {
    errors.push({ line: 0, message: 'Missing required header: TITLE' });
  }
  if (!headers.bpm) {
    errors.push({ line: 0, message: 'Missing required header: BPM' });
  }
  if (!headers.music) {
    errors.push({ line: 0, message: 'Missing required header: MUSIC' });
  }

  if (!headers.title || !headers.bpm || !headers.music) {
    return { song: null, errors };
  }

  // Parse charts
  const charts: Chart[] = [];
  let currentChart: { difficulty: Difficulty; level: number; notes: Note[] } | null = null;
  let currentMeasure: { rows: string[]; startLine: number } = { rows: [], startLine: 0 };
  let measureIndex = 0;
  let noteId = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;

    const trimmed = line.trim();

    // Skip empty lines and regular comments
    if (!trimmed || (trimmed.startsWith('//') && !trimmed.includes('CHART:'))) {
      continue;
    }

    // Skip headers
    if (trimmed.startsWith('#')) {
      continue;
    }

    // Check for chart declaration
    if (trimmed.startsWith('//---')) {
      // Save previous chart if exists
      if (currentChart) {
        // Process final measure if not empty
        if (currentMeasure.rows.length > 0) {
          const { notes, errors: measureErrors } = processMeasure(
            currentMeasure.rows,
            measureIndex,
            headers.bpm,
            headers.offset ?? 0,
            noteId
          );
          currentChart.notes.push(...notes);
          noteId += notes.length;
          measureErrors.forEach((e) => {
            e.line = e.line || currentMeasure.startLine;
            errors.push(e);
          });
        }

        charts.push({
          difficulty: currentChart.difficulty,
          level: currentChart.level,
          notes: currentChart.notes.sort((a, b) => a.time - b.time),
        });
      }

      const chartDecl = parseChartDeclaration(trimmed);
      if (chartDecl) {
        currentChart = {
          difficulty: chartDecl.difficulty,
          level: chartDecl.level,
          notes: [],
        };
        currentMeasure = { rows: [], startLine: i + 1 };
        measureIndex = 0;
        noteId = 0;
      } else {
        errors.push({ line: i + 1, message: `Invalid chart declaration: ${trimmed}` });
      }
      continue;
    }

    // Measure separator
    if (trimmed === ',') {
      if (currentChart && currentMeasure.rows.length > 0) {
        const { notes, errors: measureErrors } = processMeasure(
          currentMeasure.rows,
          measureIndex,
          headers.bpm,
          headers.offset ?? 0,
          noteId
        );
        currentChart.notes.push(...notes);
        noteId += notes.length;
        measureErrors.forEach((e) => {
          e.line = e.line || currentMeasure.startLine;
          errors.push(e);
        });
      }
      measureIndex++;
      currentMeasure = { rows: [], startLine: i + 1 };
      continue;
    }

    // Note row
    if (trimmed.length === 4 && currentChart) {
      const rowError = validateNoteRow(trimmed, i + 1);
      if (rowError) {
        errors.push(rowError);
      } else {
        currentMeasure.rows.push(trimmed);
      }
    }
  }

  // Save final chart
  if (currentChart) {
    // Process final measure if not empty
    if (currentMeasure.rows.length > 0) {
      const { notes, errors: measureErrors } = processMeasure(
        currentMeasure.rows,
        measureIndex,
        headers.bpm,
        headers.offset ?? 0,
        noteId
      );
      currentChart.notes.push(...notes);
      measureErrors.forEach((e) => {
        e.line = e.line || currentMeasure.startLine;
        errors.push(e);
      });
    }

    charts.push({
      difficulty: currentChart.difficulty,
      level: currentChart.level,
      notes: currentChart.notes.sort((a, b) => a.time - b.time),
    });
  }

  if (charts.length === 0) {
    errors.push({ line: 0, message: 'No valid charts found in file' });
    return { song: null, errors };
  }

  const song: Song = {
    id: songId,
    title: headers.title,
    artist: headers.artist ?? 'Unknown',
    bpm: headers.bpm,
    offset: headers.offset ?? 0,
    musicFile: headers.music,
    previewStart: headers.preview ?? 0,
    charts,
  };

  return { song, errors };
}

// ============================================================================
// Utility Functions
// ============================================================================

/** Calculate time in ms for a given beat at a specific BPM */
export function beatToTime(beat: number, bpm: number, offset: number = 0): number {
  const msPerBeat = 60000 / bpm;
  return offset + beat * msPerBeat;
}

/** Calculate beat for a given time at a specific BPM */
export function timeToBeat(time: number, bpm: number, offset: number = 0): number {
  const msPerBeat = 60000 / bpm;
  return (time - offset) / msPerBeat;
}
