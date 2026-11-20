import { withAuth, sellerAny } from '@/server/auth';
import { downloadSheet } from '@/server/controllers/sheetsController';

export const dynamic = 'force-dynamic';

export const GET = withAuth(downloadSheet, sellerAny);
