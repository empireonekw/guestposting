import Link from 'next/link';
import mongoose from 'mongoose';
import { ChevronRight } from 'lucide-react';
import connectDB from '@/server/db';
import Listing from '@/server/models/Listing';
import Review from '@/server/models/Review';
import { getTaxonomy } from '@/server/taxonomy';
import { PUBLIC_FIELDS, toPlain, hiddenSellerIds } from '@/server/listingSearch';
import CompareTable from '@/components/buying/CompareTable';
import { MAX_COMPARE } from '@/data/compare';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Compare publishers side by side',
  description: 'Compare guest posting sites by price, DR, DA, traffic, link type, turnaround and more.',
  robots: { index: false },
};

// /compare?ids=a,b,c: up to four live listings side by side (Module 6). The
// ids live in the address so a comparison can be shared.
const loadListings = async (raw) => {
  const ids = String(raw || '').split(',').map((s) => s.trim()).filter((s) => mongoose.isValidObjectId(s)).slice(0, MAX_COMPARE);
  if (!ids.length) return [];
  await connectDB();
  const hidden = await hiddenSellerIds();
  const rows = await Listing.find({
    _id: { $in: ids },
    status: 'approved',
    isDeleted: { $ne: true },
    ...(hidden.length ? { seller: { $nin: hidden } } : {}),
  })
    .select(PUBLIC_FIELDS)
    .populate('seller', 'name')
    .lean();
  const sellers = [...new Set(rows.map((r) => String(r.seller?._id)))].map((id) => new mongoose.Types.ObjectId(id));
  const ratings = await Review.aggregate([
    { $match: { seller: { $in: sellers } } },
    { $group: { _id: '$seller', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  const ratingOf = new Map(ratings.map((r) => [String(r._id), { avg: r.avg, count: r.count }]));
  // Keep the order the buyer picked.
  const byId = new Map(rows.map((r) => [String(r._id), r]));
  return toPlain(ids.map((id) => byId.get(id)).filter(Boolean).map((r) => ({
    ...r,
    rating: ratingOf.get(String(r.seller?._id)) || { avg: 0, count: 0 },
  })));
};

export default async function Page({ searchParams }) {
  const params = await searchParams;
  const asked = String(params?.ids || '').split(',').filter(Boolean).length;
  const [listings, taxonomy] = await Promise.all([loadListings(params?.ids), getTaxonomy()]);
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1 text-[13px] text-ink-faint">
        <Link href="/" className="hover:text-ink">Home</Link>
        <ChevronRight size={12} />
        <Link href="/sites" className="hover:text-ink">Publishers</Link>
        <ChevronRight size={12} />
        <span className="text-ink-soft">Compare</span>
      </nav>
      <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">Compare publishers</h1>
      <p className="mt-2 max-w-3xl text-[15px] text-ink-soft">
        Up to {MAX_COMPARE} sites side by side. The best value in each row is highlighted.
      </p>
      <div className="mt-6">
        <CompareTable listings={listings} missing={Math.max(0, asked - listings.length)} taxonomy={taxonomy} />
      </div>
    </div>
  );
}
