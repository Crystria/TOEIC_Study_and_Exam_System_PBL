export interface ListeningAudioQuestion {
  id: string;
  part: number;
  orderNo: number;
  groupId?: string | null;
  audioUrl?: string | null;
}

export interface ListeningAudioGroup {
  id: string;
  audioUrl?: string | null;
  assets?: readonly { kind: string; url?: string | null }[];
}

export interface ListeningAudioTrack {
  id: string;
  source: string;
  label: string;
  questionIds: string[];
}

/** A shared group/full-section recording is played once, in exam question order. */
export function buildListeningAudioTracks(
  questions: readonly ListeningAudioQuestion[],
  groups: readonly ListeningAudioGroup[],
): ListeningAudioTrack[] {
  const groupById = new Map(groups.map((group) => [group.id, group]));
  const tracksBySource = new Map<string, ListeningAudioTrack>();
  const numbersBySource = new Map<string, number[]>();
  const listening = questions
    .filter((question) => question.part >= 1 && question.part <= 4)
    .slice()
    .sort((a, b) => a.orderNo - b.orderNo);

  for (const question of listening) {
    const group = question.groupId ? groupById.get(question.groupId) : undefined;
    const source =
      question.audioUrl ||
      group?.audioUrl ||
      group?.assets?.find((asset) => asset.kind === 'AUDIO' && asset.url)?.url;
    if (!source) continue;

    const existing = tracksBySource.get(source);
    if (existing) {
      existing.questionIds.push(question.id);
      numbersBySource.get(source)!.push(question.orderNo);
    } else {
      tracksBySource.set(source, {
        id: `audio-${question.id}`,
        source,
        label: '',
        questionIds: [question.id],
      });
      numbersBySource.set(source, [question.orderNo]);
    }
  }

  for (const [source, track] of tracksBySource) {
    const numbers = numbersBySource.get(source)!;
    const first = numbers[0];
    const last = numbers[numbers.length - 1];
    track.label = `Audio câu ${first}${numbers.length > 1 ? `–${last}` : ''}`;
  }
  return [...tracksBySource.values()];
}

export interface AudioTimeline {
  offsets: number[];
  durations: number[];
  totalDuration: number;
  complete: boolean;
}

/** Durations remain in seconds, preserving fractional clip boundaries. */
export function buildAudioTimeline(durations: readonly number[]): AudioTimeline {
  const normalized = durations.map((duration) =>
    Number.isFinite(duration) && duration > 0 ? duration : 0,
  );
  let totalDuration = 0;
  const offsets = normalized.map((duration) => {
    const offset = totalDuration;
    totalDuration += duration;
    return offset;
  });
  return {
    offsets,
    durations: normalized,
    totalDuration,
    complete: normalized.length > 0 && normalized.every((duration) => duration > 0),
  };
}

/** A boundary belongs to the next clip; the end belongs to the final clip. */
export function resolveAudioPosition(
  timeline: AudioTimeline,
  seconds: number,
): { trackIndex: number; position: number } | null {
  if (!timeline.complete) return null;
  const position = Math.max(
    0,
    Math.min(timeline.totalDuration, Number.isFinite(seconds) ? seconds : 0),
  );
  let trackIndex = timeline.durations.length - 1;
  for (let index = 0; index < timeline.durations.length - 1; index++) {
    if (position < timeline.offsets[index + 1]) {
      trackIndex = index;
      break;
    }
  }
  return { trackIndex, position: position - timeline.offsets[trackIndex] };
}
