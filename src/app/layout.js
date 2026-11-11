import { Inter } from 'next/font/google';
import 'flag-icons/css/flag-icons.min.css';
import './globals.css';
import BRAND from '@/data/brand';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

const SITE_URL = process.env.FRONTEND_URL || 'https://guestposting.live';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${BRAND.name}: buy guest posts on real sites`,
    template: `%s | ${BRAND.name}`,
  },
  description: 'Find real publishers by niche, country, DR and traffic, and buy guest posts and link insertions.',
  icons: { icon: { url: BRAND.logo.favicon, type: 'image/png' }, apple: BRAND.logo.favicon },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
