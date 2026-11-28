import { ConfigService } from '@nestjs/config';
import { MessagingService } from '@toeic/common';

describe('RabbitMQ consumer dead letters', () => {
  it('nacks exhausted deliveries to the configured DLX instead of acknowledging and losing them', async () => {
    const service = new MessagingService(new ConfigService());
    const channel = { ack: jest.fn(), nack: jest.fn(), publish: jest.fn() };
    const message = {
      fields: { routingKey: 'question.updated' },
      content: Buffer.from('{}'),
      properties: { headers: { 'x-retry': 3 } },
    };
    await service['dispatch'](
      channel as never,
      message as never,
      jest.fn().mockRejectedValue(new Error('ES unavailable')),
    );
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.publish).not.toHaveBeenCalled();
  });
});
