import type { Request } from "express";
import { UnauthorizedException } from "@nestjs/common";
import { getSupabaseAdmin } from "../../config/supabase.config";
import {
  pickActiveCompanyId,
  type CompanyMembershipRow,
} from "./resolve-active-company";

function headerString(req: Request, name: string): string | undefined {
  const raw = req.headers[name.toLowerCase()];
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw[0];
  return undefined;
}

/**
 * Validates JWT, loads memberships, sets `req.user` (including `company_id` from header/query/fallback).
 */
export async function attachUserFromBearer(req: Request): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new UnauthorizedException(
      "Missing or invalid authorization header",
    );
  }

  const token = authHeader.substring(7);
  const supabase = getSupabaseAdmin();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new UnauthorizedException("Invalid token");
  }

  const { data: membershipRows, error: memberError } = await supabase
    .from("company_members")
    .select("company_id, role, joined_at")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false });

  if (memberError) {
    console.warn(
      "[attachUserFromBearer] company_members:",
      memberError.message,
    );
  }

  const rows = (membershipRows ?? []) as CompanyMembershipRow[];
  const headerCid = headerString(req, "x-company-id");
  const queryCid =
    typeof req.query["company_id"] === "string"
      ? req.query["company_id"]
      : undefined;

  const picked = pickActiveCompanyId(rows, headerCid, queryCid);

  (req as Request & { user: unknown }).user = {
    id: user.id,
    email: user.email,
    company_id: picked.companyId,
    role: picked.role ?? (user.user_metadata?.role as string | null) ?? null,
    company_ids: rows.map((r) => r.company_id),
  };
}
