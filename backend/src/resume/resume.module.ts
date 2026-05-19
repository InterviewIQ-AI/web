import { Module } from '@nestjs/common';
import { ResumeController } from './resume.controller';
import { ResumeService } from './resume.service';
import { AiModule } from '../ai/ai.module';
import { InterviewModule } from '../interview/interview.module';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [AiModule, InterviewModule, AuthModule, UsersModule],
  controllers: [ResumeController],
  providers: [ResumeService],
})
export class ResumeModule {}
