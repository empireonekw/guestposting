import { NextResponse } from 'next/server';
import { recordHit } from '@/server/telemetry';

// Next.js runs this for every request before the page or API route (Node.js
// runtime, same process). It only counts traffic for the admin Code flow
// page; it never changes or blocks a request.
export function proxy(request) {
  const { headers, nextUrl } = request;
  // Link prefetches are the browser guessing, not visits.
  if (!headers.get('next-router-prefetch') && headers.get('purpose') !== 'prefetch') {
    recordHit({ pathname: nextUrl.pathname, headers });
  }
  return NextResponse.next();
}

export const config = {
  // Skip build files, images and other static files.
  matcher: ['/((?!_next/static|_next/image|favicon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff2?|txt|xml|csv)$).*)'],
};
