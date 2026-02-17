import { Controller } from '@nestjs/common';
import { StockService } from './stock.service';

@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}
  // TODO: Implement stock endpoints in Phase 2
}
