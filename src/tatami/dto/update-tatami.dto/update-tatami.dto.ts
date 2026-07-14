import { IsUUID, IsInt, IsString, IsOptional } from 'class-validator';

export class UpdateTatamiDto {
  @IsOptional()
  @IsInt()
  number?: number;

  @IsOptional()
  @IsString()
  name?: string;
}