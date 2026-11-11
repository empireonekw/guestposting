import { withAuth } from '@/server/auth';
import { listConversations, startConversation } from '@/server/controllers/chatController';

export const dynamic = 'force-dynamic';

export const GET = withAuth(listConversations);
export const POST = withAuth(startConversation);
