import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';

export interface EventEnvelope<T> {
  eventId: string;
  eventType: string;
  occurredAt: number;
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
  private reconnecting = false;
  private readonly subscriptions: Subscription[] = [];

  constructor(config: ConfigService) {
    this.url = config.get<string>('RABBITMQ_URL') ?? 'amqp://toeic:toeic@localhost:5772';
    this.exchange = config.get<string>('RABBITMQ_EXCHANGE') ?? DEFAULT_EXCHANGE;
    this.dlx = `${this.exchange}.dlx`;
    this.dlq = `${this.exchange}.dlq`;
  }

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  private async connect(): Promise<void> {
    const connection = await amqp.connect(this.url);
    connection.on('error', (error: Error) => {
      this.logger.error(`RabbitMQ connection error: ${error.message}`);
    });
    connection.on('close', () => {
      for (const subscription of this.subscriptions) subscription.started = false;
      if (!this.closing) {
        void this.scheduleReconnect();
      }
    });

    const channel = await connection.createConfirmChannel();
    await channel.assertExchange(this.exchange, 'topic', { durable: true });
    await channel.assertExchange(this.dlx, 'topic', { durable: true });
    await channel.assertQueue(this.dlq, { durable: true });
    await channel.bindQueue(this.dlq, this.dlx, '#');

    this.connection = connection;
    this.publishChannel = channel;
    this.logger.log(`RabbitMQ connected (${this.url})`);

    for (const subscription of this.subscriptions) {
      if (!subscription.started) {
        await this.startConsumer(subscription);
      }
    }
  }

  private async scheduleReconnect(): Promise<void> {
    if (this.reconnecting || this.closing) {
      return;
    }
    this.reconnecting = true;
    this.logger.warn(`RabbitMQ closed, reconnecting in ${RECONNECT_DELAY_MS}ms`);
    await new Promise((resolve) => setTimeout(resolve, RECONNECT_DELAY_MS));
    try {
      await this.connect();
      this.logger.log('RabbitMQ reconnected');
    } catch (error) {
      this.logger.error(`Reconnect failed: ${(error as Error).message}`);
    } finally {
      this.reconnecting = false;
    }
  }

  async emit<T>(routingKey: string, key: string, envelope: EventEnvelope<T>): Promise<void> {
    if (!this.publishChannel) {
      throw new Error('RabbitMQ publish channel is not ready');
    }
    const body = Buffer.from(JSON.stringify(envelope));
    this.publishChannel.publish(this.exchange, routingKey, body, {
      persistent: true,
      contentType: 'application/json',
      messageId: envelope.eventId,
      timestamp: envelope.occurredAt,
      headers: { 'x-routing-key': routingKey, 'x-aggregate-id': key },
    });
    await this.publishChannel.waitForConfirms();
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

  private async startConsumer(subscription: Subscription): Promise<void> {
    if (subscription.started) {
      return;
    }
    subscription.started = true;
    const channel = await this.connection!.createChannel();
    await channel.prefetch(10);
    await channel.assertQueue(subscription.queue, {
      durable: true,
      arguments: { 'x-dead-letter-exchange': this.dlx },
    });
    for (const routingKey of subscription.routingKeys) {
      await channel.bindQueue(subscription.queue, this.exchange, routingKey);
    }

    const { consumerTag } = await channel.consume(subscription.queue, (message) => {
      if (message) {
        void this.dispatch(channel, message, subscription.handler);
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
  ): Promise<void> {
    const routingKey = message.fields.routingKey;
    try {
      await handler({
        routingKey,
        content: message.content,
        properties: message.properties,
      });
      channel.ack(message);
    } catch (error) {
      const retryCount = Number(message.properties.headers?.['x-retry'] ?? 0);
      this.logger.error(
        `Failed to handle ${routingKey} (attempt ${retryCount + 1}): ${(error as Error).message}`,
      );

      const options = {
        ...message.properties,
        headers: { ...message.properties.headers, 'x-retry': retryCount + 1 },
      } as amqp.Options.Publish;

      if (retryCount < MAX_RETRIES) {
        channel.publish(this.exchange, routingKey, message.content, options);
      } else {
        this.logger.error(`Moving ${routingKey} to DLQ after ${retryCount + 1} attempts`);
        channel.nack(message, false, false);
        return;
      }
      channel.ack(message);
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
