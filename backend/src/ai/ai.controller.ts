import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AiService } from './ai.service';

// Accepted audio MIME types that Gemini can handle
const ACCEPTED_AUDIO_TYPES = [
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/x-m4a',
  'application/octet-stream', // some browsers send this for webm blobs
];

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('transcribe')
  // 10 MB limit — audio blobs can be larger than PDF files
  @UseInterceptors(
    FileInterceptor('audio', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    }),
  )
  async transcribeAudio(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No audio file provided');
    }

    if (!ACCEPTED_AUDIO_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported audio type "${file.mimetype}". Accepted: webm, ogg, mp4, wav, mpeg.`,
      );
    }

    // Normalise octet-stream to webm so Gemini can identify the format
    const mimeType =
      file.mimetype === 'application/octet-stream' ? 'audio/webm' : file.mimetype;

    const text = await this.aiService.transcribeAudio(file.buffer, mimeType);
    return { transcript: text };
  }
}
