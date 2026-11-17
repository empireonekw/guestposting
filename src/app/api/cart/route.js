import { withAuth } from '@/server/auth';
import { getList, addToList, clearCart } from '@/server/controllers/buyerListsController';

export const dynamic = 'force-dynamic';

export const GET = withAuth(getList('cart'));
export const POST = withAuth(addToList('cart'));
export const DELETE = withAuth(clearCart);
