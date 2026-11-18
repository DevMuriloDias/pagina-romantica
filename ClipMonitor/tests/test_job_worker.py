import threading
import time

import pytest

from models.job import Job, JobStatus, JobType
from workers.job_worker import JobWorker


def wait_for(predicate, timeout=5.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if predicate():
            return True
        time.sleep(0.02)
    return False


@pytest.fixture
def jobs(repos):
    return repos["jobs"]


def test_enqueue_dedupes_active_jobs(jobs):
    a = jobs.enqueue(Job(JobType.CAPTURE, dedupe_key="capture:1:abc"))
    b = jobs.enqueue(Job(JobType.CAPTURE, dedupe_key="capture:1:abc"))
    assert a.id == b.id
    jobs.finish(a.id, JobStatus.COMPLETED)
    c = jobs.enqueue(Job(JobType.CAPTURE, dedupe_key="capture:1:abc"))
    assert c.id != a.id  # a anterior não está mais ativa


def test_claim_respects_priority_and_types(jobs):
    low = jobs.enqueue(Job(JobType.RENDER, priority=0))
    high = jobs.enqueue(Job(JobType.RENDER, priority=5))
    jobs.enqueue(Job(JobType.CAPTURE, priority=10))
    claimed = jobs.claim_next([JobType.RENDER])
    assert claimed.id == high.id and claimed.status is JobStatus.RUNNING and claimed.attempts == 1
    assert jobs.claim_next([JobType.RENDER]).id == low.id
    assert jobs.claim_next([JobType.RENDER]) is None


def test_worker_runs_job_with_progress(jobs):
    seen = []

    def handler(ctx):
        for i in range(1, 5):
            ctx.progress(i / 4, f"etapa {i}")
            seen.append(i)
        return "ok!"

    worker = JobWorker(jobs, poll_seconds=0.05)
    worker.register(JobType.ANALYSIS, handler)
    worker.start()
    job = worker.enqueue(Job(JobType.ANALYSIS))
    assert wait_for(lambda: jobs.get(job.id).status is JobStatus.COMPLETED)
    worker.stop()
    done = jobs.get(job.id)
    assert done.progress == 1.0 and done.message == "ok!" and done.finished_at is not None
    assert seen == [1, 2, 3, 4]


def test_worker_records_failures_and_retry(jobs):
    calls = []

    def flaky(ctx):
        calls.append(1)
        if len(calls) == 1:
            raise RuntimeError("ffmpeg saiu com código 1")
        return "ok"

    worker = JobWorker(jobs, poll_seconds=0.05)
    worker.register(JobType.RENDER, flaky)
    worker.start()
    job = worker.enqueue(Job(JobType.RENDER))
    assert wait_for(lambda: jobs.get(job.id).status is JobStatus.FAILED)
    assert jobs.get(job.id).error == "ffmpeg saiu com código 1"
    assert worker.retry(job.id)
    assert wait_for(lambda: jobs.get(job.id).status is JobStatus.COMPLETED)
    assert jobs.get(job.id).attempts == 2
    worker.stop()


def test_cancel_running_and_queued(jobs):
    started = threading.Event()

    def long_job(ctx):
        started.set()
        while True:
            ctx.raise_if_cancelled()
            time.sleep(0.01)

    worker = JobWorker(jobs, capture_concurrency=lambda: 1, poll_seconds=0.05)
    worker.register(JobType.CAPTURE, long_job)
    worker.start()
    running = worker.enqueue(Job(JobType.CAPTURE))
    queued = worker.enqueue(Job(JobType.CAPTURE))
    assert started.wait(5)
    assert worker.cancel(queued.id)
    assert jobs.get(queued.id).status is JobStatus.CANCELLED
    assert worker.cancel(running.id)
    assert wait_for(lambda: jobs.get(running.id).status is JobStatus.CANCELLED)
    worker.stop()


def test_concurrency_limit(jobs):
    active, peak, lock = [0], [0], threading.Lock()

    def handler(ctx):
        with lock:
            active[0] += 1
            peak[0] = max(peak[0], active[0])
        time.sleep(0.1)
        with lock:
            active[0] -= 1

    worker = JobWorker(jobs, concurrency=lambda: 2, poll_seconds=0.02)
    worker.register(JobType.TRANSCRIPTION, handler)
    worker.start()
    ids = [worker.enqueue(Job(JobType.TRANSCRIPTION)).id for _ in range(5)]
    assert wait_for(lambda: all(jobs.get(i).status is JobStatus.COMPLETED for i in ids))
    worker.stop()
    assert peak[0] == 2


def test_jobs_without_handler_stay_queued(jobs):
    worker = JobWorker(jobs, poll_seconds=0.02)
    worker.start()
    job = worker.enqueue(Job(JobType.CAPTURE))
    time.sleep(0.1)
    assert jobs.get(job.id).status is JobStatus.QUEUED
    assert not worker.has_handler(JobType.CAPTURE)
    worker.stop()


def test_running_jobs_become_interrupted_on_restart(jobs):
    job = jobs.enqueue(Job(JobType.CAPTURE))
    jobs.claim_next([JobType.CAPTURE])  # simula app fechado no meio
    worker = JobWorker(jobs, poll_seconds=0.02)
    worker.start()
    worker.stop()
    assert jobs.get(job.id).status is JobStatus.INTERRUPTED
    assert jobs.requeue(job.id)
    assert jobs.get(job.id).status is JobStatus.QUEUED


def test_long_capture_does_not_block_processing(jobs):
    release = threading.Event()

    def capture(ctx):
        release.wait(5)

    worker = JobWorker(jobs, concurrency=lambda: 1, capture_concurrency=lambda: 1, poll_seconds=0.02)
    worker.register(JobType.CAPTURE, capture)
    worker.register(JobType.TRANSCRIPTION, lambda ctx: "ok")
    worker.start()
    cap1 = worker.enqueue(Job(JobType.CAPTURE))
    cap2 = worker.enqueue(Job(JobType.CAPTURE))
    trans = worker.enqueue(Job(JobType.TRANSCRIPTION))
    assert wait_for(lambda: jobs.get(trans.id).status is JobStatus.COMPLETED)
    assert jobs.get(cap1.id).status is JobStatus.RUNNING
    assert jobs.get(cap2.id).status is JobStatus.QUEUED  # limite de 1 captura
    release.set()
    assert wait_for(lambda: jobs.get(cap2.id).status is JobStatus.COMPLETED)
    worker.stop()


def test_pause_processing_keeps_captures_running(jobs):
    done = []
    worker = JobWorker(jobs, poll_seconds=0.02)
    worker.register(JobType.CAPTURE, lambda ctx: done.append("capture"))
    worker.register(JobType.RENDER, lambda ctx: done.append("render"))
    worker.set_processing_paused(True)
    worker.start()
    render = worker.enqueue(Job(JobType.RENDER))
    cap = worker.enqueue(Job(JobType.CAPTURE))
    assert wait_for(lambda: jobs.get(cap.id).status is JobStatus.COMPLETED)
    time.sleep(0.1)
    assert jobs.get(render.id).status is JobStatus.QUEUED
    worker.set_processing_paused(False)
    assert wait_for(lambda: jobs.get(render.id).status is JobStatus.COMPLETED)
    worker.stop()


def test_retry_failed_and_prioritize(jobs):
    a = jobs.enqueue(Job(JobType.RENDER))
    b = jobs.enqueue(Job(JobType.RENDER))
    c = jobs.enqueue(Job(JobType.RENDER, priority=3))
    jobs.claim_next([JobType.RENDER])  # c
    jobs.finish(c.id, JobStatus.FAILED, error="x")
    worker = JobWorker(jobs)
    assert worker.retry_failed() == 1 and jobs.get(c.id).status is JobStatus.QUEUED
    assert worker.prioritize(b.id)
    assert jobs.claim_next([JobType.RENDER]).id == b.id  # passou na frente de c (prioridade 3)
    assert a.id


def test_eta():
    from datetime import datetime, timedelta, timezone

    from models.job import eta_seconds

    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    job = Job(JobType.RENDER, status=JobStatus.RUNNING, progress=0.25, started_at=now - timedelta(seconds=10))
    assert eta_seconds(job, now) == pytest.approx(30)
    job.progress = 0.01
    assert eta_seconds(job, now) is None


def test_shutdown_marks_interrupted_not_cancelled(jobs):
    started = threading.Event()

    def long_job(ctx):
        started.set()
        while True:
            ctx.raise_if_cancelled()
            time.sleep(0.01)

    worker = JobWorker(jobs, poll_seconds=0.02)
    worker.register(JobType.CAPTURE, long_job)
    worker.start()
    job = worker.enqueue(Job(JobType.CAPTURE))
    assert started.wait(5)
    worker.stop()
    assert jobs.get(job.id).status is JobStatus.INTERRUPTED
    assert jobs.get(job.id).status.is_retryable
