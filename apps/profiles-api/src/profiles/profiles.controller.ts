import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  BadRequestException,
} from "@nestjs/common";
import { ProfilesService } from "./profiles.service";
import { CreateProfileDto } from "./dto/create-profile.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { AuthGuard } from "../common/guards/auth.guard";
import { CompanyGuard } from "../common/guards/company.guard";
import {
  CurrentUser,
  CurrentUserData,
} from "../common/decorators/current-user.decorator";
import { PublicStoreReadService } from "../common/public-store-read.service";

@Controller("profiles")
export class ProfilesController {
  constructor(
    private readonly profilesService: ProfilesService,
    private readonly publicStoreRead: PublicStoreReadService,
  ) {}

  /**
   * GET /profiles - List active profiles for a company (storefront).
   * Optional: `companies.settings.profiles_store_public_token` then `read_token` query must match.
   */
  @Get()
  async findAll(
    @Query("company_id") companyId?: string,
    @Query("read_token") readToken?: string,
    @Query("search") search?: string,
    @Query("category") category?: string,
  ) {
    if (!companyId) {
      throw new BadRequestException("company_id query parameter required");
    }
    await this.publicStoreRead.verifyStorefrontRead(companyId, readToken);
    return this.profilesService.findAll(companyId, true, search, category);
  }

  /**
   * GET /profiles/with-stock - List profiles with stock info (Admin only)
   */
  @Get("with-stock")
  @UseGuards(AuthGuard, CompanyGuard)
  findAllWithStock(@CurrentUser() user: CurrentUserData) {
    return this.profilesService.findAllWithStock(user.company_id!);
  }

  /**
   * GET /profiles/:id - Get single active profile (storefront)
   */
  @Get(":id")
  async findOne(
    @Param("id") id: string,
    @Query("company_id") companyId?: string,
    @Query("read_token") readToken?: string,
  ) {
    if (!companyId) {
      throw new BadRequestException("company_id query parameter required");
    }
    await this.publicStoreRead.verifyStorefrontRead(companyId, readToken);
    return this.profilesService.findOne(id, companyId);
  }

  /**
   * POST /profiles - Create profile (authenticated member of that company)
   */
  @Post()
  @UseGuards(AuthGuard, CompanyGuard)
  create(
    @Body() createProfileDto: CreateProfileDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.profilesService.create(createProfileDto, user.company_id!);
  }

  @Patch(":id")
  @UseGuards(AuthGuard, CompanyGuard)
  update(
    @Param("id") id: string,
    @Body() updateProfileDto: UpdateProfileDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.profilesService.update(id, updateProfileDto, user.company_id!);
  }

  @Delete(":id")
  @UseGuards(AuthGuard, CompanyGuard)
  remove(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    return this.profilesService.remove(id, user.company_id!);
  }
}
