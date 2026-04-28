import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { attachUserFromBearer } from "../auth/attach-user-from-bearer";

/**
 * When `Authorization: Bearer` is present, validates JWT and attaches `req.user`
 * (same shape as AuthGuard). When absent, leaves `req.user` unset (anonymous).
 */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return true;
    }

    try {
      await attachUserFromBearer(request);
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      console.error("[OptionalAuthGuard]", e);
      throw new UnauthorizedException("Authentication failed");
    }

    return true;
  }
}
