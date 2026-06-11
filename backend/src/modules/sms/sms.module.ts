import { Global, Module } from '@nestjs/common';
import { SmsController } from './sms.controller';
import { SmsService } from './sms.service';
import { EskizAdapter } from './adapters/eskiz.adapter';
import { PlayMobileAdapter } from './adapters/playmobile.adapter';

@Global()
@Module({
  controllers: [SmsController],
  providers: [SmsService, EskizAdapter, PlayMobileAdapter],
  exports: [SmsService],
})
export class SmsModule {}
