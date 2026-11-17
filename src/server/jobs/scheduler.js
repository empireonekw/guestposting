import connectDB from '../db';
import JobRun from '../models/JobRun';
import jobs from './index';

// Runs the jobs in ./index.js on their schedule inside the Next.js server
// process (started from src/instrumentation.js). Each job's state lives in
// the JobRun collection, which also works as a lock: a job is claimed with
// one atomic update, so two server processes (for example old and new during
// a deploy) never run it at the same time.

const TICK_MS = 60 * 1000;
const STALE_LOCK_MS = 30 * 60 * 1000; // a run that crashed mid-way is retried after this

const runIfDue = async (job) => {
  const now = new Date();
  await JobRun.updateOne(
    { name: job.name },
    { $setOnInsert: { name: job.name, nextRunAt: now } },
    { upsert: true }
  );

  const claimed = await JobRun.findOneAndUpdate(
    {
      name: job.name,
      nextRunAt: { $lte: now },
      $or: [{ running: { $ne: true } }, { startedAt: { $lt: new Date(now.getTime() - STALE_LOCK_MS) } }],
    },
    { $set: { running: true, startedAt: now } },
    { returnDocument: 'after' }
  );
  if (!claimed) return;

  const update = { running: false, lastRunAt: new Date(), nextRunAt: new Date(Date.now() + job.everyMs) };
  try {
    const result = await job.run();
    update.lastStatus = 'ok';
    update.lastResult = String(result ?? 'done').slice(0, 500);
    update.lastError = undefined;
    console.log(`[jobs] ${job.name}: ${update.lastResult}`);
  } catch (error) {
    update.lastStatus = 'error';
    update.lastError = String(error?.message || error).slice(0, 1000);
    console.error(`[jobs] ${job.name} failed:`, error);
  }
  await JobRun.updateOne({ name: job.name }, { $set: update, $inc: { runCount: 1 } });
};

let ticking = false;
const tick = async () => {
  if (ticking) return; // a slow run never overlaps the next tick
  ticking = true;
  try {
    await connectDB();
    for (const job of jobs) {
      try {
        await runIfDue(job);
      } catch (error) {
        console.error(`[jobs] could not schedule ${job.name}:`, error.message);
      }
    }
  } catch (error) {
    console.error('[jobs] database not reachable, will retry:', error.message);
  } finally {
    ticking = false;
  }
};

export const startScheduler = () => {
  if (globalThis.__letrankScheduler) return; // once per process, even with dev hot reload
  globalThis.__letrankScheduler = setInterval(tick, TICK_MS);
  setTimeout(tick, 5 * 1000);
  console.log(`[jobs] scheduler started (${jobs.map((j) => j.name).join(', ')})`);
};
