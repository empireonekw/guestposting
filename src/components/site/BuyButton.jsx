'use client';

import { useRouter } from 'next/navigation';
import { ShoppingCart } from 'lucide-react';
import useSession from '@/lib/useSession';
import Button from '@/components/ui/Button';

// "Buy" for one listing: opens the one-form order page (signed-out visitors
// sign in first and come back).
const BuyButton = ({ listing, size = 'sm', className = '', label = 'Buy' }) => {
  const router = useRouter();
  const { user } = useSession();
  const start = () => {
    const target = `/order/${listing._id}`;
    router.push(user ? target : `/login?next=${encodeURIComponent(target)}`);
  };
  return <Button size={size} className={className} onClick={start}><ShoppingCart size={14} /> {label}</Button>;
};

export default BuyButton;
