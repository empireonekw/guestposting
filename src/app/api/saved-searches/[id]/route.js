import { withAuth } from '@/server/auth';
import { updateSavedSearch, deleteSavedSearch } from '@/server/controllers/savedSearchController';

export const dynamic = 'force-dynamic';

export const PUT = withAuth(updateSavedSearch);
export const DELETE = withAuth(deleteSavedSearch);
