import { withAuth, admin } from '@/server/auth';
import { getAdminTaxonomy } from '@/server/controllers/taxonomyController';

export const dynamic = 'force-dynamic';

export const GET = withAuth(getAdminTaxonomy, admin);
