import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { hasProfilesAccess } from "../../config/supabase.config";

/**
 * Company Guard - Ensures only Pashkovsky Group can access profiles module
 */
@Injectable()
export class CompanyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.company_id) {
      console.error("[CompanyGuard] User missing company_id:", {
        userId: user?.id,
        email: user?.email,
        hasCompanyId: !!user?.company_id,
      });
      throw new ForbiddenException(
        "User must be authenticated with company_id",
      );
    }

    const hasAccess = hasProfilesAccess(user.company_id);

    if (!hasAccess) {
      console.warn("[CompanyGuard] Access denied:", {
        userId: user.id,
        email: user.email,
        companyId: user.company_id,
        expectedCompanyId: process.env.PASHKOVSKY_COMPANY_ID,
      });
      throw new ForbiddenException(
        "Profiles module is not enabled for your company",
      );
    }

    return true;
  }
}
