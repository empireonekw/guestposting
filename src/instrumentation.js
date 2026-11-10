// Next.js calls register() once when a server process starts. It starts the
// scheduled-job runner (src/server/jobs). Set DISABLE_JOBS=1 to turn it off.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  if (process.env.DISABLE_JOBS === '1') return;
  const { startScheduler } = await import('./server/jobs/scheduler');
  startScheduler();
}
