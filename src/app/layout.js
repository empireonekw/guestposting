import { Inter } from 'next/font/google';
import 'flag-icons/css/flag-icons.min.css';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

const SITE_URL = process.env.FRONTEND_URL || 'https://guestposting.live';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'LetRank: Guest posting marketplace',
    template: '%s | LetRank',
  },
  description: 'Find real publishers by niche, country, DR and traffic, and buy guest posts and link insertions.',
  icons: { icon: { url: '/favicon.svg', type: 'image/svg+xml' } },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
