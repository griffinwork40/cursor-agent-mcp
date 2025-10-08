// Single-source implementation lives in createAndWait.js.
// This TypeScript module provides types and re-exports the JS implementation
// to avoid divergence between TS and JS behaviors.

import type { 
  CreateAndWaitFunction, 
  CancelWaitTokenFunction,
} from '../types.js';

import * as impl from './createAndWait.js';

export const createAndWait: CreateAndWaitFunction = impl.createAndWait;
export const cancelWaitToken: CancelWaitTokenFunction = impl.cancelWaitToken;

// Re-export types for convenience
export type { CursorClient, CreateAndWaitInput, MCPResponse } from '../types.js';