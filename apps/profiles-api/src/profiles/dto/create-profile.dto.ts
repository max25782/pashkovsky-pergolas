import {
  IsString,
  IsNumber,
  IsArray,
  IsOptional,
  IsBoolean,
  IsEnum,
  Min,
  ArrayMinSize,
} from 'class-validator';

export enum ProfileCategory {
  PERGULAS = 'pergulas',
  FANCY = 'fancy',
  RAILLING = 'railling',
  CONCEALED = 'concealed', // מסתורי כביסהת
  WINDOW = 'window',
}

export class CreateProfileDto {
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  name_he?: string;

  @IsOptional()
  @IsString()
  name_ru?: string;

  @IsOptional()
  @IsString()
  name_en?: string;

  @IsString()
  dimensions: string;

  @IsNumber()
  @Min(0)
  weight_per_meter: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsNumber({}, { each: true })
  available_lengths: number[];

  @IsEnum(ProfileCategory)
  category: ProfileCategory;

  @IsOptional()
  @IsString()
  description_he?: string;

  @IsOptional()
  @IsString()
  description_ru?: string;

  @IsOptional()
  @IsString()
  description_en?: string;

  @IsOptional()
  @IsString()
  image_url?: string;

  @IsNumber()
  @Min(0)
  price_per_kg: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
