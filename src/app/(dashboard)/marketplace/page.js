import { redirect } from 'next/navigation';

// The marketplace moved to the public publisher list.
export default function Page() {
  redirect('/sites');
}
