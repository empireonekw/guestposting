import { withAuth } from '@/server/auth';
import { uploadOrderFile } from '@/server/controllers/orderController';

export const dynamic = 'force-dynamic';

export const POST = withAuth(uploadOrderFile);
