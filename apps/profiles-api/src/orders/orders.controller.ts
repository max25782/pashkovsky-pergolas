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
  ForbiddenException,
} from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { UpdateOrderDto, UpdateOrderItemDto } from "./dto/update-order.dto";
import { AuthGuard } from "../common/guards/auth.guard";
import { CompanyGuard } from "../common/guards/company.guard";
import { OptionalAuthGuard } from "../common/guards/optional-auth.guard";
import { CurrentUser, CurrentUserData } from "../common/decorators/current-user.decorator";
import { PublicStoreReadService } from "../common/public-store-read.service";

@Controller("orders")
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly publicStoreRead: PublicStoreReadService,
  ) {}

  @Get()
  @UseGuards(AuthGuard, CompanyGuard)
  async findAll(@CurrentUser() user: CurrentUserData) {
    return this.ordersService.findAll(user.company_id!);
  }

  /**
   * Authenticated: uses resolved `company_id` from JWT + `X-Company-Id` / query.
   * Anonymous: requires `company_id` + optional `read_token` when company settings require it.
   */
  @Get(":id")
  @UseGuards(OptionalAuthGuard)
  async findOne(
    @Param("id") id: string,
    @Query("company_id") companyId?: string,
    @Query("read_token") readToken?: string,
    @CurrentUser() user?: CurrentUserData,
  ) {
    const cid = user?.company_id ?? companyId;
    if (!cid) throw new BadRequestException("company_id required");
    if (user?.company_id && user.company_id !== cid) {
      throw new ForbiddenException("company_id does not match authenticated tenant");
    }
    if (!user) {
      await this.publicStoreRead.verifyStorefrontRead(cid, readToken);
    }
    return this.ordersService.findOne(id, cid);
  }

  @Post()
  async create(
    @Body() createOrderDto: CreateOrderDto,
    @Query("company_id") companyId?: string,
    @Query("read_token") readToken?: string,
  ) {
    if (!companyId) throw new BadRequestException("company_id query param required");
    await this.publicStoreRead.verifyStorefrontRead(companyId, readToken);
    return this.ordersService.create(createOrderDto, companyId);
  }

  @Patch(":id")
  @UseGuards(AuthGuard, CompanyGuard)
  async update(
    @Param("id") id: string,
    @Body() updateOrderDto: UpdateOrderDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.ordersService.update(id, updateOrderDto, user.company_id!);
  }

  @Delete(":id")
  @UseGuards(AuthGuard, CompanyGuard)
  async delete(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    return this.ordersService.delete(id, user.company_id!);
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
      user.company_id!,
    );
  }
}
