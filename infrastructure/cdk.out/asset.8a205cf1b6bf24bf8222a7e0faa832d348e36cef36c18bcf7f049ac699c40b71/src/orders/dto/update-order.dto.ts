import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  Min,
  Max,
} from "class-validator";

export class UpdateOrderDto {
  @IsOptional()
  @IsEnum([
    "pending_price",
    "priced",
    "confirmed",
    "preparing",
    "ready",
    "delivered",
    "cancelled",
  ])
  status?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  final_amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discount_percent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount_amount?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  customer_notes?: string;

  @IsOptional()
  @IsString()
  delivery_date?: string;

  @IsOptional()
  @IsEnum(["pending", "paid", "refunded"])
  payment_status?: string;
}

export class UpdateOrderItemDto {
  @IsNumber()
  @Min(0)
  price_per_piece: number;
}
