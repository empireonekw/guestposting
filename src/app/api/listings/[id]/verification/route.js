import { withAuth, seller } from '@/server/auth';
import { getVerification, checkVerification } from '@/server/controllers/verificationController';

export const dynamic = 'force-dynamic';

export const GET = withAuth(getVerification, seller);
export const POST = withAuth(checkVerification, seller);
