import { withAuth, admin } from '@/server/auth';
import { getAdminOrders } from '@/server/controllers/orderController';

export const dynamic = 'force-dynamic';

export const GET = withAuth(getAdminOrders, admin);
