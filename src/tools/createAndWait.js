import { createSuccessResponse, handleMCPError, schemas, validateInput } from '../utils/errorHandler.js';
import { setTimeout as sleep } from 'node:timers/promises';

/** @typedef {{ createAgent: (data: any) => Promise<any>, getAgent: (id: string) => Promise<any> }} CursorClient */

const TERMINAL_STATUSES = new Set(['FINISHED', 'ERROR', 'EXPIRED']);

const inMemoryCancellation = new Set();

export function cancelWaitToken(token) {
  if (token) inMemoryCancellation.add(token);
}

function computeDelay(baseMs, jitterRatio) {
  const jitter = (Math.random() * 2 - 1) * jitterRatio; // [-ratio, +ratio]
  const withJitter = baseMs * (1 + jitter);
  return Math.min(60_000, Math.max(250, Math.floor(withJitter)));
}

export async function createAndWait(input, client) {
  try {
    const validated = validateInput(schemas.createAndWaitRequest, input, 'createAndWait');

    const { pollIntervalMs, timeoutMs, jitterRatio, cancelToken, ...createPayload } = validated;

    const start = Date.now();
    const created = await client.createAgent(createPayload);
    const agentId = created.id;

    let lastSnapshot = created;

    if (created?.status && TERMINAL_STATUSES.has(created.status)) {
      const elapsedMs = Date.now() - start;
      return createSuccessResponse(
        `🕒 createAndWait finished immediately with status: ${created.status}`,
        { finalStatus: created.status, agentId, elapsedMs, agent: created },
      );
    }

    while (true) {
      if (cancelToken && inMemoryCancellation.has(cancelToken)) {
        inMemoryCancellation.delete(cancelToken);
        const elapsedMs = Date.now() - start;
        return createSuccessResponse(
          '🛑 createAndWait cancelled',
          { finalStatus: 'CANCELLED', agentId, elapsedMs, agent: lastSnapshot || null },
        );
      }

      const elapsed = Date.now() - start;
      if (elapsed > timeoutMs) {
        return createSuccessResponse(
          '⏰ createAndWait timed out',
          { finalStatus: 'TIMEOUT', agentId, elapsedMs: elapsed, agent: lastSnapshot || null },
        );
      }

      try {
        const current = await client.getAgent(agentId);
        lastSnapshot = current;
        if (current?.status && TERMINAL_STATUSES.has(current.status)) {
          const elapsedMs = Date.now() - start;
          return createSuccessResponse(
            `✅ createAndWait completed with status: ${current.status}`,
            { finalStatus: current.status, agentId, elapsedMs, agent: current },
          );
        }
      } catch (_pollErr) {
        // Swallow transient poll errors and continue until timeout
      }

      const delay = computeDelay(pollIntervalMs, jitterRatio);
      await sleep(delay);
    }
  } catch (error) {
    return handleMCPError(error, 'createAndWait');
  }
}

