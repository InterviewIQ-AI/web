import { Controller, Post, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('transcribe')
  @UseInterceptors(FileInterceptor('audio'))
  async transcribeAudio(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No audio file provided');
    }
    
    // Fallback mimeType if it's octet-stream
    const mimeType = file.mimetype === 'application/octet-stream' ? 'audio/webm' : file.mimetype;
    
    const text = await this.aiService.transcribeAudio(file.buffer, mimeType);
    return { transcript: text };
  }
}
