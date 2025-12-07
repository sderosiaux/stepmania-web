import { describe, it, expect } from 'vitest';
import { parseStpFile, beatToTime, timeToBeat } from '../../../src/parser';

describe('Step File Parser', () => {
  describe('Header Parsing', () => {
    it('parses required headers', () => {
      const content = `
#TITLE:Test Song
#BPM:120
#MUSIC:song.mp3

//--- CHART: Easy (Level 1) ---
L...
....
....
....
,
`;
      const { song, errors } = parseStpFile(content, 'test');

      expect(song).not.toBeNull();
      expect(song!.title).toBe('Test Song');
      expect(song!.bpm).toBe(120);
      expect(song!.musicFile).toBe('song.mp3');
    });

    it('parses optional headers', () => {
      const content = `
#TITLE:Test Song
#ARTIST:Test Artist
#BPM:140
#OFFSET:0.150
#MUSIC:song.mp3

//--- CHART: Easy (Level 1) ---
L...
,
`;
      const { song } = parseStpFile(content, 'test');

      expect(song!.artist).toBe('Test Artist');
      expect(song!.offset).toBe(150); // Converted to ms
    });

    it('returns error for missing required header', () => {
      const content = `
#TITLE:Test Song
#MUSIC:song.mp3

//--- CHART: Easy (Level 1) ---
L...
,
`;
      const { song, errors } = parseStpFile(content, 'test');

      expect(song).toBeNull();
      expect(errors.some((e) => e.message.includes('BPM'))).toBe(true);
    });

    it('returns error for invalid BPM', () => {
      const content = `
#TITLE:Test
#BPM:-50
#MUSIC:song.mp3

//--- CHART: Easy (Level 1) ---
L...
,
`;
      const { song, errors } = parseStpFile(content, 'test');

      expect(song).toBeNull();
      expect(errors.some((e) => e.message.includes('positive'))).toBe(true);
    });
  });

  describe('Note Parsing', () => {
    it('parses quarter notes (4 rows per measure)', () => {
      const content = `
#TITLE:Test
#BPM:120
#MUSIC:song.mp3

//--- CHART: Easy (Level 1) ---
L...
....
...R
....
,
`;
      const { song } = parseStpFile(content, 'test');
      const notes = song!.charts[0]!.notes;

      expect(notes).toHaveLength(2);
      expect(notes[0]!.direction).toBe('left');
      expect(notes[0]!.time).toBe(0);
      expect(notes[1]!.direction).toBe('right');
      expect(notes[1]!.time).toBe(1000); // 2 beats at 120 BPM = 1000ms
    });

    it('parses eighth notes (8 rows per measure)', () => {
      const content = `
#TITLE:Test
#BPM:120
#MUSIC:song.mp3

//--- CHART: Easy (Level 1) ---
L...
....
...R
....
.D..
....
..U.
....
,
`;
      const { song } = parseStpFile(content, 'test');
      const notes = song!.charts[0]!.notes;

      expect(notes).toHaveLength(4);
      expect(notes[0]!.time).toBe(0);
      expect(notes[1]!.time).toBe(500); // 1 beat
      expect(notes[2]!.time).toBe(1000); // 2 beats
      expect(notes[3]!.time).toBe(1500); // 3 beats
    });

    it('parses jumps (multiple arrows same row)', () => {
      const content = `
#TITLE:Test
#BPM:120
#MUSIC:song.mp3

//--- CHART: Easy (Level 1) ---
L..R
....
....
....
,
`;
      const { song } = parseStpFile(content, 'test');
      const notes = song!.charts[0]!.notes;

      expect(notes).toHaveLength(2);
      expect(notes[0]!.time).toBe(notes[1]!.time);
      expect(notes.map((n) => n.direction).sort()).toEqual(['left', 'right']);
    });

    it('parses quad (all four arrows)', () => {
      const content = `
#TITLE:Test
#BPM:120
#MUSIC:song.mp3

//--- CHART: Easy (Level 1) ---
LDUR
....
....
....
,
`;
      const { song } = parseStpFile(content, 'test');
      const notes = song!.charts[0]!.notes;

      expect(notes).toHaveLength(4);
      expect(new Set(notes.map((n) => n.time)).size).toBe(1);
    });

    it('handles empty measures', () => {
      const content = `
#TITLE:Test
#BPM:120
#MUSIC:song.mp3

//--- CHART: Easy (Level 1) ---
....
....
....
....
,
L...
....
....
....
,
`;
      const { song } = parseStpFile(content, 'test');
      const notes = song!.charts[0]!.notes;

      expect(notes).toHaveLength(1);
      expect(notes[0]!.time).toBe(2000); // After 4 beats = 1 measure
    });

    it('returns error for invalid row length', () => {
      const content = `
#TITLE:Test
#BPM:120
#MUSIC:song.mp3

//--- CHART: Easy (Level 1) ---
L..
....
....
....
,
`;
      const { errors } = parseStpFile(content, 'test');

      expect(errors.some((e) => e.message.includes('4 characters'))).toBe(true);
    });

    it('returns error for invalid characters', () => {
      const content = `
#TITLE:Test
#BPM:120
#MUSIC:song.mp3

//--- CHART: Easy (Level 1) ---
LXUR
....
....
....
,
`;
      const { errors } = parseStpFile(content, 'test');

      expect(errors.some((e) => e.message.includes('Invalid character'))).toBe(true);
    });
  });

  describe('Chart Parsing', () => {
    it('parses difficulty declaration', () => {
      const content = `
#TITLE:Test
#BPM:120
#MUSIC:song.mp3

//--- CHART: Hard (Level 12) ---
L...
,
`;
      const { song } = parseStpFile(content, 'test');

      expect(song!.charts[0]!.difficulty).toBe('Hard');
      expect(song!.charts[0]!.level).toBe(12);
    });

    it('parses multiple charts', () => {
      const content = `
#TITLE:Test
#BPM:120
#MUSIC:song.mp3

//--- CHART: Easy (Level 3) ---
L...
,

//--- CHART: Hard (Level 10) ---
L...
.D..
..U.
...R
,
`;
      const { song } = parseStpFile(content, 'test');

      expect(song!.charts).toHaveLength(2);
      expect(song!.charts[0]!.difficulty).toBe('Easy');
      expect(song!.charts[1]!.difficulty).toBe('Hard');
    });
  });

  describe('Timing Calculations', () => {
    it('converts beat to time correctly at 120 BPM', () => {
      expect(beatToTime(0, 120)).toBe(0);
      expect(beatToTime(1, 120)).toBe(500);
      expect(beatToTime(4, 120)).toBe(2000);
    });

    it('applies offset correctly', () => {
      expect(beatToTime(0, 120, 100)).toBe(100);
      expect(beatToTime(1, 120, 100)).toBe(600);
    });

    it('converts time to beat correctly', () => {
      expect(timeToBeat(0, 120)).toBe(0);
      expect(timeToBeat(500, 120)).toBe(1);
      expect(timeToBeat(2000, 120)).toBe(4);
    });
  });
});
