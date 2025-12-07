import { describe, it, expect } from 'vitest';
import {
  createScoreState,
  getComboMultiplier,
  applyJudgment,
  calculateFinalScore,
  calculatePercentage,
  calculateGrade,
} from '../../../src/core/score';
import type { Judgment } from '../../../src/types';

describe('Score System', () => {
  describe('createScoreState', () => {
    it('initializes with correct values', () => {
      const state = createScoreState(100);

      expect(state.rawScore).toBe(0);
      expect(state.combo).toBe(0);
      expect(state.maxCombo).toBe(0);
      expect(state.totalNotes).toBe(100);
      expect(state.judgmentCounts.marvelous).toBe(0);
    });
  });

  describe('getComboMultiplier', () => {
    it('returns 1x for combo < 10', () => {
      expect(getComboMultiplier(0)).toBe(1);
      expect(getComboMultiplier(5)).toBe(1);
      expect(getComboMultiplier(9)).toBe(1);
    });

    it('returns 2x for combo 10-19', () => {
      expect(getComboMultiplier(10)).toBe(2);
      expect(getComboMultiplier(15)).toBe(2);
      expect(getComboMultiplier(19)).toBe(2);
    });

    it('returns 3x for combo 20-29', () => {
      expect(getComboMultiplier(20)).toBe(3);
      expect(getComboMultiplier(25)).toBe(3);
      expect(getComboMultiplier(29)).toBe(3);
    });

    it('returns 4x (max) for combo 30+', () => {
      expect(getComboMultiplier(30)).toBe(4);
      expect(getComboMultiplier(100)).toBe(4);
      expect(getComboMultiplier(1000)).toBe(4);
    });
  });

  describe('applyJudgment', () => {
    const createJudgment = (grade: Judgment['grade']): Judgment => ({
      noteId: 1,
      timingDiff: 0,
      grade,
      time: 1000,
    });

    it('increments combo on marvelous', () => {
      let state = createScoreState(10);
      state = applyJudgment(state, createJudgment('marvelous'));

      expect(state.combo).toBe(1);
      expect(state.maxCombo).toBe(1);
      expect(state.judgmentCounts.marvelous).toBe(1);
    });

    it('increments combo on perfect', () => {
      let state = createScoreState(10);
      state = applyJudgment(state, createJudgment('perfect'));

      expect(state.combo).toBe(1);
    });

    it('increments combo on great', () => {
      let state = createScoreState(10);
      state = applyJudgment(state, createJudgment('great'));

      expect(state.combo).toBe(1);
    });

    it('increments combo on good', () => {
      let state = createScoreState(10);
      state = applyJudgment(state, createJudgment('good'));

      expect(state.combo).toBe(1);
    });

    it('breaks combo on boo', () => {
      let state = createScoreState(10);
      state.combo = 50;
      state = applyJudgment(state, createJudgment('boo'));

      expect(state.combo).toBe(0);
      expect(state.judgmentCounts.boo).toBe(1);
    });

    it('breaks combo on miss', () => {
      let state = createScoreState(10);
      state.combo = 25;
      state.maxCombo = 25;
      state = applyJudgment(state, createJudgment('miss'));

      expect(state.combo).toBe(0);
      expect(state.maxCombo).toBe(25); // Max combo preserved
      expect(state.judgmentCounts.miss).toBe(1);
    });

    it('tracks max combo correctly', () => {
      let state = createScoreState(10);

      // Build up combo
      for (let i = 0; i < 15; i++) {
        state = applyJudgment(state, createJudgment('marvelous'));
      }
      expect(state.maxCombo).toBe(15);

      // Break combo
      state = applyJudgment(state, createJudgment('miss'));
      expect(state.combo).toBe(0);
      expect(state.maxCombo).toBe(15);

      // Build up again
      for (let i = 0; i < 10; i++) {
        state = applyJudgment(state, createJudgment('marvelous'));
      }
      expect(state.maxCombo).toBe(15); // Still 15

      // Exceed previous max
      for (let i = 0; i < 10; i++) {
        state = applyJudgment(state, createJudgment('marvelous'));
      }
      expect(state.maxCombo).toBe(20); // Now 20
    });
  });

  describe('calculateFinalScore', () => {
    it('returns max score for all marvelous', () => {
      let state = createScoreState(100);

      for (let i = 0; i < 100; i++) {
        state = applyJudgment(state, { noteId: i, timingDiff: 0, grade: 'marvelous', time: i * 100 });
      }

      const score = calculateFinalScore(state);
      expect(score).toBe(1_000_000);
    });

    it('returns 0 for all misses', () => {
      let state = createScoreState(10);

      for (let i = 0; i < 10; i++) {
        state = applyJudgment(state, { noteId: i, timingDiff: 200, grade: 'miss', time: i * 100 });
      }

      const score = calculateFinalScore(state);
      expect(score).toBe(0);
    });

    it('calculates proportional score for mixed judgments', () => {
      let state = createScoreState(4);

      state = applyJudgment(state, { noteId: 0, timingDiff: 0, grade: 'marvelous', time: 0 }); // 100%
      state = applyJudgment(state, { noteId: 1, timingDiff: 30, grade: 'perfect', time: 100 }); // 98%
      state = applyJudgment(state, { noteId: 2, timingDiff: 60, grade: 'great', time: 200 }); // 65%
      state = applyJudgment(state, { noteId: 3, timingDiff: 200, grade: 'miss', time: 300 }); // 0%

      const score = calculateFinalScore(state);
      // (100 + 98 + 65 + 0) / 400 * 1000000 = 657500
      expect(score).toBe(657500);
    });

    it('returns 0 for empty song', () => {
      const state = createScoreState(0);
      expect(calculateFinalScore(state)).toBe(0);
    });
  });

  describe('calculatePercentage', () => {
    it('returns 100 for all marvelous', () => {
      let state = createScoreState(10);
      state.judgmentCounts.marvelous = 10;

      expect(calculatePercentage(state)).toBe(100);
    });

    it('returns 0 for all misses', () => {
      let state = createScoreState(10);
      state.judgmentCounts.miss = 10;

      expect(calculatePercentage(state)).toBe(0);
    });
  });

  describe('calculateGrade', () => {
    it('returns AAA for 100%', () => {
      expect(calculateGrade(100)).toBe('AAA');
    });

    it('returns AA for 93%+', () => {
      expect(calculateGrade(93)).toBe('AA');
      expect(calculateGrade(99)).toBe('AA');
    });

    it('returns A for 80%+', () => {
      expect(calculateGrade(80)).toBe('A');
      expect(calculateGrade(92.9)).toBe('A');
    });

    it('returns B for 65%+', () => {
      expect(calculateGrade(65)).toBe('B');
      expect(calculateGrade(79.9)).toBe('B');
    });

    it('returns C for 45%+', () => {
      expect(calculateGrade(45)).toBe('C');
      expect(calculateGrade(64.9)).toBe('C');
    });

    it('returns D for <45%', () => {
      expect(calculateGrade(44.9)).toBe('D');
      expect(calculateGrade(0)).toBe('D');
    });
  });
});
