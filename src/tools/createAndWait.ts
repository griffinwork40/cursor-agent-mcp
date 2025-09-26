import { createSuccessResponse, handleMCPError, schemas, validateInput } from '../utils/errorHandler.js';

type CursorClient = {
  createAgent: (data: any) => Promise<any>;
  getAgent: (id: string) => Promise<any>;
};

const TERMINAL_STATUSES = new Set(['FINISHED', 'ERROR', 'EXPIRED']);

const inMemoryCancellation = new Set<string>();

export function cancelWaitToken(token: string): void {
  if (token) inMemoryCancellation.add(token);
}

function computeDelay(baseMs: number, jitterRatio: number): number {
  const jitter = (Math.random() * 2 - 1) * jitterRatio; // [-ratio, +ratio]
  const withJitter = baseMs * (1 + jitter);
  return Math.min(60_000, Math.max(250, Math.floor(withJitter)));
}

export async function createAndWait(input: any, client: CursorClient) {
  try {
    const validated = validateInput(schemas.createAndWaitRequest, input, 'createAndWait');

    const { pollIntervalMs, timeoutMs, jitterRatio, cancelToken, ...createPayload } = validated;

    const start = Date.now();
    const created = await client.createAgent(createPayload);
    const agentId: string = created.id;

    let lastSnapshot: any = created;

    // Immediate terminal check if creation returns terminal (unlikely but safe)
    if (created?.status && TERMINAL_STATUSES.has(created.status)) {
      const elapsedMs = Date.now() - start;
      return createSuccessResponse(
        `🕒 createAndWait finished immediately with status: ${created.status}`,
        { finalStatus: created.status, agentId, elapsedMs, agent: created },
      );
    }

    while (true) {
      if (cancelToken && inMemoryCancellation.has(cancelToken)) {
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

      // poll
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
      } catch (pollErr) {
        // Swallow transient poll errors; continue until timeout
        // If this is an MCP ApiError with terminal semantics, we could consider early-exit later
        // For now, keep waiting respecting timeout
        // Optionally log: handleMCPError will format, but we avoid converting success flow to error
        // console.debug('Polling error in createAndWait:', pollErr);
      }

      const delay = computeDelay(pollIntervalMs, jitterRatio);
      await new Promise(res => setTimeout(res, delay));
    }
  } catch (error) {
    return handleMCPError(error, 'createAndWait');
  }
}

