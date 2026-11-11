import { withAuth, admin } from '@/server/auth';
import { getSystem } from '@/server/controllers/systemController';

export const dynamic = 'force-dynamic';

export const GET = withAuth(getSystem, admin);
