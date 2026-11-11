import { withAuth, admin } from '@/server/auth';
import { getMetricsReport } from '@/server/controllers/metricsController';

export const dynamic = 'force-dynamic';

export const GET = withAuth(getMetricsReport, admin);
