import { route } from '@/server/http';
import { checkDomains } from '@/server/controllers/toolsController';

export const dynamic = 'force-dynamic';

// Public: anyone can check domains (rate limited per visitor).
export const POST = route(checkDomains);
