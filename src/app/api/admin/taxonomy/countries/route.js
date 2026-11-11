import { withAuth, admin } from '@/server/auth';
import { createCountry } from '@/server/controllers/taxonomyController';

export const dynamic = 'force-dynamic';

export const POST = withAuth(createCountry, admin);
