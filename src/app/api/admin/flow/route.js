import { withAuth, admin } from '@/server/auth';
import { getFlow } from '@/server/controllers/flowController';

export const dynamic = 'force-dynamic';

export const GET = withAuth(getFlow, admin);
