// Single-source implementation lives in createAndWait.js.
// This TypeScript module provides types and re-exports the JS implementation
// to avoid divergence between TS and JS behaviors.

export type CursorClient = {
  createAgent: (data: { prompt: { text: string }; source: { repository: string }; model: string; pollIntervalMs: number; timeoutMs: number; jitterRatio: number; cancelToken?: string }) => Promise<{ id: string; status: string; target?: { url: string } }>;
  getAgent: (id: string) => Promise<{ id: string; status: string; target?: { url: string } }>;
};

import * as impl from './createAndWait.js';

export const createAndWait: (input: { prompt: { text: string }; source: { repository: string }; model: string; pollIntervalMs: number; timeoutMs: number; jitterRatio: number; cancelToken?: string }, client: CursorClient) => Promise<{ content: { text: string }[] }> = impl.createAndWait as any;
export const cancelWaitToken: (token: string) => void = impl.cancelWaitToken as any;