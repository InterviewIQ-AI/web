import { Module } from '@nestjs/common';
import { InterviewController } from './interview.controller';
import { InterviewService } from './interview.service';
import { SpacedRepetitionService } from './spaced-repetition.service';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [AiModule, AuthModule, UsersModule],
  controllers: [InterviewController],
  providers: [InterviewService, SpacedRepetitionService],
  exports: [InterviewService],
})
export class InterviewModule {}
