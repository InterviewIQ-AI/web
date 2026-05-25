import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { AiService } from '../ai/ai.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/user.decorator';
import type { AuthUser } from '../auth/user.decorator';

// pdf-parse requires CommonJS require
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse: (buf: Buffer) => Promise<{ text: string }> = require('pdf-parse');

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly aiService: AiService,
  ) {}

  /**
   * GET /users/me
   * Returns the full DB profile of the authenticated user.
   * Creates the user row if this is the first ever request.
   */
  @Get('me')
  async getMe(@CurrentUser() authUser: AuthUser) {
    // Only upsert to ensure the row exists — do NOT pass name so we don't overwrite
    // a custom name the user set via PATCH /profile.
    await this.usersService.upsertUser(authUser.firebaseUid, authUser.email, authUser.name);
    return this.usersService.getMe(authUser.firebaseUid);
  }

  /**
   * PATCH /users/profile
   * Updates extended profile fields and marks profileCompleted = true.
   */
  @Patch('profile')
  async updateProfile(
    @CurrentUser() authUser: AuthUser,
    @Body() body: {
      name?: string;
      phone?: string;
      currentRole?: string;
      yearsOfExperience?: number;
      targetRole?: string;
      education?: string;
      linkedinUrl?: string;
      skills?: string[];
    },
  ) {
    await this.usersService.upsertUser(authUser.firebaseUid, authUser.email, authUser.name);
    return this.usersService.updateProfile(authUser.firebaseUid, body);
  }

  /**
   * POST /users/resume
   * Upload a PDF resume once; its text is extracted and stored in the user row.
   * The frontend can then start interviews without re-uploading.
   */
  @Post('resume')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  async uploadResume(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() authUser: AuthUser,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException(
        `Unsupported file type "${file.mimetype}". Only PDF files are accepted.`,
      );
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new PayloadTooLargeException('File exceeds the 5 MB limit.');
    }

    let resumeText: string;
    try {
      const data = await pdfParse(file.buffer);
      resumeText = data.text?.trim() ?? '';
    } catch {
      throw new BadRequestException(
        'Could not read the uploaded PDF. The file may be corrupted or encrypted.',
      );
    }

    if (!resumeText || resumeText.length < 50) {
      throw new BadRequestException(
        'Could not extract text from the PDF. Make sure it is a text-based PDF (not a scanned image).',
      );
    }

    await this.usersService.upsertUser(authUser.firebaseUid, authUser.email, authUser.name);
    // Save resume text and kick off AI summarization in parallel
    const [, summary] = await Promise.all([
      this.usersService.updateProfile(authUser.firebaseUid, { resumeText }),
      this.aiService.summarizeResume(resumeText).catch(() => null),
    ]);
    // Save summary if generated
    if (summary) {
      await this.usersService.updateProfile(authUser.firebaseUid, {
        resumeSummary: JSON.stringify(summary),
      });
    }
    return { message: 'Resume saved successfully', length: resumeText.length, summary };
  }
}
