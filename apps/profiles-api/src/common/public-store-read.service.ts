import { Injectable, ForbiddenException } from "@nestjs/common";
import { getSupabaseAdmin } from "../config/supabase.config";

/**
 * Optional lock for anonymous catalog/order APIs.
 * When `companies.settings.profiles_store_public_token` is a non-empty string,
 * callers must pass the same value as query param `read_token`.
 */
@Injectable()
export class PublicStoreReadService {
  private readonly supabase = getSupabaseAdmin();

  async verifyStorefrontRead(
    companyId: string,
    readToken: string | undefined,
  ): Promise<void> {
    const { data, error } = await this.supabase
      .from("companies")
      .select("settings")
      .eq("id", companyId)
      .maybeSingle();

    if (error || !data) {
      throw new ForbiddenException("Unknown company");
    }

    const settings = (data.settings ?? {}) as Record<string, unknown>;
    const expected =
      typeof settings.profiles_store_public_token === "string"
        ? settings.profiles_store_public_token.trim()
        : "";

    if (!expected) {
      return;
    }

    const got = (readToken ?? "").trim();
    if (got !== expected) {
      throw new ForbiddenException(
        "Invalid or missing read_token for storefront access",
      );
    }
  }
}
