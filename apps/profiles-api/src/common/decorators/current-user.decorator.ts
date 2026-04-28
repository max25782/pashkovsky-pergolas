import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface CurrentUserData {
  id: string;
  email: string | undefined;
  company_id: string | null;
  role?: string | null;
  /** All companies this user belongs to (newest membership first). */
  company_ids?: string[];
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CurrentUserData | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as CurrentUserData | undefined;
  },
);
