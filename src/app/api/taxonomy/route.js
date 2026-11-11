import { json, route } from '@/server/http';
import { getTaxonomy } from '@/server/taxonomy';

export const dynamic = 'force-dynamic';

// Niches, countries, continents and languages for menus, filters and forms.
export const GET = route(async () => json(await getTaxonomy()));
