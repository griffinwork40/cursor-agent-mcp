// TypeScript type definitions for Cursor Agent MCP

export interface ImageDimension {
  width: number;
  height: number;
}

export interface Image {
  data: string;
  dimension?: ImageDimension;
}

export interface Prompt {
  text: string;
  images?: Image[];
}

export interface Source {
  repository: string;
  ref?: string;
}

export interface Target {
  autoCreatePr?: boolean;
  branchName?: string;
}

export interface Webhook {
  url: string;
  secret?: string;
}

export type AgentStatus = 'CREATING' | 'RUNNING' | 'FINISHED' | 'ERROR' | 'EXPIRED';

export interface Agent {
  id: string;
  status: AgentStatus;
  target?: Target & { url?: string }; // Allow additional properties from API
  [key: string]: unknown; // Allow additional properties from API
}

export interface CreateAgentRequest {
  prompt: Prompt;
  model: string;
  source: Source;
  target?: Target;
  webhook?: Webhook;
}

export interface CreateAndWaitRequest extends CreateAgentRequest {
  pollIntervalMs?: number;
  timeoutMs?: number;
  jitterRatio?: number;
  cancelToken?: string;
}

export interface CreateAndWaitResult {
  finalStatus: AgentStatus | 'CANCELLED' | 'TIMEOUT';
  agentId: string;
  elapsedMs: number;
  agent: Agent | null;
}

export interface MCPResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

export interface CursorClient {
  createAgent: (data: CreateAgentRequest) => Promise<Agent>;
  getAgent: (id: string) => Promise<Agent>;
}

export interface CreateAndWaitInput {
  prompt: Prompt;
  model: string;
  source: Source;
  target?: Target;
  webhook?: Webhook;
  pollIntervalMs: number;
  timeoutMs: number;
  jitterRatio: number;
  cancelToken?: string;
}

export type CreateAndWaitFunction = (input: CreateAndWaitInput, client: CursorClient) => Promise<MCPResponse>;
export type CancelWaitTokenFunction = (token: string) => void;