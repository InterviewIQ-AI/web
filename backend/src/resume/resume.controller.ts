import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
  PayloadTooLargeException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ResumeService } from './resume.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/user.decorator';
import type { AuthUser } from '../auth/user.decorator';
import { UsersService } from '../users/users.service';

@Controller('resume')
@UseGuards(AuthGuard)
export class ResumeController {
  constructor(
    private readonly resumeService: ResumeService,
    private readonly usersService: UsersService,
  ) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    }),
  )
  async uploadResume(
    @UploadedFile() file: Express.Multer.File,
    @Body('jobRole') jobRole: string,
    @Body('jobDescription') jobDescription: string | undefined,
    @CurrentUser() authUser: AuthUser,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!jobRole?.trim()) throw new BadRequestException('Job role is required');
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException(
        `Unsupported file type "${file.mimetype}". Only PDF files are accepted.`,
      );
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new PayloadTooLargeException('File exceeds the 5 MB limit.');
    }

    const dbUser = await this.usersService.upsertUser(
      authUser.firebaseUid,
      authUser.email,
      authUser.name,
    );

    return this.resumeService.processResume(
      file.buffer,
      jobRole.trim(),
      dbUser.id,
      jobDescription?.trim(),
    );
  }
}
