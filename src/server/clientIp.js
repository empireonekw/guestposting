import { BlockList, isIP } from 'node:net';

// No other imports: the request proxy (src/proxy.js) uses this too.

// Cloudflare's published edge ranges (cloudflare.com/ips). Only a request
// that nginx received from one of these may say who the visitor is with
// CF-Connecting-IP; anyone can type that header, so from anywhere else it is
// ignored. Update the list if Cloudflare adds ranges.
const CLOUDFLARE = new BlockList();
[
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18',
  '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17',
  '162.158.0.0/15', '104.16.0.0/13', '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
].forEach((r) => { const [ip, bits] = r.split('/'); CLOUDFLARE.addSubnet(ip, Number(bits), 'ipv4'); });
[
  '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32',
  '2a06:98c0::/29', '2c0f:f248::/32',
].forEach((r) => { const [ip, bits] = r.split('/'); CLOUDFLARE.addSubnet(ip, Number(bits), 'ipv6'); });

const fromCloudflare = (ip) => {
  const type = isIP(ip);
  return type ? CLOUDFLARE.check(ip, type === 4 ? 'ipv4' : 'ipv6') : false;
};

// The visitor's address. The app listens on 127.0.0.1 behind nginx, which
// sets X-Real-IP to the address that connected to it (a client could send
// its own X-Real-IP, but nginx overwrites it). When that address is a
// Cloudflare edge, the real visitor is in CF-Connecting-IP. Without nginx
// (local development) Next.js's X-Forwarded-For is used.
export const clientIp = (request) => {
  const headers = request.headers;
  const peer = (headers.get('x-real-ip') || '').trim();
  if (peer) {
    const cf = (headers.get('cf-connecting-ip') || '').trim();
    return cf && fromCloudflare(peer) && isIP(cf) ? cf : peer;
  }
  return (headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local';
};
