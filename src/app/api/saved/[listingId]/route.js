import { withAuth } from '@/server/auth';
import { removeFromList } from '@/server/controllers/buyerListsController';

export const dynamic = 'force-dynamic';

export const DELETE = withAuth(removeFromList('saved'));
