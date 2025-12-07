import type { Song } from '../types';
import { parseStpFile } from '../parser';

// ============================================================================
// Song Loader
// ============================================================================

/**
 * Load a single song from a directory
 */
export async function loadSong(songId: string): Promise<Song | null> {
  try {
    const chartUrl = `songs/${songId}/chart.stp`;
    const response = await fetch(chartUrl);

    if (!response.ok) {
      console.error(`Failed to load chart: ${chartUrl}`);
      return null;
    }

    const content = await response.text();
    const { song, errors } = parseStpFile(content, songId);

    if (errors.length > 0) {
      console.warn(`Parse warnings for ${songId}:`, errors);
    }

    return song;
  } catch (error) {
    console.error(`Error loading song ${songId}:`, error);
    return null;
  }
}

/**
 * Load all available songs
 * Note: In a real app, this would scan the songs directory or use a manifest
 */
export async function loadAllSongs(): Promise<Song[]> {
  // For now, we'll try to load from a manifest or known song IDs
  // In development, you'd list your song folders here
  const songIds = ['tutorial']; // Add more song IDs as you create them

  const songs: Song[] = [];

  for (const id of songIds) {
    const song = await loadSong(id);
    if (song) {
      songs.push(song);
    }
  }

  return songs;
}

/**
 * Create a demo song for testing (no audio needed)
 */
export function createDemoSong(): Song {
  return {
    id: 'demo',
    title: 'Demo Song',
    artist: 'StepMania Web',
    bpm: 100,
    offset: 0,
    musicFile: 'silence.mp3',
    previewStart: 0,
    charts: [
      {
        difficulty: 'Easy',
        level: 1,
        notes: generateDemoNotes(100, 8), // 8 measures, slower
      },
    ],
  };
}

/**
 * Generate demo notes for testing - simple pattern
 */
function generateDemoNotes(bpm: number, measures: number): import('../types').Note[] {
  const notes: import('../types').Note[] = [];
  const msPerBeat = 60000 / bpm;
  const directions: import('../types').Direction[] = ['left', 'down', 'up', 'right'];

  let noteId = 0;

  for (let measure = 0; measure < measures; measure++) {
    // Simple quarter notes only - one arrow per beat, cycling through directions
    for (let beat = 0; beat < 4; beat++) {
      const time = (measure * 4 + beat) * msPerBeat;
      notes.push({
        id: noteId++,
        time,
        direction: directions[(measure + beat) % 4]!,
        judged: false,
      });
    }
  }

  return notes;
}
