import { validateEvent } from './event-validation';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';

export interface EventEnvelope<T> {
  eventId: string;
  eventType: string;
  occurredAt: number | string;
  version?: number;
  producer?: string;
  payload: T;
}

export interface ConsumedMessage {
  routingKey: string;
  content: Buffer;
  properties: amqp.MessageProperties;
}

export type MessageHandler = (message: ConsumedMessage) => Promise<void>;

interface Subscription {
  queue: string;
  routingKeys: string[];
  handler: MessageHandler;
  channel?: amqp.Channel;
  consumerTag?: string;
  started?: boolean;
}

const DEFAULT_EXCHANGE = 'toeic.events';
const MAX_RETRIES = 3;
const RECONNECT_DELAY_MS = 5000;

/**
 * RabbitMQ client dùng chung (JSON events).
 *
 * - Exchange `toeic.events` (topic); routing key = tên event.
 * - Mỗi consumer group có queue riêng, bind theo routing key cần thiết.
 * - Manual ack; message lỗi được retry tối đa `MAX_RETRIES` rồi đẩy vào DLQ.
 */
@Injectable()
export class MessagingService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MessagingService.name);
  private readonly url: string;
  private readonly exchange: string;
  private readonly dlx: string;
  private readonly dlq: string;

  private connection?: amqp.ChannelModel;
  private publishChannel?: amqp.ConfirmChannel;
  private closing = false;
  private publishTail: Promise<void> = Promise.resolve();
  private reconnecting = false;
  private readonly subscriptions: Subscription[] = [];

  constructor(config: ConfigService) {
    this.url = config.get<string>('RABBITMQ_URL') ?? 'amqp://toeic:toeic@localhost:5772';
    this.exchange = config.get<string>('RABBITMQ_EXCHANGE') ?? DEFAULT_EXCHANGE;
    this.dlx = `${this.exchange}.dlx`;
    this.dlq = `${this.exchange}.dlq`;
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.connect();
    } catch {
      void this.scheduleReconnect();
    }
  }

  private async connect(): Promise<void> {
    const connection = await amqp.connect(this.url);
    if (this.closing) {
      await connection.close();
      return;
    }
    try {
      connection.on('error', (error: Error) => {
        this.logger.error(`RabbitMQ connection error: ${error.name}`);
      });
      connection.on('close', () => {
        for (const subscription of this.subscriptions) subscription.started = false;
        if (!this.closing) {
          void this.scheduleReconnect();
        }
      });

      const channel = await connection.createConfirmChannel();
      channel.on('error', () => this.logger.error('RabbitMQ publisher channel error'));
      channel.on('close', () => {
        if (!this.closing && this.publishChannel === channel) {
          this.publishChannel = undefined;
          void connection.close().catch(() => undefined);
        }
      });
      await channel.assertExchange(this.exchange, 'topic', { durable: true });
      await channel.assertExchange(this.dlx, 'topic', { durable: true });
      await channel.assertQueue(this.dlq, { durable: true });
      await channel.bindQueue(this.dlq, this.dlx, '#');

      if (this.closing) {
        await connection.close();
        return;
      }
      this.connection = connection;
      this.publishChannel = channel;
      this.logger.log(`RabbitMQ connected`);

      for (const subscription of this.subscriptions) {
        if (!subscription.started) {
          await this.startConsumer(subscription);
        }
      }
    } catch (error) {
      await connection.close().catch(() => undefined);
      throw error;
    }
  }

  private async scheduleReconnect(): Promise<void> {
    if (this.reconnecting || this.closing) {
      return;
    }
    this.reconnecting = true;
    this.logger.warn(`RabbitMQ closed, reconnecting in ${RECONNECT_DELAY_MS}ms`);
    try {
      while (!this.closing) {
        await new Promise((resolve) => setTimeout(resolve, RECONNECT_DELAY_MS));
        if (this.closing) return;
        try {
          await this.connect();
          return;
        } catch {
          this.logger.warn('RabbitMQ reconnect failed; retrying');
        }
      }
    } finally {
      this.reconnecting = false;
    }
  }

  async emit<T>(routingKey: string, key: string, envelope: EventEnvelope<T>): Promise<void> {
    if (
      (envelope.version !== undefined || routingKey.endsWith('.v2')) &&
      validateEvent(envelope) !== routingKey
    )
      throw new Error('Event routing key mismatch');
    await this.confirmedPublish(this.exchange, routingKey, Buffer.from(JSON.stringify(envelope)), {
      persistent: true,
      contentType: 'application/json',
      messageId: envelope.eventId,
      timestamp: Math.floor(
        (typeof envelope.occurredAt === 'number'
          ? envelope.occurredAt
          : Date.parse(envelope.occurredAt)) / 1000,
      ),
      headers: { 'x-routing-key': routingKey, 'x-aggregate-id': key },
    });
  }

  private confirmedPublish(
    exchange: string,
    route: string,
    body: Buffer,
    options: amqp.Options.Publish,
  ): Promise<void> {
    const operation = this.publishTail.then(async () => {
      if (this.closing) throw new Error('Messaging is closing');
      const channel = this.publishChannel;
      if (!channel) throw new Error('RabbitMQ unavailable');
      let returned = false;
      const onReturn = () => {
        returned = true;
      };
      channel.on('return', onReturn);
      let timeout: NodeJS.Timeout | undefined;
      try {
        channel.publish(exchange, route, body, { ...options, mandatory: true });
        await Promise.race([
          channel.waitForConfirms(),
          new Promise<never>((_, reject) => {
            timeout = setTimeout(() => reject(new Error('Publisher confirm timeout')), 10000);
          }),
        ]);
        if (returned) throw new Error('Unroutable message');
      } finally {
        clearTimeout(timeout);
        channel.removeListener('return', onReturn);
      }
    });
    this.publishTail = operation.catch(() => undefined);
    return operation;
  }

  async subscribe(
    queue: string,
    routingKeys: string | string[],
    handler: MessageHandler,
  ): Promise<void> {
    const subscription: Subscription = {
      queue,
      routingKeys: Array.isArray(routingKeys) ? routingKeys : [routingKeys],
      handler,
    };
    this.subscriptions.push(subscription);

    if (this.connection) {
      await this.startConsumer(subscription);
    } else {
      this.logger.warn(
        `RabbitMQ chưa sẵn sàng, queue "${queue}" sẽ được đăng ký sau khi connect xong`,
      );
    }
  }

  /** Durable holding queue (e.g. an outbox DLQ), without an automatic consumer. */
  async declareQueue(queue: string, routingKey: string): Promise<void> {
    if (!this.publishChannel) throw new Error('RabbitMQ publish channel is not ready');
    await this.publishChannel.assertQueue(queue, { durable: true });
    await this.publishChannel.bindQueue(queue, this.exchange, routingKey);
  }

  /** Provision V2 consumer topology before enabling its producer (ADR 0023). */
  async declareConsumerQueue(queue: string, routingKeys: string[]): Promise<void> {
    if (!queue.endsWith('.v2')) throw new Error('Expected a versioned V2 consumer queue');
    if (!this.publishChannel) throw new Error('RabbitMQ publish channel is not ready');
    await this.publishChannel.assertQueue(queue, {
      durable: true,
      arguments: { 'x-dead-letter-exchange': this.dlx, 'x-dead-letter-routing-key': queue },
    });
    for (const key of routingKeys) await this.publishChannel.bindQueue(queue, this.exchange, key);
  }

  private async startConsumer(subscription: Subscription): Promise<void> {
    if (subscription.started) {
      return;
    }
    subscription.started = true;
    const channel = await this.connection!.createChannel();
    channel.on('error', () => {
      subscription.started = false;
      void this.connection?.close().catch(() => undefined);
    });
    await channel.prefetch(10);
    await channel.assertQueue(subscription.queue, {
      durable: true,
      arguments: subscription.queue.endsWith('.v2')
        ? { 'x-dead-letter-exchange': this.dlx, 'x-dead-letter-routing-key': subscription.queue }
        : { 'x-dead-letter-exchange': this.dlx },
    });
    for (const routingKey of subscription.routingKeys) {
      await channel.bindQueue(subscription.queue, this.exchange, routingKey);
    }

    await channel.assertQueue(subscription.queue + '.dlq', { durable: true });
    await channel.bindQueue(subscription.queue + '.dlq', this.dlx, subscription.queue);
    for (const delay of [1000, 5000, 30000]) {
      await channel.assertQueue(subscription.queue + '.retry.' + delay, {
        durable: true,
        arguments: {
          'x-message-ttl': delay,
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': subscription.queue,
        },
      });
    }
    const { consumerTag } = await channel.consume(subscription.queue, (message) => {
      if (message) {
        void this.dispatch(channel, message, subscription.handler, subscription.queue).catch(() => {
          this.logger.warn('Consumer channel closed; unacknowledged delivery will be redelivered');
        });
      }
    });
    subscription.channel = channel;
    subscription.consumerTag = consumerTag;
    this.logger.log(
      `Subscribed queue ${subscription.queue} -> [${subscription.routingKeys.join(', ')}]`,
    );
  }

  private async dispatch(
    channel: amqp.Channel,
    message: amqp.ConsumeMessage,
    handler: MessageHandler,
    queue = 'consumer',
  ): Promise<void> {
    const routingKey = String(
      message.properties.headers?.['x-original-routing-key'] ?? message.fields.routingKey,
    );
    try {
      if (queue.endsWith('.v2') || routingKey.endsWith('.v2')) {
        try {
          if (validateEvent(JSON.parse(message.content.toString())) !== routingKey)
            throw new Error('Event route mismatch');
        } catch {
          await this.deadLetter(channel, message, queue, 'INVALID_EVENT');
          return;
        }
      }
      await handler({
        routingKey,
        content: message.content,
        properties: message.properties,
      });
      channel.ack(message);
    } catch (error) {
      const rawRetry = Number(message.properties.headers?.['x-retry'] ?? 0);
      const retryCount =
        Number.isInteger(rawRetry) && rawRetry >= 0 ? Math.min(rawRetry, MAX_RETRIES) : MAX_RETRIES;
      this.logger.error(
        `Failed to handle ${routingKey} (attempt ${retryCount + 1}): ${(error as Error).message}`,
      );

      const options = {
        ...message.properties,
        headers: {
          ...message.properties.headers,
          'x-retry': retryCount + 1,
          'x-original-routing-key': routingKey,
        },
      } as amqp.Options.Publish;

      if (retryCount < MAX_RETRIES) {
        try {
          await this.confirmedPublish(
            '',
            queue + '.retry.' + [1000, 5000, 30000][retryCount],
            message.content,
            options,
          );
        } catch {
          channel.nack(message, false, true);
          return;
        }
      } else {
        this.logger.error(`Moving ${routingKey} to DLQ after ${retryCount + 1} attempts`);
        await this.deadLetter(channel, message, queue, 'RETRY_EXHAUSTED');
        return;
      }
      channel.ack(message);
    }
  }

  private async deadLetter(
    channel: amqp.Channel,
    message: amqp.ConsumeMessage,
    queue: string,
    reason: string,
  ): Promise<void> {
    if (!queue.endsWith('.v2')) {
      channel.nack(message, false, false);
      return;
    }
    try {
      await this.confirmedPublish('', queue + '.dlq', message.content, {
        ...message.properties,
        headers: { ...message.properties.headers, 'x-failure-reason': reason },
      });
      channel.ack(message);
    } catch {
      channel.nack(message, false, true);
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.closing = true;
    for (const subscription of this.subscriptions) {
      if (subscription.channel) {
        await subscription.channel.close().catch(() => undefined);
      }
    }
    await this.publishChannel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
    this.logger.log('RabbitMQ connection closed');
  }
}
