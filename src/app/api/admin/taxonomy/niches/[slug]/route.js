import { withAuth, admin } from '@/server/auth';
import { updateNiche, deleteNiche } from '@/server/controllers/taxonomyController';

export const dynamic = 'force-dynamic';

export const PATCH = withAuth(updateNiche, admin);
export const DELETE = withAuth(deleteNiche, admin);
