import mongoose from 'mongoose';
import JobRun from '../models/JobRun';
import { json, serverError } from '../http';
import { groupSummary, trafficSummary, emailSummary, telemetryStartedAt, WINDOW_MINUTES } from '../telemetry';

// GET /api/admin/system: everything the admin "Code flow" page draws. Each
// box gets a status (ok / idle / warn / error / planned), a one-line summary,
// details, and plain-English "what's wrong" notes.

const API_GROUPS = [
  ['auth', '/api/auth', 'Sign-in, sign-up, password reset'],
  ['listings', '/api/listings', 'Publisher list, websites, niches'],
  ['orders', '/api/orders', 'Orders and reviews'],
  ['messages', '/api/messages', 'Chats, support, notifications'],
  ['admin', '/api/admin', 'Admin panel'],
  ['users', '/api/users', 'Profiles and seller pages'],
  ['contact', '/api/contact', 'Contact form'],
];

const SLOW_MS = 1500;
const dev = process.env.NODE_ENV !== 'production';

const fmtMs = (v) => (v === null || v === undefined ? '–' : v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${v} ms`);

const apiNode = ([id, label, about]) => {
  const g = groupSummary(id);
  const issues = [];
  let status = g.total ? 'ok' : 'idle';
  if (g.serverErrors) {
    status = 'error';
    const last = g.recentErrors[0];
    issues.push(`${g.serverErrors} server error${g.serverErrors === 1 ? '' : 's'} in the last ${WINDOW_MINUTES} minutes.${last ? ` Latest on ${last.path}: "${last.message}"` : ''}`);
  }
  if (g.p95 !== null && g.p95 > SLOW_MS) {
    if (status !== 'error') status = 'warn';
    issues.push(`Slow: 1 in 20 requests takes longer than ${fmtMs(g.p95)}. Usually a slow database query or an outside service.`);
  }
  if (g.total >= 10 && g.clientErrors / g.total > 0.5) {
    if (status === 'ok') status = 'warn';
    issues.push(`${g.clientErrors} of ${g.total} requests were refused (400–499): wrong input, expired logins, or someone probing the API.`);
  }
  return {
    id, label, about, status, issues,
    line: g.total ? `${g.perMin}/min · p95 ${fmtMs(g.p95)}` : 'No traffic',
    stats: { perMin: g.perMin, total: g.total, p50: g.p50, p95: g.p95, serverErrors: g.serverErrors, clientErrors: g.clientErrors, lastAt: g.lastAt },
    series: g.series,
    recentErrors: g.recentErrors,
  };
};

const mongoNode = async () => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const state = states[mongoose.connection.readyState] || 'unknown';
  let ping = null;
  let error = null;
  if (mongoose.connection.readyState === 1) {
    const t = performance.now();
    try {
      await mongoose.connection.db.admin().command({ ping: 1 });
      ping = Math.round(performance.now() - t);
    } catch (e) {
      error = e.message;
    }
  }
  const issues = [];
  let status = 'ok';
  if (state !== 'connected' || error) {
    status = 'error';
    issues.push(error ? `The database did not answer: ${error}` : `The app is ${state} from the database.`);
  } else if (ping > 300) {
    status = 'warn';
    issues.push(`The database answers slowly (${ping} ms). Check the MongoDB Atlas region and plan.`);
  }
  return {
    id: 'mongodb', label: 'MongoDB', about: 'Every listing, user, order and chat', status, issues,
    line: state === 'connected' ? `Connected · ping ${ping ?? '–'} ms` : `Not connected (${state})`,
    stats: { state, ping, host: mongoose.connection.host ? mongoose.connection.host.replace(/^[^.]+\./, '…') : null, name: mongoose.connection.name },
  };
};

const emailNode = () => {
  const e = emailSummary();
  const configured = !!(process.env.MY_EMAIL && process.env.EMAIL_PASSWORD);
  const issues = [];
  let status = e.sent || e.failed ? 'ok' : 'idle';
  if (!configured) {
    status = 'warn';
    issues.push('Email is not set up: MY_EMAIL and EMAIL_PASSWORD are missing from .env, so password resets and notices are not sent.');
  }
  if (e.failed) {
    status = 'error';
    issues.push(`${e.failed} email${e.failed === 1 ? '' : 's'} failed in the last ${WINDOW_MINUTES} minutes: "${e.lastError}". For Gmail, check the app password.`);
  }
  return {
    id: 'email', label: 'Email (Gmail SMTP)', about: 'Password resets, rejections, order and chat notices', status, issues,
    line: !configured ? 'Not configured' : e.sent || e.failed ? `${e.sent} sent · ${e.failed} failed` : 'Ready · nothing sent recently',
    stats: { configured, sent: e.sent, failed: e.failed, lastOkAt: e.lastOkAt, lastErrorAt: e.lastErrorAt },
  };
};

const jobsNode = async () => {
  const runs = await JobRun.find().sort({ name: 1 }).lean();
  const failing = runs.filter((r) => r.lastStatus === 'error');
  const lastRun = runs.reduce((m, r) => (r.lastRunAt && (!m || r.lastRunAt > m) ? r.lastRunAt : m), null);
  const issues = failing.map((r) => `Job "${r.name}" failed: ${r.lastError || 'unknown error'}`);
  let status = failing.length ? 'error' : 'ok';
  if (process.env.DISABLE_JOBS === '1') {
    status = 'warn';
    issues.push('Scheduled jobs are turned off (DISABLE_JOBS=1).');
  } else if (!lastRun || Date.now() - new Date(lastRun).getTime() > 2 * 3600000) {
    status = status === 'error' ? 'error' : 'warn';
    issues.push('No job has run in the last 2 hours. The scheduler may not be running in this server process.');
  }
  return {
    id: 'jobs', label: 'Scheduled jobs', about: 'Unfeature listings, clear reset codes, re-check domains', status, issues,
    line: `${runs.length} job${runs.length === 1 ? '' : 's'} · ${failing.length ? `${failing.length} failing` : 'all OK'}`,
    stats: { jobs: runs.map((r) => ({ name: r.name, lastStatus: r.lastStatus, lastRunAt: r.lastRunAt, nextRunAt: r.nextRunAt, lastResult: r.lastResult, lastError: r.lastError, runs: r.runCount })) },
  };
};

export const getSystem = async () => {
  try {
    const traffic = trafficSummary();
    const mem = process.memoryUsage();
    const uptimeMin = Math.round(process.uptime() / 60);

    const edgeIssues = [];
    let edgeStatus = traffic.total ? 'ok' : 'idle';
    if (!dev && traffic.total >= 10 && traffic.viaCloudflare === 0) {
      edgeStatus = 'warn';
      edgeIssues.push('No traffic is coming through Cloudflare. Check that the DNS records are proxied (orange cloud).');
    }

    const nodes = [
      {
        id: 'visitors', label: 'Visitors', about: 'People and bots opening the site', status: traffic.total ? 'ok' : 'idle', issues: [],
        line: `${traffic.perMin} requests/min · ${traffic.visitors} ${traffic.visitors === 1 ? 'person' : 'people'}`,
        stats: { perMin: traffic.perMin, total: traffic.total, visitors: traffic.visitors }, series: traffic.series,
      },
      {
        id: 'edge', label: dev ? 'Direct (local)' : 'Cloudflare + nginx', about: 'Cloudflare protects and caches; nginx forwards to the app', status: edgeStatus, issues: edgeIssues,
        line: dev ? 'Local development' : traffic.total ? `${traffic.viaCloudflare}% via Cloudflare · ${traffic.viaProxy}% via nginx` : 'No traffic yet',
        stats: { viaCloudflare: traffic.viaCloudflare, viaProxy: traffic.viaProxy },
      },
      {
        id: 'server', label: 'proxy.js', about: 'Next.js gateway: every request passes through proxy.js to a page or API route', status: 'ok', issues: [],
        line: `${traffic.perMin}/min passing · up ${uptimeMin >= 60 ? `${Math.floor(uptimeMin / 60)} h` : `${uptimeMin} min`}`,
        stats: { uptimeMin, memoryMb: Math.round(mem.rss / 1048576), heapMb: Math.round(mem.heapUsed / 1048576), node: process.version, env: process.env.NODE_ENV },
        series: traffic.series,
      },
      {
        id: 'pages', label: 'Pages', about: 'Home, publisher lists, site pages, dashboards', status: traffic.pages.total ? 'ok' : 'idle', issues: [],
        line: traffic.pages.total ? `${traffic.pages.perMin}/min` : 'No traffic',
        stats: { perMin: traffic.pages.perMin, total: traffic.pages.total, lastAt: traffic.pages.lastAt }, series: traffic.pages.series,
      },
      ...API_GROUPS.map(apiNode),
      await mongoNode(),
      emailNode(),
      await jobsNode(),
      {
        id: 'payments', label: 'Payments', about: 'Stripe checkout, escrow and payouts', status: 'planned', issues: [],
        line: 'Coming in Module 3', stats: {},
      },
    ];

    // A busy server with errors anywhere is not "ok".
    const server = nodes.find((n) => n.id === 'server');
    const broken = nodes.filter((n) => n.status === 'error' && n.id !== 'server');
    if (broken.length) {
      server.status = 'warn';
      server.issues.push(`Problems in: ${broken.map((n) => n.label).join(', ')}.`);
    }

    return json({ nodes, windowMinutes: WINDOW_MINUTES, since: telemetryStartedAt(), generatedAt: Date.now() });
  } catch (error) {
    return serverError(error);
  }
};
