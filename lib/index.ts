import { Pipeline, GenericNode } from "@silyze/browsary-pipeline";

export type AnalyzeOutput = {
  selectors: {
    selector: string;
    locatedAtUrl: string;
    description: string;
    type: "guess" | "tested-valid" | "tested-fail";
  }[];
  metadata: string[];
};

export type EmitResult<T extends UsageEvent> = {
  event: T;
  proceed: boolean;
};

export async function emitStartChecked(
  monitor: UsageMonitor,
  base: Omit<UsageEventStart, "phase" | "startedAt">
): Promise<EmitResult<UsageEventStart>> {
  const event: UsageEventStart = {
    phase: "start",
    startedAt: nowMs(),
    ...base,
  };
  try {
    const res = await monitor.onEvent(event as UsageEvent);
    return { event, proceed: res !== false };
  } catch {
    return { event, proceed: false };
  }
}

export async function emitEndChecked(
  monitor: UsageMonitor,
  base: Omit<UsageEventEnd, "phase" | "endedAt">,
  started?: number
): Promise<EmitResult<UsageEventEnd>> {
  const event: UsageEventEnd = {
    phase: "end",
    endedAt: nowMs(),
    startedAt: started ?? base.startedAt,
    ...base,
  };
  try {
    const res = await monitor.onEvent(event as UsageEvent);
    return { event, proceed: res !== false };
  } catch {
    return { event, proceed: false };
  }
}

export interface AnalysisResult {
  analysis: AnalyzeOutput;
  prompt: string;
}

export type TokenUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type UsageSource =
  | "model.prompt"
  | "model.promptWithSchema"
  | "pipeline.analyze"
  | "pipeline.generate"
  | "function.call";

export type UsageEventBase = {
  id?: string;
  source: UsageSource;
  model?: string;
  startedAt?: number;
  endedAt?: number;
  metadata?: Record<string, unknown>;
};

export type UsageEventStart = UsageEventBase & { phase: "start" };
export type UsageEventEnd = UsageEventBase & {
  phase: "end";
  usage?: TokenUsage;
};

export type UsageEvent = UsageEventStart | UsageEventEnd;

export interface UsageMonitor {
  onEvent(event: UsageEvent): void | boolean | Promise<void> | Promise<boolean>;
}

export class NoopUsageMonitor implements UsageMonitor {
  onEvent(_event: UsageEvent) {}
}

function nowMs(): number {
  return Date.now();
}

export function emitStart(
  monitor: UsageMonitor,
  base: Omit<UsageEventStart, "phase" | "startedAt">
): UsageEventStart {
  const evt: UsageEventStart = { phase: "start", startedAt: nowMs(), ...base };
  Promise.resolve(monitor.onEvent(evt)).catch(() => {});
  return evt;
}

export function emitEnd(
  monitor: UsageMonitor,
  base: Omit<UsageEventEnd, "phase" | "endedAt">,
  started?: number
): UsageEventEnd {
  const evt: UsageEventEnd = {
    phase: "end",
    endedAt: nowMs(),
    startedAt: started ?? base.startedAt,
    ...base,
  };
  Promise.resolve(monitor.onEvent(evt)).catch(() => {});
  return evt;
}

export abstract class AiEvaluator<TContext> {
  abstract evaluate<TArgs extends any[], TResult>(
    fn: (context: TContext, ...args: TArgs) => TResult,
    ...args: TArgs
  ): Promise<Awaited<TResult>>;

  abstract createContext<TConfig>(
    constuctor: new (
      config: TConfig,
      functionCall: (
        context: TContext,
        name: string,
        params: any,
        abortController?: AbortController
      ) => Promise<unknown>
    ) => AiProvider<TContext, TConfig>,
    config: TConfig
  ): AiEvaluationContext<TContext>;
}

export type AiResult<T> = {
  result?: T;
  messages: object[];
};

export type AiAgentControlRequest =
  | { type: "pause"; reason?: string }
  | { type: "resume" }
  | { type: "addMessages"; messages: unknown[] };

export type AiAgentConversationState<TState = unknown> = {
  id?: string;
  state: TState;
  status?: string;
  metadata?: Record<string, unknown>;
  isPaused?: boolean;
  isComplete?: boolean;
};

export interface PipelineConversationCallbacks {
  onPipelineUpdate(pipeline: Pipeline): Promise<void> | void;
  onStatusUpdate?(status: string): Promise<void> | void;
  onMessages?(messages: unknown[]): Promise<void> | void;
}

export interface PromptParams extends PipelineConversationCallbacks {
  userPrompt: string;
  previousPipeline: Record<string, GenericNode>;
  abortController?: AbortController;
  controlRequests?: AiAgentControlRequest[];
}

export interface ContinuePromptParams extends PipelineConversationCallbacks {
  conversation: AiAgentConversationState;
  previousPipeline: Record<string, GenericNode>;
  abortController?: AbortController;
  controlRequests?: AiAgentControlRequest[];
}

export type AiModelMessage = {
  type: "system" | "user";
  content: string;
};

export abstract class AiModel<TContext> {
  public abstract prompt(
    context: TContext,
    messages: AiModelMessage[]
  ): Promise<AiResult<string>>;

  public abstract promptWithSchema<T>(
    context: TContext,
    messages: AiModelMessage[],
    schema: object
  ): Promise<AiResult<T>>;
}

export abstract class AiProvider<TContext, TConfig = {}> {
  protected config: TConfig;
  protected functionCall: (
    context: TContext,
    name: string,
    params: any,
    abortController?: AbortController
  ) => any;

  #monitor: UsageMonitor;

  public constructor(
    config: TConfig,
    functionCall: (
      context: TContext,
      name: string,
      params: any,
      abortController?: AbortController
    ) => Promise<unknown>,
    monitor?: UsageMonitor
  ) {
    this.config = config;
    this.functionCall = functionCall;
    this.#monitor = monitor ?? new NoopUsageMonitor();
  }

  protected get monitor(): UsageMonitor {
    return this.#monitor;
  }

  protected emitStart(base: Omit<UsageEventStart, "phase" | "startedAt">) {
    return emitStart(this.#monitor, base);
  }
  protected emitEnd(
    base: Omit<UsageEventEnd, "phase" | "endedAt">,
    started?: number
  ) {
    return emitEnd(this.#monitor, base, started);
  }

  protected emitStartChecked(
    base: Omit<UsageEventStart, "phase" | "startedAt">
  ) {
    return emitStartChecked(this.#monitor, base);
  }

  protected emitEndChecked(
    base: Omit<UsageEventEnd, "phase" | "endedAt">,
    started?: number
  ) {
    return emitEndChecked(this.#monitor, base, started);
  }

  protected async callFunctionWithTelemetry(
    context: TContext,
    name: string,
    params: any,
    abortController?: AbortController
  ): Promise<unknown> {
    const startRes = await emitStartChecked(this.monitor, {
      source: "function.call",
      metadata: { name },
    });

    if (!startRes.proceed) {
      return false;
    }

    try {
      const out = await this.functionCall(
        context,
        name,
        params,
        abortController
      );

      await emitEndChecked(
        this.monitor,
        {
          source: "function.call",
          metadata: { name },
          startedAt: startRes.event.startedAt,
        },
        startRes.event.startedAt
      );

      return out;
    } catch (err) {
      await emitEndChecked(
        this.monitor,
        {
          source: "function.call",
          metadata: { name },
          startedAt: startRes.event.startedAt,
        },
        startRes.event.startedAt
      );
      throw err;
    }
  }

  public abstract createModel<TModelContext>(
    model: string,
    context: TModelContext
  ): AiModel<TModelContext>;

  public abstract prompt(
    context: TContext,
    params: PromptParams
  ): Promise<AiAgentConversationState>;

  public abstract continuePrompt(
    context: TContext,
    params: ContinuePromptParams
  ): Promise<AiAgentConversationState>;
}

export interface AiEvaluationContext<TContext> {
  agent: AiEvaluator<TContext>;
  provider: AiProvider<TContext, unknown>;
  monitor?: UsageMonitor;
}
