import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const ETS_RAW_MIN = 0;
export const ETS_RAW_MAX = 100;
export const ETS_SCALED_MIN = 5;
export const ETS_SCALED_MAX = 495;
export const ETS_SCALED_STEP = 5;

export type EtsSkill = 'listening' | 'reading';

export interface EtsScoreTable {
  version: string;
  official: boolean;
  source: string;
  note?: string;
  table: readonly number[];
}

const ETS_FILES: Record<EtsSkill, string> = {
  listening: 'ets-listening.json',
  reading: 'ets-reading.json',
};

export function loadEtsScoreTable(skill: EtsSkill): EtsScoreTable {
  const filePath = join(__dirname, ETS_FILES[skill]);
  const raw = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
  return validateEtsScoreTable(raw, ETS_FILES[skill]);
}

export function validateEtsScoreTable(value: unknown, label = 'ETS table'): EtsScoreTable {
  if (!value || typeof value !== 'object') {
    throw new Error(`${label}: expected an object`);
  }

  const candidate = value as Partial<EtsScoreTable>;
  if (typeof candidate.version !== 'string' || candidate.version.length === 0) {
    throw new Error(`${label}: missing version`);
  }
  if (typeof candidate.official !== 'boolean') {
    throw new Error(`${label}: official must be boolean`);
  }
  if (typeof candidate.source !== 'string' || candidate.source.length === 0) {
    throw new Error(`${label}: missing source`);
  }
  if (!Array.isArray(candidate.table)) {
    throw new Error(`${label}: table must be an array`);
  }
  if (candidate.table.length !== ETS_RAW_MAX - ETS_RAW_MIN + 1) {
    throw new Error(
      `${label}: expected ${ETS_RAW_MAX - ETS_RAW_MIN + 1} rows, got ${candidate.table.length}`,
    );
  }

  let previous = ETS_SCALED_MIN;
  candidate.table.forEach((score, raw) => {
    if (!Number.isInteger(score)) {
      throw new Error(`${label}: raw ${raw} is not an integer`);
    }
    if (score < ETS_SCALED_MIN || score > ETS_SCALED_MAX) {
      throw new Error(`${label}: raw ${raw} out of range: ${score}`);
    }
    if (score % ETS_SCALED_STEP !== 0) {
      throw new Error(`${label}: raw ${raw} is not a multiple of ${ETS_SCALED_STEP}: ${score}`);
    }
    if (score < previous) {
      throw new Error(`${label}: score decreases at raw ${raw}: ${previous} -> ${score}`);
    }
    previous = score;
  });

  return candidate as EtsScoreTable;
}

export function lookupEtsScore(table: EtsScoreTable, raw: number): number {
  if (!Number.isInteger(raw) || raw < ETS_RAW_MIN || raw > ETS_RAW_MAX) {
    throw new Error(`Raw score must be an integer in ${ETS_RAW_MIN}-${ETS_RAW_MAX}: ${raw}`);
  }
  return table.table[raw];
}
