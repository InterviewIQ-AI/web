import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
  PayloadTooLargeException,
  UseGuards,
  NotFoundException,
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

  /**
   * POST /resume/upload
   * Legacy: upload PDF + start interview in one shot.
   * Still used for ad-hoc uploads (kept for backwards compat).
   */
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

  /**
   * POST /resume/start-from-profile
   * Starts an interview using the resume text already stored in the user's profile.
   * No file upload needed — the user uploaded their resume once via the Profile page.
   */
  @Post('start-from-profile')
  async startFromProfile(
    @Body('jobRole') jobRole: string,
    @Body('jobDescription') jobDescription: string | undefined,
    @CurrentUser() authUser: AuthUser,
  ) {
    if (!jobRole?.trim()) throw new BadRequestException('Job role is required');

    const dbUser = await this.usersService.getMe(authUser.firebaseUid);
    if (!dbUser) throw new NotFoundException('User profile not found');

    const resumeText = (dbUser as any).resumeText as string | null;
    if (!resumeText || resumeText.trim().length < 50) {
      throw new BadRequestException(
        'No resume found on your profile. Please upload your resume in the Profile page first.',
      );
    }

    return this.resumeService.processResumeText(
      resumeText,
      jobRole.trim(),
      dbUser.id,
      jobDescription?.trim(),
    );
  }
}
