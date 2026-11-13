import { withAuth } from '@/server/auth';
import { downloadFile } from '@/server/controllers/orderController';

export const dynamic = 'force-dynamic';

export const GET = withAuth(downloadFile);
