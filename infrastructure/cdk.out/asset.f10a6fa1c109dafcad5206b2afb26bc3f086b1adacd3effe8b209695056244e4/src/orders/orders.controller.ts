import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  BadRequestException,
  UseGuards,
} from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { UpdateOrderDto, UpdateOrderItemDto } from "./dto/update-order.dto";
import { AuthGuard } from "../common/guards/auth.guard";
import { CompanyGuard } from "../common/guards/company.guard";
import { CurrentUser, CurrentUserData } from "../common/decorators/current-user.decorator";

@Controller("orders")
@UseGuards(AuthGuard, CompanyGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  async findAll(@CurrentUser() user: CurrentUserData) {
    return this.ordersService.findAll(user.company_id);
  }

  @Get(":id")
  async findOne(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    return this.ordersService.findOne(id, user.company_id);
  }

  @Post()
  async create(
    @Body() createOrderDto: CreateOrderDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.ordersService.create(createOrderDto, user.company_id);
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() updateOrderDto: UpdateOrderDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.ordersService.update(id, updateOrderDto, user.company_id);
  }

  @Patch(":orderId/items/:itemId")
  async updateItem(
    @Param("orderId") orderId: string,
    @Param("itemId") itemId: string,
    @Body() updateItemDto: UpdateOrderItemDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.ordersService.updateOrderItem(
      orderId,
      itemId,
      updateItemDto,
      user.company_id,
    );
  }
}
