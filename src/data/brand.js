// The site's name, tagline and logo files. Change them here and every page,
// email and chat label follows. Logo images live in public/brand/.
const BRAND = {
  name: 'Guest Posting',
  // The wordmark is drawn in two colours, like the logo: first + second.
  wordmark: ['Guest', 'Posting'],
  tagline: 'Buy guest posts. Build authority.',
  promise: 'Quality articles · Strong backlinks · Real growth',
  supportName: 'Guest Posting support',
  // Shown on the contact page, footer, policies and contact section.
  supportEmail: 'guestpost.lives@gmail.com',
  logo: {
    mark: '/brand/logo-mark.png', // icon only (600 x 366), for headers and menus
    full: '/brand/logo-full.webp', // full logo with name and tagline (square)
    favicon: '/brand/favicon.png', // browser tab icon (192 x 192)
    markRatio: 600 / 366,
  },
  // Logo colours, for the wordmark.
  colors: { navy: '#0f2350', blue: '#1f5fbf', blueLight: '#7fb0ff' },
};

export default BRAND;
