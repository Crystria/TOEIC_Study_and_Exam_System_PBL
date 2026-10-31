import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EtsScoreTable, loadEtsScoreTable, lookupEtsScore } from './ets-score-table';

export const SCORE_DISCLAIMER =
  'Điểm quy đổi chỉ mang tính tham khảo, không phải điểm ETS chính thức.';
export interface PartStat {
  part: number;
  skill: 'LISTENING' | 'READING';
  totalQuestions: number;
  correctCount: number;
  accuracy: number;
}
export function partStats(
  questions: { part: number; correctOption: string; questionId: string }[],
  choices: Map<string, string | null>,
): PartStat[] {
  return [...new Set(questions.map((q) => q.part))]
    .sort((a, b) => a - b)
    .map((part) => {
      const members = questions.filter((q) => q.part === part);
      const correctCount = members.filter(
        (q) => choices.get(q.questionId) === q.correctOption,
      ).length;
      return {
        part,
        skill: part <= 4 ? 'LISTENING' : 'READING',
        totalQuestions: members.length,
        correctCount,
        accuracy: correctCount / members.length,
      };
    });
}
@Injectable()
export class ScoringService {
  readonly listening: EtsScoreTable;
  readonly reading: EtsScoreTable;
  constructor(config: ConfigService) {
    const load = (skill: 'listening' | 'reading') => {
      try {
        return loadEtsScoreTable(skill);
      } catch (error) {
        if (
          config.get<string>('NODE_ENV') === 'production' ||
          config.get<string>('ETS_ALLOW_DEV_FALLBACK') !== 'true'
        )
          throw error;
        return {
          version: 'dev-formula',
          official: false,
          source: 'Development fallback',
          table: Array.from({ length: 101 }, (_, raw) => 5 * Math.round((5 + 4.9 * raw) / 5)),
        };
      }
    };
    this.listening = load('listening');
    this.reading = load('reading');
  }
  full(stats: PartStat[]) {
    const correctListeningCount = stats
      .filter((p) => p.skill === 'LISTENING')
      .reduce((n, p) => n + p.correctCount, 0);
    const correctReadingCount = stats
      .filter((p) => p.skill === 'READING')
      .reduce((n, p) => n + p.correctCount, 0);
    const scoreListening = lookupEtsScore(this.listening, correctListeningCount),
      scoreReading = lookupEtsScore(this.reading, correctReadingCount);
    return {
      scoreListening,
      scoreReading,
      totalScore: scoreListening + scoreReading,
      correctListeningCount,
      correctReadingCount,
    };
  }
}
