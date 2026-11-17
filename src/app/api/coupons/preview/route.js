import { withAuth } from '@/server/auth';
import { previewCoupon } from '@/server/controllers/buyerListsController';

export const dynamic = 'force-dynamic';

export const POST = withAuth(previewCoupon);
