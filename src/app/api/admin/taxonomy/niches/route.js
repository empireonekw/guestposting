import { withAuth, admin } from '@/server/auth';
import { createNiche } from '@/server/controllers/taxonomyController';

export const dynamic = 'force-dynamic';

export const POST = withAuth(createNiche, admin);
