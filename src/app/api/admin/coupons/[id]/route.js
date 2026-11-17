import { withAuth, admin } from '@/server/auth';
import { updateCoupon } from '@/server/controllers/couponController';

export const dynamic = 'force-dynamic';

export const PUT = withAuth(updateCoupon, admin);
