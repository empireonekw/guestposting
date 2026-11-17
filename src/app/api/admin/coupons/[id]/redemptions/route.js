import { withAuth, admin } from '@/server/auth';
import { getRedemptions } from '@/server/controllers/couponController';

export const dynamic = 'force-dynamic';

export const GET = withAuth(getRedemptions, admin);
