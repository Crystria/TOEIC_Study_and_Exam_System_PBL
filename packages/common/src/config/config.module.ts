import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { loadEnv } from './env';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadEnv],
      envFilePath: ['.env', '.env.local'],
    }),
  ],
})
export class AppConfigModule {}
