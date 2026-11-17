import { withAuth } from '@/server/auth';
import { getListIds } from '@/server/controllers/buyerListsController';

export const dynamic = 'force-dynamic';

export const GET = withAuth(getListIds);
