import { withAuth } from '@/server/auth';
import { checkoutCart } from '@/server/controllers/buyerListsController';

export const dynamic = 'force-dynamic';

export const POST = withAuth(checkoutCart);
