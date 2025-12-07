import { describe, it, expect } from 'vitest';
import {
  calculateJudgment,
  isNoteMissed,
  isNoteJudgeable,
  findMatchingNote,
  judgeNote,
  beatToMs,
  msToBeat,
} from '../../../src/core/timing';
import type { Note } from '../../../src/types';

describe('Timing Engine', () => {
  describe('calculateJudgment', () => {
    it('returns marvelous for 0ms diff', () => {
      expect(calculateJudgment(0)).toBe('marvelous');
    });

    it('returns marvelous for ±22ms', () => {
      expect(calculateJudgment(22)).toBe('marvelous');
      expect(calculateJudgment(-22)).toBe('marvelous');
    });

    it('returns perfect for ±23-45ms', () => {
      expect(calculateJudgment(23)).toBe('perfect');
      expect(calculateJudgment(45)).toBe('perfect');
      expect(calculateJudgment(-23)).toBe('perfect');
      expect(calculateJudgment(-45)).toBe('perfect');
    });

    it('returns great for ±46-90ms', () => {
      expect(calculateJudgment(46)).toBe('great');
      expect(calculateJudgment(90)).toBe('great');
      expect(calculateJudgment(-46)).toBe('great');
      expect(calculateJudgment(-90)).toBe('great');
    });

    it('returns good for ±91-135ms', () => {
      expect(calculateJudgment(91)).toBe('good');
      expect(calculateJudgment(135)).toBe('good');
    });

    it('returns boo for ±136-180ms', () => {
      expect(calculateJudgment(136)).toBe('boo');
      expect(calculateJudgment(180)).toBe('boo');
    });

    it('returns miss for >180ms', () => {
      expect(calculateJudgment(181)).toBe('miss');
      expect(calculateJudgment(500)).toBe('miss');
    });

    it('returns null for too early (before window)', () => {
      expect(calculateJudgment(-181)).toBeNull();
      expect(calculateJudgment(-500)).toBeNull();
    });

    it('has symmetric windows for early and late', () => {
      expect(calculateJudgment(45)).toBe(calculateJudgment(-45));
      expect(calculateJudgment(90)).toBe(calculateJudgment(-90));
      expect(calculateJudgment(135)).toBe(calculateJudgment(-135));
    });
  });

  describe('isNoteMissed', () => {
    it('returns false when note is in the future', () => {
      expect(isNoteMissed(1000, 500)).toBe(false);
    });

    it('returns false when within judgment window', () => {
      expect(isNoteMissed(1000, 1100)).toBe(false);
      expect(isNoteMissed(1000, 1180)).toBe(false);
    });

    it('returns true when past miss window', () => {
      expect(isNoteMissed(1000, 1181)).toBe(true);
      expect(isNoteMissed(1000, 1500)).toBe(true);
    });
  });

  describe('isNoteJudgeable', () => {
    it('returns false when note is too far in the future', () => {
      expect(isNoteJudgeable(1000, 500)).toBe(false);
    });

    it('returns true when within window', () => {
      expect(isNoteJudgeable(1000, 900)).toBe(true);
      expect(isNoteJudgeable(1000, 1000)).toBe(true);
      expect(isNoteJudgeable(1000, 1100)).toBe(true);
    });

    it('returns false when past window', () => {
      expect(isNoteJudgeable(1000, 1200)).toBe(false);
    });
  });

  describe('findMatchingNote', () => {
    const createNote = (id: number, time: number, direction: 'left' | 'down' | 'up' | 'right'): Note => ({
      id,
      time,
      direction,
      judged: false,
    });

    it('finds the closest matching note', () => {
      const notes = [
        createNote(1, 1000, 'left'),
        createNote(2, 1500, 'left'),
        createNote(3, 2000, 'left'),
      ];

      const result = findMatchingNote(notes, 'left', 1020);
      expect(result?.id).toBe(1);
    });

    it('returns null when no notes match direction', () => {
      const notes = [createNote(1, 1000, 'right')];

      const result = findMatchingNote(notes, 'left', 1000);
      expect(result).toBeNull();
    });

    it('skips judged notes', () => {
      const notes = [
        { ...createNote(1, 1000, 'left'), judged: true },
        createNote(2, 1500, 'left'),
      ];

      const result = findMatchingNote(notes, 'left', 1020);
      expect(result?.id).toBe(2);
    });

    it('returns null when note is too early', () => {
      const notes = [createNote(1, 1000, 'left')];

      const result = findMatchingNote(notes, 'left', 500);
      expect(result).toBeNull();
    });

    it('returns null when note is too late', () => {
      const notes = [createNote(1, 1000, 'left')];

      const result = findMatchingNote(notes, 'left', 1500);
      expect(result).toBeNull();
    });
  });

  describe('judgeNote', () => {
    it('creates correct judgment for marvelous', () => {
      const note: Note = { id: 1, time: 1000, direction: 'left', judged: false };
      const judgment = judgeNote(note, 1010);

      expect(judgment.noteId).toBe(1);
      expect(judgment.timingDiff).toBe(10);
      expect(judgment.grade).toBe('marvelous');
    });

    it('creates correct judgment for late hit', () => {
      const note: Note = { id: 1, time: 1000, direction: 'left', judged: false };
      const judgment = judgeNote(note, 1100);

      expect(judgment.timingDiff).toBe(100);
      expect(judgment.grade).toBe('great');
    });

    it('creates correct judgment for early hit', () => {
      const note: Note = { id: 1, time: 1000, direction: 'left', judged: false };
      const judgment = judgeNote(note, 920);

      expect(judgment.timingDiff).toBe(-80);
      expect(judgment.grade).toBe('great');
    });
  });

  describe('Time Conversion', () => {
    describe('beatToMs', () => {
      it('converts beat 0 to 0ms', () => {
        expect(beatToMs(0, 120)).toBe(0);
      });

      it('converts correctly at 120 BPM', () => {
        expect(beatToMs(1, 120)).toBe(500);
        expect(beatToMs(4, 120)).toBe(2000);
      });

      it('converts correctly at 60 BPM', () => {
        expect(beatToMs(1, 60)).toBe(1000);
        expect(beatToMs(4, 60)).toBe(4000);
      });

      it('applies offset correctly', () => {
        expect(beatToMs(0, 120, 100)).toBe(100);
        expect(beatToMs(1, 120, 100)).toBe(600);
      });
    });

    describe('msToBeat', () => {
      it('converts 0ms to beat 0', () => {
        expect(msToBeat(0, 120)).toBe(0);
      });

      it('converts correctly at 120 BPM', () => {
        expect(msToBeat(500, 120)).toBe(1);
        expect(msToBeat(2000, 120)).toBe(4);
      });

      it('handles fractional beats', () => {
        expect(msToBeat(250, 120)).toBe(0.5);
        expect(msToBeat(750, 120)).toBe(1.5);
      });

      it('applies offset correctly', () => {
        expect(msToBeat(100, 120, 100)).toBe(0);
        expect(msToBeat(600, 120, 100)).toBe(1);
      });
    });
  });
});
