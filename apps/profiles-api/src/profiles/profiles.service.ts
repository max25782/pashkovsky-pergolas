import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from "@nestjs/common";
import { getSupabaseAdmin } from "../config/supabase.config";
import { CreateProfileDto } from "./dto/create-profile.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";

@Injectable()
export class ProfilesService {
  private readonly supabase = getSupabaseAdmin();

  /**
   * Get all profiles for a company
   * Public users only see active profiles
   * Admin users see all profiles
   */
  async findAll(companyId: string, isPublic = false, search?: string, category?: string) {
    let query = this.supabase
      .from("aluminum_profiles")
      .select("*")
      .eq("company_id", companyId)
      .order("code", { ascending: true });

    if (isPublic) {
      query = query.eq("is_active", true);
    }

    if (category && category !== "all") {
      query = query.eq("category", category);
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      query = query.or(
        `code.ilike.${term},name_he.ilike.${term},name_ru.ilike.${term},name_en.ilike.${term},dimensions.ilike.${term},category.ilike.${term}`,
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error("[ProfilesService] Supabase error:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        companyId,
      });

      // More helpful error message
      if (error.code === "42P01") {
        throw new InternalServerErrorException(
          `Table 'aluminum_profiles' does not exist. Please run the database migration: apps/crm/supabase/migrations/018_create_profiles_system.sql`,
        );
      }

      throw new InternalServerErrorException(
        `Failed to fetch profiles: ${error.message}`,
      );
    }

    return data || [];
  }

  /**
   * Get single profile by ID
   */
  async findOne(id: string, companyId: string) {
    const { data, error } = await this.supabase
      .from("aluminum_profiles")
      .select("*")
      .eq("id", id)
      .eq("company_id", companyId)
      .single();

    if (error || !data) {
      throw new NotFoundException(`Profile with ID ${id} not found`);
    }

    return data;
  }

  /**
   * Create new profile
   */
  async create(dto: CreateProfileDto, companyId: string) {
    // Check if code already exists for this company
    const { data: existing } = await this.supabase
      .from("aluminum_profiles")
      .select("id")
      .eq("company_id", companyId)
      .eq("code", dto.code)
      .single();

    if (existing) {
      throw new ConflictException(
        `Profile with code ${dto.code} already exists`,
      );
    }

    const { data, error } = await this.supabase
      .from("aluminum_profiles")
      .insert({
        ...dto,
        company_id: companyId,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create profile: ${error.message}`);
    }

    return data;
  }

  /**
   * Update profile
   */
  async update(id: string, dto: UpdateProfileDto, companyId: string) {
    // Verify profile exists and belongs to company
    await this.findOne(id, companyId);

    // If updating code, check uniqueness
    if ("code" in dto && dto.code) {
      const { data: existing } = await this.supabase
        .from("aluminum_profiles")
        .select("id")
        .eq("company_id", companyId)
        .eq("code", dto.code)
        .neq("id", id)
        .single();

      if (existing) {
        throw new ConflictException(
          `Profile with code ${dto.code} already exists`,
        );
      }
    }

    const { data, error } = await this.supabase
      .from("aluminum_profiles")
      .update(dto)
      .eq("id", id)
      .eq("company_id", companyId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update profile: ${error.message}`);
    }

    return data;
  }

  /**
   * Soft delete profile (set is_active = false)
   */
  async remove(id: string, companyId: string) {
    await this.findOne(id, companyId);

    const { error } = await this.supabase
      .from("aluminum_profiles")
      .update({ is_active: false })
      .eq("id", id)
      .eq("company_id", companyId);

    if (error) {
      throw new Error(`Failed to deactivate profile: ${error.message}`);
    }

    return { message: "Profile deactivated successfully" };
  }

  /**
   * Get profiles with stock information
   */
  async findAllWithStock(companyId: string) {
    const profiles = await this.findAll(companyId, false);

    // For each profile, get stock summary
    const profilesWithStock = await Promise.all(
      profiles.map(async (profile) => {
        const { data: stockData } = await this.supabase
          .from("stock")
          .select("color, length_meters, qty_available, qty_reserved")
          .eq("company_id", companyId)
          .eq("profile_id", profile.id)
          .gt("qty_available", 0);

        return {
          ...profile,
          stock: stockData || [],
          availableColors: [...new Set(stockData?.map((s) => s.color) || [])],
        };
      }),
    );

    return profilesWithStock;
  }
}
