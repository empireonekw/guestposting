'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import api from '@/lib/api';
import ListingForm from '@/components/listing/ListingForm';
import useSession from '@/lib/useSession';

const EditListing = () => {
  const { id } = useParams();
  const router = useRouter();
  const [listing, setListing] = useState(null);
  const { user } = useSession();
  // Admins usually come here from the listing queue.
  const backTo = user?.role === 'admin' ? '/admin/listings' : '/my-listings';
  const backLabel = user?.role === 'admin' ? 'Back to listings' : 'Back to my websites';

  useEffect(() => {
    api.get(`/listings/${id}`)
      .then(({ data }) => setListing(data))
      .catch(() => router.push('/my-listings'));
  }, [id, router]);

  const save = async (payload) => {
    await api.put(`/listings/${id}`, payload);
    router.push(backTo);
  };

  return (
    <div className="mx-auto max-w-3xl pb-16">
      <button type="button" onClick={() => router.push(backTo)} className="mb-6 inline-flex items-center gap-2 text-[13px] font-medium text-ink-soft hover:text-ink">
        <ArrowLeft size={16} /> {backLabel}
      </button>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Edit website</h1>
      <p className="mb-6 mt-1 text-sm text-ink-soft">{listing ? listing.domain || listing.url : 'Loading…'}</p>
      {listing?.status === 'changes_requested' && listing.reviewNote && (
        <div className="mb-6 rounded-2xl border border-brand-200 bg-brand-50 px-5 py-4 text-[14px] text-brand-900">
          <p className="font-semibold">What our team asked you to change</p>
          <p className="mt-0.5">{listing.reviewNote}</p>
          {user?.role !== 'admin' && <p className="mt-2 text-[13px] text-brand-800">Saving sends the site back into our review queue.</p>}
        </div>
      )}
      {listing?.status === 'rejected' && listing.rejectionReason && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-[14px] text-red-900">
          <p className="font-semibold">Why this site was not approved</p>
          <p className="mt-0.5">{listing.rejectionReason}</p>
        </div>
      )}
      {listing && <ListingForm mode="edit" initial={listing} onSubmit={save} />}
    </div>
  );
};

export default EditListing;
