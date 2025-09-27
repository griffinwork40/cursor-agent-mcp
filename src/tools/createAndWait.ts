// Single-source implementation lives in createAndWait.js.
// This TypeScript module provides types and re-exports the JS implementation
// to avoid divergence between TS and JS behaviors.

export type CursorClient = {
  createAgent: (data: any) => Promise<any>;
  getAgent: (id: string) => Promise<any>;
};

import * as impl from './createAndWait.js';

export const createAndWait: (input: any, client: CursorClient) => Promise<any> = impl.createAndWait as any;
export const cancelWaitToken: (token: string) => void = impl.cancelWaitToken as any;