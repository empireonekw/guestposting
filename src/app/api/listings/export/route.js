import { withAuth } from '@/server/auth';
import { exportListings } from '@/server/controllers/listingController';

export const dynamic = 'force-dynamic';

// Signed-in users only, so the whole catalogue can't be scraped anonymously.
export const GET = withAuth(exportListings);
