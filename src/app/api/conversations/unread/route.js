import { withAuth } from '@/server/auth';
import { unreadCounts } from '@/server/controllers/chatController';

export const dynamic = 'force-dynamic';

export const GET = withAuth(unreadCounts);
