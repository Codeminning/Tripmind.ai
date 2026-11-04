/**
 * TripMind AI - Bounded Concurrency Job Queue
 * 
 * Provides enterprise background job execution with:
 * - 1. Stop Duplicate Work: Idempotency keys prevent duplicate generation tasks
 * - 2. Limit Retries: Bounded attempts (3 max) with exponential backoff & jitter
 * - 3. Set Worker Limits: Max active concurrency (3) and queue capacity limits (50 max)
 * - 4. Show Job Status: Detailed stages, progress percentage, and queue positions
 * - 5. Keep Private Data Safe: Sanitized payloads and unguessable crypto IDs
 * - 6. Test When Things Go Wrong: Timeout aborts, DB fallbacks, and recovery
 * - 7. Watch for Slowdowns: Real-time telemetry, queue depth, and health metrics
 */

import crypto from 'node:crypto';
import { sql } from './db.js';

class JobQueue {
  constructor(options = {}) {
    this.maxConcurrency = Number(options.maxConcurrency || process.env.MAX_CONCURRENT_JOBS || 3);
    this.maxQueueDepth = Number(options.maxQueueDepth || 50);
    this.defaultTimeoutMs = Number(options.defaultTimeoutMs || 50000); // 50s timeout
    this.workers = new Map();
    this.memoryJobs = new Map();
    this.activeJobs = new Set();
    this.isTicking = false;

    // Telemetry & metrics
    this.totalCompleted = 0;
    this.totalFailed = 0;
    this.recentDurationsMs = [];
  }

  /**
   * Register a worker handler for a specific job type.
   * @param {string} type 
   * @param {function(payload, { onProgress, signal }): Promise<any>} handler 
   */
  registerWorker(type, handler) {
    this.workers.set(type, handler);
  }

  /**
   * Generate a deterministic idempotency key to prevent duplicate work.
   */
  generateIdempotencyKey(type, payload = {}) {
    if (type === 'generate_itinerary') {
      const dest = (payload.destination || '').trim().toLowerCase();
      const start = (payload.startDate || 'flexible').trim().toLowerCase();
      const days = Number(payload.days) || 3;
      const budget = (payload.budget || 'mid').trim().toLowerCase();
      const travelers = Number(payload.travelers) || 1;
      return `idemp:${type}:${dest}:${start}:${days}:${budget}:${travelers}`;
    }
    return `idemp:${type}:${crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 16)}`;
  }

  /**
   * Create and enqueue a new background job with idempotency and queue depth protection.
   */
  async createJob({ type, payload = {}, maxAttempts = 3, bypassIdempotency = false }) {
    if (!this.workers.has(type)) {
      throw new Error(`No worker registered for job type: ${type}`);
    }

    const idempKey = this.generateIdempotencyKey(type, payload);

    // 1. STOP DUPLICATE WORK: check if an identical job is active or completed within the last 5 minutes
    if (!bypassIdempotency) {
      for (const existing of this.memoryJobs.values()) {
        if (existing.idempotency_key === idempKey) {
          // If queued or processing, return existing job to avoid running duplicate AI tasks
          if (existing.status === 'queued' || existing.status === 'processing') {
            return this.formatJob(existing);
          }
          // If completed within last 5 minutes, reuse the result
          if (existing.status === 'completed' && existing.completed_at) {
            const ageMs = Date.now() - new Date(existing.completed_at).getTime();
            if (ageMs < 5 * 60 * 1000) {
              return this.formatJob(existing);
            }
          }
        }
      }
    }

    // 3. SET WORKER & QUEUE LIMITS: check queue depth to prevent memory overflow
    const queuedCount = Array.from(this.memoryJobs.values()).filter(j => j.status === 'queued').length;
    if (queuedCount >= this.maxQueueDepth) {
      const err = new Error('The travel planning service is currently experiencing high demand. Please try again shortly.');
      err.code = 'QUEUE_FULL';
      err.status = 429;
      throw err;
    }

    // 5. KEEP PRIVATE DATA SAFE: Generate unguessable crypto ID and sanitize payload
    const randomHex = crypto.randomBytes(8).toString('hex');
    const id = `job_${Date.now()}_${randomHex}`;
    const nowIso = new Date().toISOString();

    // Sanitize payload to only keep permitted safe fields
    const safePayload = { ...payload };
    delete safePayload.password;
    delete safePayload.token;
    delete safePayload.secret;
    delete safePayload.apiKey;

    const job = {
      id,
      type,
      idempotency_key: idempKey,
      status: 'queued',
      progress: 0,
      stage: 'Queued for processing',
      payload: safePayload,
      result: null,
      error: null,
      attempts: 0,
      max_attempts: Math.max(1, Math.min(5, maxAttempts)),
      created_at: nowIso,
      updated_at: nowIso,
      completed_at: null,
      started_at: null
    };

    // Store in-memory
    this.memoryJobs.set(id, job);

    // Persist to Neon Postgres if connected
    if (sql) {
      try {
        await sql`
          INSERT INTO background_jobs (
            id, type, status, progress, stage, payload, result, error, attempts, max_attempts, created_at, updated_at
          ) VALUES (
            ${id}, ${type}, 'queued', 0, 'Queued for processing',
            ${JSON.stringify(safePayload)}::jsonb, NULL, NULL, 0, ${job.max_attempts},
            NOW(), NOW()
          )
        `;
      } catch (err) {
        console.warn('[JobQueue] Neon insert job warning, using in-memory queue:', err.message);
      }
    }

    // Trigger queue processing tick
    setTimeout(() => this.tick(), 10);

    return this.formatJob(job);
  }

  /**
   * Fetch a job by ID.
   */
  async getJob(id) {
    if (!id) return null;

    let job = this.memoryJobs.get(id);
    if (job) {
      return this.formatJob(job);
    }

    // Fallback to Neon DB
    if (sql) {
      try {
        const rows = await sql`
          SELECT id, type, status, progress, stage, payload, result, error, attempts, max_attempts, created_at, updated_at, completed_at
          FROM background_jobs
          WHERE id = ${id}
          LIMIT 1
        `;
        if (rows.length > 0) {
          job = rows[0];
          this.memoryJobs.set(id, job);
          return this.formatJob(job);
        }
      } catch (err) {
        console.warn('[JobQueue] Neon fetch job warning:', err.message);
      }
    }

    return null;
  }

  /**
   * Format job object for external API consumers with queue position and actionable states.
   */
  formatJob(job) {
    let queuePosition = null;
    if (job.status === 'queued') {
      const createdTime = new Date(job.created_at || job.createdAt).getTime();
      let ahead = 0;
      for (const other of this.memoryJobs.values()) {
        if (other.status === 'queued' && new Date(other.created_at || other.createdAt).getTime() < createdTime) {
          ahead++;
        }
      }
      queuePosition = ahead + 1;
    }

    return {
      id: job.id,
      type: job.type,
      status: job.status,
      progress: Number(job.progress) || 0,
      stage: job.stage || '',
      queuePosition,
      result: job.result || null,
      error: job.error || null,
      attempts: Number(job.attempts) || 0,
      maxAttempts: Number(job.max_attempts) || 3,
      canRetry: job.status === 'failed',
      createdAt: job.created_at || job.createdAt,
      updatedAt: job.updated_at || job.updatedAt,
      completedAt: job.completed_at || job.completedAt
    };
  }

  /**
   * Update progress & stage of a running job.
   */
  async updateProgress(id, progress, stage) {
    const job = this.memoryJobs.get(id);
    const nowIso = new Date().toISOString();

    if (job) {
      job.progress = Math.min(99, Math.max(0, Math.round(progress)));
      if (stage) job.stage = stage;
      job.updated_at = nowIso;
    }

    if (sql) {
      try {
        await sql`
          UPDATE background_jobs
          SET progress = ${job ? job.progress : progress},
              stage = ${stage || null},
              updated_at = NOW()
          WHERE id = ${id}
        `;
      } catch (e) {}
    }
  }

  /**
   * Process next jobs up to maxConcurrency.
   */
  async tick() {
    if (this.isTicking) return;
    this.isTicking = true;

    try {
      while (this.activeJobs.size < this.maxConcurrency) {
        let nextJob = null;
        for (const job of this.memoryJobs.values()) {
          if (job.status === 'queued') {
            nextJob = job;
            break;
          }
        }

        if (!nextJob && sql) {
          try {
            const rows = await sql`
              SELECT * FROM background_jobs
              WHERE status = 'queued'
              ORDER BY created_at ASC
              LIMIT 1
            `;
            if (rows.length > 0) {
              nextJob = rows[0];
              this.memoryJobs.set(nextJob.id, nextJob);
            }
          } catch (e) {}
        }

        if (!nextJob) break;

        this.runJob(nextJob);
      }
    } finally {
      this.isTicking = false;
    }
  }

  /**
   * Execute a single background job with timeout, progress tracking, and error handling.
   */
  async runJob(job) {
    const jobId = job.id;
    this.activeJobs.add(jobId);

    const handler = this.workers.get(job.type);
    if (!handler) {
      this.markFailed(jobId, `Handler not found for job type: ${job.type}`);
      this.activeJobs.delete(jobId);
      this.tick();
      return;
    }

    job.status = 'processing';
    job.attempts = (job.attempts || 0) + 1;
    job.stage = 'Starting job processing...';
    job.progress = 10;
    job.started_at = new Date().toISOString();
    job.updated_at = new Date().toISOString();

    if (sql) {
      try {
        await sql`
          UPDATE background_jobs
          SET status = 'processing', attempts = ${job.attempts}, stage = ${job.stage}, progress = 10, updated_at = NOW()
          WHERE id = ${jobId}
        `;
      } catch (e) {}
    }

    const abortController = new AbortController();
    const startTime = Date.now();
    const timer = setTimeout(() => {
      abortController.abort(new Error(`Execution timed out after ${this.defaultTimeoutMs / 1000} seconds`));
    }, this.defaultTimeoutMs);

    try {
      const onProgress = ({ progress, stage }) => {
        this.updateProgress(jobId, progress, stage);
      };

      const result = await handler(job.payload, {
        onProgress,
        signal: abortController.signal
      });

      clearTimeout(timer);
      const duration = Date.now() - startTime;
      this.recordDuration(duration);
      this.totalCompleted++;

      await this.markCompleted(jobId, result);
    } catch (err) {
      clearTimeout(timer);
      const isAbort = abortController.signal.aborted;
      const errMsg = isAbort 
        ? `Operation timed out after ${this.defaultTimeoutMs / 1000}s. The service may be busy.` 
        : (err.message || 'Job processing failed');

      // 2. LIMIT RETRIES: only retry if attempts < max_attempts and not an explicit abort timeout
      if (job.attempts < (job.max_attempts || 3) && !isAbort) {
        const jitter = Math.floor(Math.random() * 500);
        const backoffMs = Math.min(30000, Math.pow(2, job.attempts) * 1000 + jitter);
        console.warn(`[JobQueue] Job ${jobId} failed attempt ${job.attempts}. Retrying in ${backoffMs}ms...`);
        job.status = 'queued';
        job.stage = `Retrying in ${Math.round(backoffMs / 1000)}s (attempt ${job.attempts + 1} of ${job.max_attempts})...`;
        setTimeout(() => this.tick(), backoffMs);
      } else {
        this.totalFailed++;
        await this.markFailed(jobId, errMsg);
      }
    } finally {
      this.activeJobs.delete(jobId);
      this.tick();
    }
  }

  async markCompleted(id, result) {
    const job = this.memoryJobs.get(id);
    const nowIso = new Date().toISOString();

    if (job) {
      job.status = 'completed';
      job.progress = 100;
      job.stage = 'Completed successfully';
      job.result = result;
      job.completed_at = nowIso;
      job.updated_at = nowIso;
    }

    if (sql) {
      try {
        await sql`
          UPDATE background_jobs
          SET status = 'completed',
              progress = 100,
              stage = 'Completed successfully',
              result = ${JSON.stringify(result)}::jsonb,
              completed_at = NOW(),
              updated_at = NOW()
          WHERE id = ${id}
        `;
      } catch (e) {
        console.warn('[JobQueue] Failed to record completed job in Neon:', e.message);
      }
    }
  }

  async markFailed(id, errorMessage) {
    const job = this.memoryJobs.get(id);
    const nowIso = new Date().toISOString();

    if (job) {
      job.status = 'failed';
      job.stage = 'Failed';
      job.error = errorMessage;
      job.updated_at = nowIso;
    }

    if (sql) {
      try {
        await sql`
          UPDATE background_jobs
          SET status = 'failed',
              stage = 'Failed',
              error = ${errorMessage},
              updated_at = NOW()
        `;
      } catch (e) {
        console.warn('[JobQueue] Failed to record failed job in Neon:', e.message);
      }
    }
  }

  recordDuration(ms) {
    this.recentDurationsMs.push(ms);
    if (this.recentDurationsMs.length > 50) {
      this.recentDurationsMs.shift();
    }
  }

  /**
   * 7. WATCH FOR SLOWDOWNS: Telemetry & health metrics for queue observability.
   */
  getStats() {
    let queued = 0;
    let processing = 0;
    for (const job of this.memoryJobs.values()) {
      if (job.status === 'queued') queued++;
      else if (job.status === 'processing') processing++;
    }

    const avgDuration = this.recentDurationsMs.length > 0
      ? Math.round(this.recentDurationsMs.reduce((a, b) => a + b, 0) / this.recentDurationsMs.length)
      : null;

    return {
      activeWorkers: this.activeJobs.size,
      maxConcurrency: this.maxConcurrency,
      queuedJobs: queued,
      maxQueueDepth: this.maxQueueDepth,
      processingJobs: processing,
      totalCompleted: this.totalCompleted,
      totalFailed: this.totalFailed,
      avgDurationMs: avgDuration,
      status: queued > 10 ? 'busy' : 'healthy'
    };
  }

  /**
   * Periodic garbage collection of old completed or failed jobs (> 24 hours).
   */
  async cleanupOldJobs(maxAgeHours = 24) {
    const cutoff = Date.now() - (maxAgeHours * 60 * 60 * 1000);

    for (const [id, job] of this.memoryJobs.entries()) {
      if ((job.status === 'completed' || job.status === 'failed') && new Date(job.updated_at).getTime() < cutoff) {
        this.memoryJobs.delete(id);
      }
    }

    if (sql) {
      try {
        await sql`
          DELETE FROM background_jobs
          WHERE status IN ('completed', 'failed')
            AND updated_at < NOW() - INTERVAL '24 hours'
        `;
      } catch (e) {}
    }
  }
}

// Global Singleton Instance
export const jobQueue = new JobQueue({
  maxConcurrency: 3,
  maxQueueDepth: 50,
  defaultTimeoutMs: 50000 // 50 seconds max per AI generation
});

export default jobQueue;
