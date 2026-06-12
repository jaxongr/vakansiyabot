import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { WinstonModule } from 'nest-winston';
import { validateEnv } from './config/configuration';
import { buildWinstonOptions } from './common/logger/winston.config';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { SystemModule } from './modules/system/system.module';
import { DedupModule } from './modules/dedup/dedup.module';
import { CollectorModule } from './modules/collector/collector.module';
import { ChannelsModule } from './modules/channels/channels.module';
import { AnalyzerModule } from './modules/analyzer/analyzer.module';
import { PublisherModule } from './modules/publisher/publisher.module';
import { AuthModule } from './modules/auth/auth.module';
import { VacanciesModule } from './modules/vacancies/vacancies.module';
import { RefsModule } from './modules/refs/refs.module';
import { UsersModule } from './modules/users/users.module';
import { StatsModule } from './modules/stats/stats.module';
import { ScraperModule } from './modules/scraper/scraper.module';
import { SmsModule } from './modules/sms/sms.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { BillingModule } from './modules/billing/billing.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    WinstonModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        buildWinstonOptions(config.get('NODE_ENV', 'development')),
    }),
    JwtModule.register({ global: true }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = new URL(config.getOrThrow<string>('REDIS_URL'));
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            maxRetriesPerRequest: null,
          },
        };
      },
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    RedisModule,
    SystemModule,
    DedupModule,
    CollectorModule,
    ChannelsModule,
    AnalyzerModule,
    PublisherModule,
    AuthModule,
    VacanciesModule,
    RefsModule,
    UsersModule,
    StatsModule,
    ScraperModule,
    SmsModule,
    TelegramModule,
    BillingModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
