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
    pack: 'Tutorial',
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
 * Create all demo songs organized into packs
 */
export function createDemoSongs(): Song[] {
  return [
    // Tutorial Pack
    {
      id: 'tutorial-basics',
      title: 'First Steps',
      artist: 'Tutorial',
      bpm: 80,
      offset: 0,
      musicFile: 'silence.mp3',
      previewStart: 0,
      pack: 'Tutorial',
      charts: [
        { difficulty: 'Beginner', level: 1, notes: generateDemoNotes(80, 4) },
      ],
    },
    {
      id: 'tutorial-rhythm',
      title: 'Finding the Beat',
      artist: 'Tutorial',
      bpm: 100,
      offset: 0,
      musicFile: 'silence.mp3',
      previewStart: 0,
      pack: 'Tutorial',
      charts: [
        { difficulty: 'Beginner', level: 2, notes: generateDemoNotes(100, 6) },
        { difficulty: 'Easy', level: 3, notes: generateDemoNotes(100, 8) },
      ],
    },

    // Dance Classics Pack
    {
      id: 'neon-nights',
      title: 'Neon Nights',
      artist: 'Digital Dreams',
      bpm: 128,
      offset: 0,
      musicFile: 'silence.mp3',
      previewStart: 0,
      pack: 'Dance Classics',
      charts: [
        { difficulty: 'Easy', level: 3, notes: generateDemoNotes(128, 8) },
        { difficulty: 'Medium', level: 5, notes: generatePatternNotes(128, 8, 'streams') },
        { difficulty: 'Hard', level: 8, notes: generatePatternNotes(128, 12, 'jumps') },
      ],
    },
    {
      id: 'starlight-express',
      title: 'Starlight Express',
      artist: 'Cosmic Beats',
      bpm: 140,
      offset: 0,
      musicFile: 'silence.mp3',
      previewStart: 0,
      pack: 'Dance Classics',
      charts: [
        { difficulty: 'Medium', level: 6, notes: generatePatternNotes(140, 8, 'streams') },
        { difficulty: 'Hard', level: 9, notes: generatePatternNotes(140, 12, 'mixed') },
      ],
    },
    {
      id: 'electric-dreams',
      title: 'Electric Dreams',
      artist: 'Synthwave Project',
      bpm: 120,
      offset: 0,
      musicFile: 'silence.mp3',
      previewStart: 0,
      pack: 'Dance Classics',
      charts: [
        { difficulty: 'Easy', level: 4, notes: generateDemoNotes(120, 8) },
        { difficulty: 'Medium', level: 7, notes: generatePatternNotes(120, 10, 'streams') },
        { difficulty: 'Challenge', level: 11, notes: generatePatternNotes(120, 12, 'mixed') },
      ],
    },

    // Extreme Pack
    {
      id: 'chaos-theory',
      title: 'Chaos Theory',
      artist: 'Hardcore United',
      bpm: 170,
      offset: 0,
      musicFile: 'silence.mp3',
      previewStart: 0,
      pack: 'Extreme',
      charts: [
        { difficulty: 'Hard', level: 10, notes: generatePatternNotes(170, 10, 'streams') },
        { difficulty: 'Challenge', level: 13, notes: generatePatternNotes(170, 14, 'mixed') },
      ],
    },
    {
      id: 'maximum-velocity',
      title: 'Maximum Velocity',
      artist: 'Speed Demons',
      bpm: 180,
      offset: 0,
      musicFile: 'silence.mp3',
      previewStart: 0,
      pack: 'Extreme',
      charts: [
        { difficulty: 'Hard', level: 11, notes: generatePatternNotes(180, 12, 'jumps') },
        { difficulty: 'Challenge', level: 15, notes: generatePatternNotes(180, 16, 'mixed') },
      ],
    },

    // Chill Vibes Pack
    {
      id: 'sunset-groove',
      title: 'Sunset Groove',
      artist: 'Lofi Studio',
      bpm: 85,
      offset: 0,
      musicFile: 'silence.mp3',
      previewStart: 0,
      pack: 'Chill Vibes',
      charts: [
        { difficulty: 'Beginner', level: 1, notes: generateDemoNotes(85, 6) },
        { difficulty: 'Easy', level: 2, notes: generateDemoNotes(85, 8) },
      ],
    },
    {
      id: 'moonlit-walk',
      title: 'Moonlit Walk',
      artist: 'Ambient Sounds',
      bpm: 90,
      offset: 0,
      musicFile: 'silence.mp3',
      previewStart: 0,
      pack: 'Chill Vibes',
      charts: [
        { difficulty: 'Easy', level: 2, notes: generateDemoNotes(90, 8) },
        { difficulty: 'Medium', level: 4, notes: generatePatternNotes(90, 8, 'streams') },
      ],
    },

    // Freeze Training
    {
      id: 'freeze-training',
      title: 'Freeze Training',
      artist: 'Hold Master',
      bpm: 100,
      offset: 0,
      musicFile: 'silence.mp3',
      previewStart: 0,
      pack: 'Uncategorized',
      charts: [
        { difficulty: 'Easy', level: 3, notes: generatePatternNotes(100, 4, 'freezes') },
        { difficulty: 'Medium', level: 5, notes: generateMixedFreezeNotes(100, 6) },
      ],
    },
  ];
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
        type: 'tap',
        judged: false,
      });
    }
  }

  return notes;
}

/**
 * Generate pattern notes with different styles
 */
function generatePatternNotes(
  bpm: number,
  measures: number,
  pattern: 'streams' | 'jumps' | 'mixed' | 'freezes'
): import('../types').Note[] {
  const notes: import('../types').Note[] = [];
  const msPerBeat = 60000 / bpm;
  const directions: import('../types').Direction[] = ['left', 'down', 'up', 'right'];

  let noteId = 0;

  for (let measure = 0; measure < measures; measure++) {
    for (let beat = 0; beat < 4; beat++) {
      const baseTime = (measure * 4 + beat) * msPerBeat;

      if (pattern === 'streams') {
        // 8th note streams
        notes.push({
          id: noteId++,
          time: baseTime,
          direction: directions[(measure * 4 + beat) % 4]!,
          type: 'tap',
          judged: false,
        });
        notes.push({
          id: noteId++,
          time: baseTime + msPerBeat / 2,
          direction: directions[(measure * 4 + beat + 1) % 4]!,
          type: 'tap',
          judged: false,
        });
      } else if (pattern === 'jumps') {
        // Quarter notes with occasional jumps
        const dir1 = directions[(measure + beat) % 4]!;
        notes.push({
          id: noteId++,
          time: baseTime,
          direction: dir1,
          type: 'tap',
          judged: false,
        });
        // Add jump on beats 0 and 2
        if (beat % 2 === 0) {
          const dir2 = directions[(measure + beat + 2) % 4]!;
          notes.push({
            id: noteId++,
            time: baseTime,
            direction: dir2,
            type: 'tap',
            judged: false,
          });
        }
      } else if (pattern === 'freezes') {
        // Freeze arrows (hold notes) - one per beat
        const duration = msPerBeat * (beat % 2 === 0 ? 1 : 2); // Alternate 1-beat and 2-beat holds
        notes.push({
          id: noteId++,
          time: baseTime,
          direction: directions[(measure + beat) % 4]!,
          type: 'hold',
          duration,
          endTime: baseTime + duration,
          judged: false,
          holdState: {
            isHeld: false,
            started: false,
            completed: false,
            dropped: false,
            progress: 0,
          },
        });
      } else {
        // Mixed pattern - 16th notes with some gaps
        const subBeats = [0, 0.25, 0.5, 0.75];
        for (let i = 0; i < subBeats.length; i++) {
          // Skip some notes for variety
          if ((measure + beat + i) % 3 === 0) continue;
          notes.push({
            id: noteId++,
            time: baseTime + subBeats[i]! * msPerBeat,
            direction: directions[(measure * 8 + beat * 2 + i) % 4]!,
            type: 'tap',
            judged: false,
          });
        }
      }
    }
  }

  return notes;
}

/**
 * Generate mixed notes with taps and freezes
 */
function generateMixedFreezeNotes(bpm: number, measures: number): import('../types').Note[] {
  const notes: import('../types').Note[] = [];
  const msPerBeat = 60000 / bpm;
  const directions: import('../types').Direction[] = ['left', 'down', 'up', 'right'];

  let noteId = 0;

  for (let measure = 0; measure < measures; measure++) {
    for (let beat = 0; beat < 4; beat++) {
      const baseTime = (measure * 4 + beat) * msPerBeat;
      const dir = directions[(measure + beat) % 4]!;

      // Alternate between taps and holds
      if ((measure + beat) % 3 === 0) {
        // Add a hold note
        const duration = msPerBeat * 1.5;
        notes.push({
          id: noteId++,
          time: baseTime,
          direction: dir,
          type: 'hold',
          duration,
          endTime: baseTime + duration,
          judged: false,
          holdState: {
            isHeld: false,
            started: false,
            completed: false,
            dropped: false,
            progress: 0,
          },
        });
      } else {
        // Add a tap note
        notes.push({
          id: noteId++,
          time: baseTime,
          direction: dir,
          type: 'tap',
          judged: false,
        });
      }
    }
  }

  return notes;
}
