import { withAuth, admin } from '@/server/auth';
import { getFlowItems } from '@/server/controllers/flowController';

export const dynamic = 'force-dynamic';

export const GET = withAuth(getFlowItems, admin);
