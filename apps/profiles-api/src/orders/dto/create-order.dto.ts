import {
  IsString,
  IsEmail,
  IsArray,
  ValidateNested,
  IsNotEmpty,
  IsUUID,
  IsNumber,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

class CustomerDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  address: string;
}

class OrderItemDto {
  @IsUUID()
  @IsNotEmpty()
  profile_id: string;

  @IsString()
  @IsNotEmpty()
  color: string;

  @IsNumber()
  @Min(0.1)
  length_meters: number;

  @IsNumber()
  @Min(1)
  quantity_pieces: number;

  @IsNumber()
  @Min(0)
  price_per_piece: number;
}

export class CreateOrderDto {
  @ValidateNested()
  @Type(() => CustomerDto)
  customer: CustomerDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}
