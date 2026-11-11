'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import api from '@/lib/api';
import ListingForm from '@/components/listing/ListingForm';

const EditListing = () => {
  const { id } = useParams();
  const router = useRouter();
  const [listing, setListing] = useState(null);

  useEffect(() => {
    api.get(`/listings/${id}`)
      .then(({ data }) => setListing(data))
      .catch(() => router.push('/my-listings'));
  }, [id, router]);

  const save = async (payload) => {
    await api.put(`/listings/${id}`, payload);
    router.push('/my-listings');
  };

  return (
    <div className="mx-auto max-w-3xl pb-16">
      <button type="button" onClick={() => router.push('/my-listings')} className="mb-6 inline-flex items-center gap-2 text-[13px] font-medium text-ink-soft hover:text-ink">
        <ArrowLeft size={16} /> Back to my websites
      </button>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Edit website</h1>
      <p className="mb-6 mt-1 text-sm text-ink-soft">{listing ? listing.domain || listing.url : 'Loading…'}</p>
      {listing && <ListingForm mode="edit" initial={listing} onSubmit={save} />}
    </div>
  );
};

export default EditListing;
