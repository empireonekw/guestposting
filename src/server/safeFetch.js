import dns from 'node:dns';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';

// Fetching pages on websites sellers give us (domain verification, link
// checks) without letting anyone point the server at itself or at private
// networks.

// Addresses the server must never be tricked into requesting: loopback,
// private networks, link-local, carrier NAT, multicast and reserved ranges.
export const isPublicAddress = (address) => {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 192 && b === 0) return false;
    if (a === 198 && (b === 18 || b === 19)) return false;
    return true;
  }
  if (net.isIPv6(address)) {
    const v = address.toLowerCase();
    if (v === '::' || v === '::1') return false;
    if (v.startsWith('::ffff:')) return isPublicAddress(v.slice(7));
    if (/^f[cd]/.test(v) || /^fe[89ab]/.test(v) || v.startsWith('ff')) return false;
    return true;
  }
  return false;
};

// Used as the socket's DNS lookup, so the address that is checked is the one
// actually connected to (no DNS-rebinding gap between check and request).
export const safeLookup = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error);
    const list = Array.isArray(addresses) ? addresses : [{ address: addresses, family: options.family }];
    const allowed = list.filter((a) => isPublicAddress(a.address));
    if (!allowed.length) return callback(new Error('blocked address'));
    if (options.all) return callback(null, allowed);
    return callback(null, allowed[0].address, allowed[0].family);
  });
};


// One GET request (no redirect following). Resolves with
// { status, headers, location, body }; the body is cut at maxBytes.
export const fetchOnce = (url, { maxBytes = 512 * 1024, timeoutMs = 10000, userAgent, accept = 'text/html' } = {}) =>
  new Promise((resolve, reject) => {
    if (net.isIP(url.hostname.replace(/^\[|\]$/g, ''))) {
      reject(new Error('blocked address'));
      return;
    }
    const lib = url.protocol === 'http:' ? http : https;
    const req = lib.get(url, { lookup: safeLookup, timeout: timeoutMs, headers: { 'User-Agent': userAgent, Accept: accept } }, (res) => {
      const done = (body = '') => resolve({ status: res.statusCode, headers: res.headers, location: res.headers.location, body });
      if (res.statusCode >= 300 && res.statusCode < 400) {
        res.resume();
        done();
        return;
      }
      let size = 0;
      const chunks = [];
      res.on('data', (chunk) => {
        size += chunk.length;
        if (size > maxBytes) {
          res.destroy();
          done(Buffer.concat(chunks).toString('utf8'));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => done(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    });
    // A whole-request deadline too, so a server dripping bytes can't hold us.
    const deadline = setTimeout(() => req.destroy(new Error('the page took too long to answer')), timeoutMs * 2);
    req.on('close', () => clearTimeout(deadline));
    req.on('timeout', () => req.destroy(new Error('the page took too long to answer')));
    req.on('error', reject);
  });
