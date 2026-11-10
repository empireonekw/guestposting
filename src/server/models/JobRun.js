import mongoose from 'mongoose';

// One document per scheduled job: when it last ran, how it went, when it is
// due next, and a lock so two server processes never run it at once.
const jobRunSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    running: { type: Boolean, default: false },
    startedAt: { type: Date },
    lastRunAt: { type: Date },
    lastStatus: { type: String, enum: ['ok', 'error'] },
    lastResult: { type: String },
    lastError: { type: String },
    nextRunAt: { type: Date },
    runCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.models.JobRun || mongoose.model('JobRun', jobRunSchema);
