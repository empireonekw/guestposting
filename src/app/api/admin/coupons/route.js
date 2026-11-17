import { withAuth, admin } from '@/server/auth';
import { getCoupons, createCoupon } from '@/server/controllers/couponController';

export const dynamic = 'force-dynamic';

export const GET = withAuth(getCoupons, admin);
export const POST = withAuth(createCoupon, admin);
