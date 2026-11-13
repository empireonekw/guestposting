import { withAuth, admin } from '@/server/auth';
import { getAdminLinks } from '@/server/controllers/linksController';

export const dynamic = 'force-dynamic';

export const GET = withAuth(getAdminLinks, admin);
