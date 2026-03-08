import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
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
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @UseGuards(AuthGuard, CompanyGuard)
  async findAll(@CurrentUser() user: CurrentUserData) {
    return this.ordersService.findAll(user.company_id);
  }

  @Get(":id")
  async findOne(
    @Param("id") id: string,
    @Query("company_id") companyId?: string,
    @CurrentUser() user?: CurrentUserData,
  ) {
    const cid = user?.company_id || companyId;
    if (!cid) throw new BadRequestException("company_id required");
    return this.ordersService.findOne(id, cid);
  }

  /**
   * Public endpoint — storefront submits orders without auth.
   * company_id is taken from query param.
   */
  @Post()
  async create(
    @Body() createOrderDto: CreateOrderDto,
    @Query("company_id") companyId?: string,
  ) {
    if (!companyId) throw new BadRequestException("company_id query param required");
    return this.ordersService.create(createOrderDto, companyId);
  }

  @Patch(":id")
  @UseGuards(AuthGuard, CompanyGuard)
  async update(
    @Param("id") id: string,
    @Body() updateOrderDto: UpdateOrderDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.ordersService.update(id, updateOrderDto, user.company_id);
  }

  @Delete(":id")
  @UseGuards(AuthGuard, CompanyGuard)
  async delete(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.ordersService.delete(id, user.company_id);
  }

  @Patch(":orderId/items/:itemId")
  @UseGuards(AuthGuard, CompanyGuard)
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
