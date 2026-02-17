import { Controller, Post, Get, Patch, Body, Param, Query, BadRequestException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto, UpdateOrderItemDto } from './dto/update-order.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  async findAll(@Query('company_id') companyId?: string) {
    if (!companyId) {
      throw new BadRequestException('company_id query parameter is required');
    }

    return this.ordersService.findAll(companyId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Query('company_id') companyId?: string) {
    if (!companyId) {
      throw new BadRequestException('company_id query parameter is required');
    }

    return this.ordersService.findOne(id, companyId);
  }

  @Post()
  async create(
    @Body() createOrderDto: CreateOrderDto,
    @Query('company_id') companyId?: string,
  ) {
    if (!companyId) {
      throw new BadRequestException('company_id query parameter is required');
    }

    return this.ordersService.create(createOrderDto, companyId);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateOrderDto: UpdateOrderDto,
    @Query('company_id') companyId?: string,
  ) {
    if (!companyId) {
      throw new BadRequestException('company_id query parameter is required');
    }

    return this.ordersService.update(id, updateOrderDto, companyId);
  }

  @Patch(':orderId/items/:itemId')
  async updateItem(
    @Param('orderId') orderId: string,
    @Param('itemId') itemId: string,
    @Body() updateItemDto: UpdateOrderItemDto,
    @Query('company_id') companyId?: string,
  ) {
    if (!companyId) {
      throw new BadRequestException('company_id query parameter is required');
    }

    return this.ordersService.updateOrderItem(orderId, itemId, updateItemDto, companyId);
  }
}
