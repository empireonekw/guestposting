import { withAuth, admin } from '@/server/auth';
import { getOverview } from '@/server/controllers/overviewController';

export const dynamic = 'force-dynamic';

export const GET = withAuth(getOverview, admin);
