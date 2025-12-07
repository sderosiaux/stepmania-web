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
    bpm: 120,
    offset: 0,
    musicFile: 'silence.mp3',
    previewStart: 0,
    charts: [
      {
        difficulty: 'Easy',
        level: 3,
        notes: generateDemoNotes(120, 16), // 16 measures
      },
    ],
  };
}

/**
 * Generate demo notes for testing
 */
function generateDemoNotes(bpm: number, measures: number): import('../types').Note[] {
  const notes: import('../types').Note[] = [];
  const msPerBeat = 60000 / bpm;
  const directions: import('../types').Direction[] = ['left', 'down', 'up', 'right'];

  let noteId = 0;

  for (let measure = 0; measure < measures; measure++) {
    // Quarter notes for first few measures
    if (measure < 4) {
      for (let beat = 0; beat < 4; beat++) {
        const time = (measure * 4 + beat) * msPerBeat;
        notes.push({
          id: noteId++,
          time,
          direction: directions[beat % 4]!,
          judged: false,
        });
      }
    }
    // Eighth notes for middle measures
    else if (measure < 12) {
      for (let eighth = 0; eighth < 8; eighth++) {
        const time = (measure * 4 + eighth * 0.5) * msPerBeat;
        notes.push({
          id: noteId++,
          time,
          direction: directions[eighth % 4]!,
          judged: false,
        });
      }
    }
    // Add some jumps in later measures
    else {
      for (let beat = 0; beat < 4; beat++) {
        const time = (measure * 4 + beat) * msPerBeat;

        if (beat % 2 === 0) {
          // Jump
          notes.push({
            id: noteId++,
            time,
            direction: 'left',
            judged: false,
          });
          notes.push({
            id: noteId++,
            time,
            direction: 'right',
            judged: false,
          });
        } else {
          // Single
          notes.push({
            id: noteId++,
            time,
            direction: directions[beat]!,
            judged: false,
          });
        }
      }
    }
  }

  return notes;
}
