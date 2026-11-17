import { withAuth } from '@/server/auth';
import { getList, addToList } from '@/server/controllers/buyerListsController';

export const dynamic = 'force-dynamic';

export const GET = withAuth(getList('saved'));
export const POST = withAuth(addToList('saved'));
