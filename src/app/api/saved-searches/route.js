import { withAuth } from '@/server/auth';
import { getSavedSearches, createSavedSearch } from '@/server/controllers/savedSearchController';

export const dynamic = 'force-dynamic';

export const GET = withAuth(getSavedSearches);
export const POST = withAuth(createSavedSearch);
