import { Module } from '@nestjs/common';
import { UploadService } from './upload.service';
import { CloudinaryConfig } from '../config/cloudinary.config';

@Module({
  providers: [UploadService, CloudinaryConfig],
  exports: [UploadService],
})
export class UploadModule {}