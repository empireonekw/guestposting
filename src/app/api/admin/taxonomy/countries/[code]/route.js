import { withAuth, admin } from '@/server/auth';
import { updateCountry, deleteCountry } from '@/server/controllers/taxonomyController';

export const dynamic = 'force-dynamic';

export const PATCH = withAuth(updateCountry, admin);
export const DELETE = withAuth(deleteCountry, admin);
