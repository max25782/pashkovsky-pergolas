import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import type { CurrentUserData } from "../decorators/current-user.decorator";

/**
 * Ensures the JWT flow produced a tenant (`company_id`) from membership
 * (via `X-Company-Id`, `company_id` query, or default membership).
 */
@Injectable()
export class CompanyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: CurrentUserData }>();
    const user = request.user;

    if (!user || !user.company_id) {
      console.error("[CompanyGuard] User missing company_id:", {
        userId: user?.id,
        email: user?.email,
        hasCompanyId: !!user?.company_id,
      });
      throw new ForbiddenException(
        "User must be authenticated with a company membership",
      );
    }

    return true;
  }
}
