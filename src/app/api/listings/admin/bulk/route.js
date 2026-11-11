import { withAuth, admin } from '@/server/auth';
import { bulkReviewListings } from '@/server/controllers/listingController';

export const dynamic = 'force-dynamic';

export const POST = withAuth(bulkReviewListings, admin);
