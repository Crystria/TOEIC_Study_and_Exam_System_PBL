import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Consumer, EachMessagePayload, Kafka, Producer } from 'kafkajs';

export interface EventEnvelope<T> {
  eventId: string;
  eventType: string;
  occurredAt: number;
  payload: T;
}

/**
 * Kafka client dùng chung.
 *
 * LƯU Ý: Bản skeleton serialize payload dạng JSON.
 * Khi tích hợp Schema Registry (Avro) sẽ thay serializer/deserializer tại đây.
 */
@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private readonly kafka: Kafka;
  private producer!: Producer;
  private readonly consumers: Consumer[] = [];

  constructor(private readonly config: ConfigService) {
    const brokers = (config.get<string>('KAFKA_BROKERS') ?? 'localhost:19092').split(',');
    this.kafka = new Kafka({
      clientId: config.get<string>('KAFKA_CLIENT_ID') ?? 'toeic-service',
      brokers,
    });
  }

  async onModuleInit(): Promise<void> {
    this.producer = this.kafka.producer();
    await this.producer.connect();
    this.logger.log('Kafka producer connected');
  }

  async emit<T>(topic: string, key: string, envelope: EventEnvelope<T>): Promise<void> {
    await this.producer.send({
      topic,
      messages: [{ key, value: JSON.stringify(envelope) }],
    });
  }

  async subscribe(
    topic: string,
    groupId: string,
    handler: (payload: EachMessagePayload) => Promise<void>,
  ): Promise<void> {
    const consumer = this.kafka.consumer({ groupId });
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: false });
    await consumer.run({ eachMessage: handler });
    this.consumers.push(consumer);
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.consumers.map((consumer) => consumer.disconnect()));
    await this.producer?.disconnect();
  }
}
