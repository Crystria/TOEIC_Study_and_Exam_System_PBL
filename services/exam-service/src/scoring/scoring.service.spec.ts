import { ConfigService } from '@nestjs/config';
import { partStats, ScoringService } from './scoring.service';
describe('Full and Part scoring', () => {
  it('counts blank questions as incorrect and computes per-part ratios', () => {
    const stats = partStats(
      [
        { part: 2, questionId: 'a', correctOption: 'A' },
        { part: 2, questionId: 'b', correctOption: 'B' },
        { part: 5, questionId: 'c', correctOption: 'D' },
      ],
      new Map([
        ['a', 'A'],
        ['c', null],
      ]),
    );
    expect(stats).toEqual([
      { part: 2, skill: 'LISTENING', totalQuestions: 2, correctCount: 1, accuracy: 0.5 },
      { part: 5, skill: 'READING', totalQuestions: 1, correctCount: 0, accuracy: 0 },
    ]);
  });
  it('converts Full 0/100 and 100/100 using the separate ETS tables', () => {
    const scoring = new ScoringService(new ConfigService());
    const stats = (correctCount: number) => [
      {
        part: 1,
        skill: 'LISTENING' as const,
        totalQuestions: 100,
        correctCount,
        accuracy: correctCount / 100,
      },
      {
        part: 5,
        skill: 'READING' as const,
        totalQuestions: 100,
        correctCount,
        accuracy: correctCount / 100,
      },
    ];
    expect(scoring.full(stats(0)).totalScore).toBe(10);
    expect(scoring.full(stats(100))).toMatchObject({
      scoreListening: 495,
      scoreReading: 495,
      totalScore: 990,
    });
  });
});
