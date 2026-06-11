import { Module } from '@nestjs/common';
import { TelegramController } from './telegram.controller';
import { TelegramConnectService } from './telegram-connect.service';
import { CollectorModule } from '../collector/collector.module';

@Module({
  imports: [CollectorModule],
  controllers: [TelegramController],
  providers: [TelegramConnectService],
})
export class TelegramModule {}
