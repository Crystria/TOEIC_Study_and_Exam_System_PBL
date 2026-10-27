import { ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { RedisService } from '@toeic/common';
import { AnswerDto } from './dto/attempt.dto';

export interface DraftAnswer {
  selectedOption: string | null;
  answeredAt: string;
}
@Injectable()
export class DraftStore {
  constructor(private readonly redis: RedisService) {}
  private key(id: string) {
    return `exam:draft:${id}`;
  }
  private async call<T>(work: () => Promise<T>): Promise<T> {
    if (this.redis.getClient().status !== 'ready')
      throw new ServiceUnavailableException(
        'Draft storage unavailable; retry with your local answers',
      );
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        work(),
        new Promise<never>((_r, reject) => {
          timer = setTimeout(() => reject(new Error('Redis timeout')), 1000);
        }),
      ]);
    } catch {
      throw new ServiceUnavailableException(
        'Draft storage unavailable; retry with your local answers',
      );
    } finally {
      clearTimeout(timer);
    }
  }
  async read(id: string): Promise<Record<string, DraftAnswer>> {
    const raw = await this.call(() => this.redis.getClient().hgetall(this.key(id)));
    return Object.fromEntries(
      Object.entries(raw).map(([key, value]) => [key, JSON.parse(value) as DraftAnswer]),
    );
  }
  async write(id: string, deadline: Date, answers: AnswerDto[]) {
    const answeredAt = new Date().toISOString();
    const script = `local time = redis.call('TIME')
      local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
      if now >= tonumber(ARGV[1]) then return 0 end
      for i = 3, #ARGV, 2 do redis.call('HSET', KEYS[1], ARGV[i], ARGV[i+1]) end
      redis.call('PEXPIREAT', KEYS[1], ARGV[2])
      return 1`;
    const args = answers.flatMap((a) => [
      a.questionId,
      JSON.stringify({ selectedOption: a.selectedOption, answeredAt }),
    ]);
    const result = await this.call(() =>
      this.redis
        .getClient()
        .eval(script, 1, this.key(id), deadline.getTime(), deadline.getTime() + 3600_000, ...args),
    );
    if (result !== 1) throw new ConflictException('Attempt deadline has passed');
    return answeredAt;
  }
}
