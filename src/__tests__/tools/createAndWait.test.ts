import { describe, it, expect, beforeEach, beforeAll, afterEach, jest } from '@jest/globals';

let mod: any;
beforeAll(async () => {
  mod = await import('../../tools/createAndWait.js');
});

function makeClient(sequence: any[]) {
  const createAgent = jest.fn().mockResolvedValue(sequence[0]);
  const getAgent = jest.fn();
  for (let i = 1; i < sequence.length; i += 1) {
    getAgent.mockResolvedValueOnce(sequence[i]);
  }
  // Keep returning last state if polled extra times (should not happen)
  getAgent.mockImplementation((id: string) => Promise.resolve(sequence[sequence.length - 1]));
  return { createAgent, getAgent };
}

describe('createAndWait', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01T00:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function flushAllTimers(ms: number) {
    jest.advanceTimersByTime(ms);
    // allow pending microtasks
    await Promise.resolve();
  }

  it('returns FINISHED when agent completes', async () => {
    const client = makeClient([
      { id: 'a1', status: 'CREATING' },
      { id: 'a1', status: 'RUNNING' },
      { id: 'a1', status: 'FINISHED', target: { url: 'u' } },
    ]);

    const promise = mod.createAndWait(
      {
        prompt: { text: 'x' },
        source: { repository: 'r' },
        model: 'auto',
        pollIntervalMs: 500,
        timeoutMs: 10_000,
        jitterRatio: 0,
      },
      client as any,
    );

    await flushAllTimers(0); // after create
    await flushAllTimers(500); // poll 1
    await flushAllTimers(500); // poll 2 -> FINISHED
    const res: any = await promise;
    expect(res.content[1].text).toContain('"finalStatus": "FINISHED"');
  });

  it('returns ERROR when agent errors', async () => {
    const client = makeClient([
      { id: 'a2', status: 'CREATING' },
      { id: 'a2', status: 'ERROR' },
    ]);

    const promise = mod.createAndWait(
      {
        prompt: { text: 'x' },
        source: { repository: 'r' },
        model: 'auto',
        pollIntervalMs: 400,
        timeoutMs: 10_000,
        jitterRatio: 0,
      },
      client as any,
    );

    await flushAllTimers(0);
    await flushAllTimers(400);
    const res: any = await promise;
    expect(res.content[1].text).toContain('"finalStatus": "ERROR"');
  });

  it('returns EXPIRED when agent expires', async () => {
    const client = makeClient([
      { id: 'a3', status: 'CREATING' },
      { id: 'a3', status: 'RUNNING' },
      { id: 'a3', status: 'EXPIRED' },
    ]);

    const promise = mod.createAndWait(
      {
        prompt: { text: 'x' },
        source: { repository: 'r' },
        model: 'auto',
        pollIntervalMs: 300,
        timeoutMs: 10_000,
        jitterRatio: 0,
      },
      client as any,
    );

    await flushAllTimers(0);
    await flushAllTimers(300);
    await flushAllTimers(300);
    const res: any = await promise;
    expect(res.content[1].text).toContain('"finalStatus": "EXPIRED"');
  });

  it('returns TIMEOUT when exceeding timeoutMs', async () => {
    const client = makeClient([
      { id: 'a4', status: 'CREATING' },
      { id: 'a4', status: 'RUNNING' },
      { id: 'a4', status: 'RUNNING' },
    ]);

    const promise = mod.createAndWait(
      {
        prompt: { text: 'x' },
        source: { repository: 'r' },
        model: 'auto',
        pollIntervalMs: 1000,
        timeoutMs: 6000,
        jitterRatio: 0,
      },
      client as any,
    );

    await flushAllTimers(0);
    await flushAllTimers(1000);
    await flushAllTimers(6000); // exceed timeout
    const res: any = await promise;
    expect(res.content[1].text).toContain('"finalStatus": "TIMEOUT"');
  });

  it('returns CANCELLED when cancelToken is triggered', async () => {
    const client = makeClient([
      { id: 'a5', status: 'CREATING' },
      { id: 'a5', status: 'RUNNING' },
      { id: 'a5', status: 'RUNNING' },
    ]);

    const promise = mod.createAndWait(
      {
        prompt: { text: 'x' },
        source: { repository: 'r' },
        model: 'auto',
        pollIntervalMs: 1000,
        timeoutMs: 10_000,
        jitterRatio: 0,
        cancelToken: 'tok'
      },
      client as any,
    );

    await flushAllTimers(0);
    mod.cancelWaitToken('tok');
    await flushAllTimers(1000);
    const res: any = await promise;
    expect(res.content[1].text).toContain('"finalStatus": "CANCELLED"');
  });

  it('clears cancel token after consumption so it can be reused later', async () => {
    const cancelToken = 'reusable-token';

    const firstClient = makeClient([
      { id: 'a6', status: 'CREATING' },
      { id: 'a6', status: 'RUNNING' },
      { id: 'a6', status: 'RUNNING' },
    ]);

    const firstPromise = mod.createAndWait(
      {
        prompt: { text: 'x' },
        source: { repository: 'r' },
        model: 'auto',
        pollIntervalMs: 1000,
        timeoutMs: 10_000,
        jitterRatio: 0,
        cancelToken,
      },
      firstClient as any,
    );

    await flushAllTimers(0);
    mod.cancelWaitToken(cancelToken);
    await flushAllTimers(1000);
    const firstResult: any = await firstPromise;
    expect(firstResult.content[1].text).toContain('"finalStatus": "CANCELLED"');

    const secondClient = makeClient([
      { id: 'a7', status: 'CREATING' },
      { id: 'a7', status: 'RUNNING' },
      { id: 'a7', status: 'FINISHED' },
    ]);

    const secondPromise = mod.createAndWait(
      {
        prompt: { text: 'y' },
        source: { repository: 'r' },
        model: 'auto',
        pollIntervalMs: 500,
        timeoutMs: 10_000,
        jitterRatio: 0,
        cancelToken,
      },
      secondClient as any,
    );

    await flushAllTimers(0);
    await flushAllTimers(500);
    await flushAllTimers(500);
    const secondResult: any = await secondPromise;
    expect(secondResult.content[1].text).toContain('"finalStatus": "FINISHED"');
  });
});

