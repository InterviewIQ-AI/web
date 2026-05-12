import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ResumeService } from './resume.service';

@Controller('resume')
export class ResumeController {
  constructor(private readonly resumeService: ResumeService) {}

  @Post('upload')
  // Enforce a 5 MB server-side limit — mirrors the frontend validation
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    }),
  )
  async uploadResume(
    @UploadedFile() file: Express.Multer.File,
    @Body('jobRole') jobRole: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    if (!jobRole || !jobRole.trim()) {
      throw new BadRequestException('Job role is required');
    }
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException(
        `Unsupported file type "${file.mimetype}". Only PDF files are accepted.`,
      );
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new PayloadTooLargeException('File exceeds the 5 MB limit.');
    }

    return this.resumeService.processResume(file.buffer, jobRole.trim());
  }
}
