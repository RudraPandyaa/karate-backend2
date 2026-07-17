import { Injectable, BadRequestException } from '@nestjs/common';
import { UTApi } from 'uploadthing/server';

@Injectable()
export class UploadService {
  private utapi: UTApi;

  constructor() {
      console.log("UPLOADTHING_TOKEN:", process.env.UPLOADTHING_TOKEN);
    this.utapi = new UTApi({
      token: process.env.UPLOADTHING_TOKEN!,
    });
  }

  async uploadImage(file: Express.Multer.File): Promise<string> {
    if (!file?.buffer) {
      throw new BadRequestException('No file provided');
    }

    try {
      const uint8Array = new Uint8Array(file.buffer);

      const fileObject = new File(
        [uint8Array],
        file.originalname,
        {
          type: file.mimetype,
        },
      );

      const response = await this.utapi.uploadFiles([fileObject]);

      const uploadedFile = response[0];

      if (uploadedFile.error) {
        throw new Error(uploadedFile.error.message || 'Upload failed');
      }

      console.log('✅ UploadThing success:', uploadedFile.data.url);
      return uploadedFile.data.url;
    } catch (error: any) {
      console.error('UploadThing error:', error);
      throw new BadRequestException(`Upload failed: ${error.message}`);
    }
  }
}