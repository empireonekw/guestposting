const BASE = (process.env.FRONTEND_URL || 'https://guestposting.live').replace(/\/$/, '');

export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Signed-in areas and the API have nothing for search engines.
      disallow: ['/api/', '/admin', '/orders', '/profile', '/my-listings', '/add-listing', '/edit-listing', '/marketplace'],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
