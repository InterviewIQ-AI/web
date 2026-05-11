import { Module } from '@nestjs/common';
import { ResumeController } from './resume.controller';
import { ResumeService } from './resume.service';
import { AiModule } from '../ai/ai.module';
import { InterviewModule } from '../interview/interview.module';

@Module({
  imports: [AiModule, InterviewModule],
  controllers: [ResumeController],
  providers: [ResumeService],
})
export class ResumeModule {}
