import { ConfigService } from '@nestjs/config';
import { RedisService } from '@toeic/common';
import { MediaService } from './media.service';

describe('media validation and failure handling', () => {
  function setup(status = 'ready') {
    const redis = {
      status,
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
    };
    const service = new MediaService(
      { get: () => undefined } as unknown as ConfigService,
      { getClient: () => redis } as unknown as RedisService,
    );
    jest.spyOn(service['signer'], 'presignedPutObject').mockResolvedValue('http://storage/signed');
    return { service, redis };
  }
  it('limits presigns to matching allowlisted media and the resource namespace', async () => {
    const { service } = setup();
    const result = await service.presign('groups', 3, 'g1', {
      mediaType: 'AUDIO',
      contentType: 'audio/mpeg',
      fileName: 'sample.mp3',
    });
    expect(result.storageKey).toMatch(/^groups\/part-3\/g1\/audio\/.+\.mp3$/);
    expect(result.expiresIn).toBe(300);
    await expect(
      service.presign('groups', 3, 'g1', {
        mediaType: 'AUDIO',
        contentType: 'image/png',
        fileName: 'image.png',
      }),
    ).rejects.toThrow();
    await expect(
      service.presign('groups', 3, 'g1', {
        mediaType: 'AUDIO',
        contentType: 'audio/mpeg',
        fileName: '../audio.mp3',
      }),
    ).rejects.toThrow();
  });
  it('checks object existence and stored MIME before accepting media', async () => {
    const { service } = setup();
    const stat = jest.spyOn(service['client'], 'statObject');
    stat.mockRejectedValueOnce(new Error('not found'));
    await expect(
      service.verify('questions/part-2/q1/audio/a.mp3', 'questions/part-2/q1/', 'AUDIO'),
    ).rejects.toThrow('does not exist');
    stat.mockResolvedValueOnce({ metaData: { 'content-type': 'text/plain' } } as never);
    await expect(
      service.verify('questions/part-2/q1/audio/a.mp3', 'questions/part-2/q1/', 'AUDIO'),
    ).rejects.toThrow('invalid content type');
    await expect(
      service.verify('questions/part-2/q2/audio/a.mp3', 'questions/part-2/q1/', 'AUDIO'),
    ).rejects.toThrow('does not belong');
  });
  it('returns a fresh presign immediately when Redis is disconnected', async () => {
    const { service, redis } = setup('end');
    const result = await service.presign(
      'questions',
      2,
      'q1',
      { mediaType: 'AUDIO', contentType: 'audio/mpeg', fileName: 'sample.mp3' },
      'retry-key',
    );
    expect(result.uploadUrl).toBe('http://storage/signed');
    expect(redis.set).not.toHaveBeenCalled();
  });
  it('bounds Redis idempotency waits to 500ms if the connection stalls', async () => {
    jest.useFakeTimers();
    try {
      const { service, redis } = setup();
      redis.set.mockImplementation(() => new Promise(() => undefined));
      const pending = service.presign(
        'questions',
        2,
        'q1',
        { mediaType: 'AUDIO', contentType: 'audio/mpeg', fileName: 'sample.mp3' },
        'retry-key',
      );
      await jest.advanceTimersByTimeAsync(500);
      expect((await pending).uploadUrl).toBe('http://storage/signed');
    } finally {
      jest.useRealTimers();
    }
  });
});
