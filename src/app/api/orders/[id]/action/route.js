import { withAuth } from '@/server/auth';
import { orderAction } from '@/server/controllers/orderController';

export const dynamic = 'force-dynamic';

export const POST = withAuth(orderAction);
