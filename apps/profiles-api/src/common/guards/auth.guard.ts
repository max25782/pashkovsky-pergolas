import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { getSupabaseAdmin } from '../../config/supabase.config';

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);

    try {
      const supabase = getSupabaseAdmin();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);

      if (error || !user) {
        throw new UnauthorizedException('Invalid token');
      }

      // Get company_id from company_members table (not from user_metadata)
      let company_id: string | null = null;
      let role: string | null = null;

      const { data: membership, error: memberError } = await supabase
        .from('company_members')
        .select('company_id, role')
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (memberError) {
        console.warn('[AuthGuard] Error fetching company membership:', memberError.message);
      }

      if (!memberError && membership) {
        company_id = membership.company_id;
        role = membership.role;
        console.log('[AuthGuard] User company_id:', company_id, 'role:', role);
      } else {
        console.warn('[AuthGuard] User not found in company_members table:', user.id);
      }

      // Attach user to request
      request.user = {
        id: user.id,
        email: user.email,
        company_id,
        role: role || user.user_metadata?.role || null,
      };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      console.error('[AuthGuard] Error:', error);
      throw new UnauthorizedException('Authentication failed');
    }
  }
}
