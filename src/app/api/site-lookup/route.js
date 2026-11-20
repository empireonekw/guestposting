import { withAuth } from '@/server/auth';
import { siteLookup } from '@/server/controllers/siteLookupController';

export const dynamic = 'force-dynamic';

export const POST = withAuth(siteLookup);
