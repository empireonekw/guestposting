import { withAuth } from '@/server/auth';
import { getConversation, sendChatMessage, setConversationStatus } from '@/server/controllers/chatController';

export const dynamic = 'force-dynamic';

export const GET = withAuth(getConversation);
export const POST = withAuth(sendChatMessage);
export const PATCH = withAuth(setConversationStatus);
