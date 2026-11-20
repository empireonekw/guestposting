import { withAuth, sellerAny } from '@/server/auth';
import { getSheets } from '@/server/controllers/sheetsController';

export const dynamic = 'force-dynamic';

// Sellers (incl. blocked ones, read-only) and admins.
export const GET = withAuth(getSheets, sellerAny);
