import { withAuth, seller } from '@/server/auth';
import { logOwnPost } from '@/server/controllers/orderController';

export const dynamic = 'force-dynamic';

export const POST = withAuth(logOwnPost, seller);
