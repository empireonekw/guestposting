import { withAuth, admin } from '@/server/auth';
import { updateCheckedMetrics } from '@/server/controllers/metricsController';

export const dynamic = 'force-dynamic';

// Our team's dated check of a site's numbers.
export const PUT = withAuth(updateCheckedMetrics, admin);
