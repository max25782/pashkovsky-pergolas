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

@Controller("profiles")
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  /**
   * GET /profiles - List all profiles
   * Public endpoint for storefront (only active profiles)
   * Admin endpoint (with auth) shows all profiles
   */
  @Get()
  findAll(@Query("company_id") companyId?: string) {
    if (!companyId) {
      throw new BadRequestException("company_id query parameter required");
    }
    return this.profilesService.findAll(companyId, true);
  }

  /**
   * GET /profiles/with-stock - List profiles with stock info (Admin only)
   */
  @Get("with-stock")
  @UseGuards(AuthGuard, CompanyGuard)
  findAllWithStock(@CurrentUser() user: CurrentUserData) {
    return this.profilesService.findAllWithStock(user.company_id);
  }

  /**
   * GET /profiles/:id - Get single profile
   */
  @Get(":id")
  findOne(@Param("id") id: string, @Query("company_id") companyId?: string) {
    if (!companyId) {
      throw new BadRequestException("company_id query parameter required");
    }
    return this.profilesService.findOne(id, companyId);
  }

  /**
   * POST /profiles - Create new profile (Admin only, Pashkovsky company only)
   */
  @Post()
  @UseGuards(AuthGuard, CompanyGuard)
  create(
    @Body() createProfileDto: CreateProfileDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.profilesService.create(createProfileDto, user.company_id);
  }

  /**
   * PATCH /profiles/:id - Update profile (Admin only)
   */
  @Patch(":id")
  @UseGuards(AuthGuard, CompanyGuard)
  update(
    @Param("id") id: string,
    @Body() updateProfileDto: UpdateProfileDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.profilesService.update(id, updateProfileDto, user.company_id);
  }

  /**
   * DELETE /profiles/:id - Soft delete profile (Admin only)
   */
  @Delete(":id")
  @UseGuards(AuthGuard, CompanyGuard)
  remove(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    return this.profilesService.remove(id, user.company_id);
  }
}
