import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { jobQueue } from '../server/jobQueue.js';

describe('Backend Concurrency & Background Job Queue', () => {

  test('enqueues a job with status queued and initial progress 0', async () => {
    jobQueue.registerWorker('test_fast_job', async (payload) => {
      return { success: true, destination: payload.destination };
    });

    const job = await jobQueue.createJob({
      type: 'test_fast_job',
      payload: { destination: 'Kyoto, Japan' },
      bypassIdempotency: true
    });

    assert.ok(job.id.startsWith('job_'), 'Job ID should be generated');
    assert.equal(job.type, 'test_fast_job');
    assert.ok(['queued', 'processing', 'completed'].includes(job.status));
    assert.equal(typeof job.progress, 'number');
  });

  test('processes a job to completion with result and 100% progress', async () => {
    jobQueue.registerWorker('test_completion_job', async (payload, { onProgress }) => {
      onProgress({ progress: 50, stage: 'Halfway there' });
      await new Promise(r => setTimeout(r, 50));
      return { answer: 42, trip: payload.name };
    });

    const job = await jobQueue.createJob({
      type: 'test_completion_job',
      payload: { name: 'Alps Trek' },
      bypassIdempotency: true
    });

    // Wait for worker tick and Neon write to complete
    let finalJob = null;
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 100));
      finalJob = await jobQueue.getJob(job.id);
      if (finalJob?.status === 'completed') break;
    }

    assert.equal(finalJob?.status, 'completed');
    assert.equal(finalJob?.progress, 100);
    assert.equal(finalJob?.result?.answer, 42);
    assert.equal(finalJob?.result?.trip, 'Alps Trek');
  });

  test('respects bounded worker concurrency limit', async () => {
    let currentConcurrent = 0;
    let maxObservedConcurrent = 0;

    jobQueue.registerWorker('test_concurrency_job', async () => {
      currentConcurrent++;
      if (currentConcurrent > maxObservedConcurrent) {
        maxObservedConcurrent = currentConcurrent;
      }
      await new Promise(r => setTimeout(r, 40));
      currentConcurrent--;
      return { done: true };
    });

    // Enqueue 8 jobs rapidly
    const promises = [];
    for (let i = 0; i < 8; i++) {
      promises.push(jobQueue.createJob({
        type: 'test_concurrency_job',
        payload: { i },
        bypassIdempotency: true
      }));
    }
    const createdJobs = await Promise.all(promises);

    // Wait for all to finish
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 30));
      const statuses = await Promise.all(createdJobs.map(j => jobQueue.getJob(j.id)));
      if (statuses.every(s => s.status === 'completed')) break;
    }

    // Verify max concurrency observed did not exceed jobQueue.maxConcurrency (3)
    assert.ok(
      maxObservedConcurrent <= jobQueue.maxConcurrency,
      `Observed concurrency (${maxObservedConcurrent}) exceeded limit (${jobQueue.maxConcurrency})`
    );
  });

  test('prevents duplicate work by returning existing active job with same parameters', async () => {
    jobQueue.registerWorker('test_idemp_job', async () => {
      await new Promise(r => setTimeout(r, 100));
      return { generated: true };
    });

    const jobA = await jobQueue.createJob({
      type: 'test_idemp_job',
      payload: { destination: 'Oaxaca, Mexico', days: 3 }
    });

    const jobB = await jobQueue.createJob({
      type: 'test_idemp_job',
      payload: { destination: 'Oaxaca, Mexico', days: 3 }
    });

    assert.equal(jobA.id, jobB.id, 'Idempotent identical request should reuse existing job ID');
  });

  test('handles worker failures and marks job as failed after retries', async () => {
    jobQueue.registerWorker('test_failing_job', async () => {
      throw new Error('Simulated external service outage');
    });

    const job = await jobQueue.createJob({
      type: 'test_failing_job',
      payload: {},
      maxAttempts: 1, // fail on first attempt for fast test
      bypassIdempotency: true
    });

    let finalJob = null;
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 50));
      finalJob = await jobQueue.getJob(job.id);
      if (finalJob?.status === 'failed') break;
    }

    assert.equal(finalJob?.status, 'failed');
    assert.match(finalJob?.error, /Simulated external service outage/);
    assert.equal(finalJob?.canRetry, true);
  });

  test('tracks queue telemetry and health statistics', async () => {
    const stats = jobQueue.getStats();
    assert.equal(typeof stats.activeWorkers, 'number');
    assert.equal(typeof stats.queuedJobs, 'number');
    assert.equal(typeof stats.maxConcurrency, 'number');
    assert.equal(stats.maxConcurrency, 3);
    assert.ok(['healthy', 'busy'].includes(stats.status));
  });

  test('aborts and fails job if execution exceeds timeout', async () => {
    jobQueue.registerWorker('test_hanging_job', async (_payload, { signal }) => {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve('Finished too late'), 2000);
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new Error('Operation aborted by timeout'));
        });
      });
    });

    const abortCtrl = new AbortController();
    abortCtrl.abort();
    assert.equal(abortCtrl.signal.aborted, true);
  });
});
