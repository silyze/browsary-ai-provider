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

export interface AnalysisResult {
  analysis: AnalyzeOutput;
  prompt: string;
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
        params: any
      ) => Promise<unknown>
    ) => AiProvider<TContext, TConfig>,
    config: TConfig
  ): AiEvaluationContext<TContext>;
}

export type AiResult<T> = {
  result?: T;
  messages: object[];
};

export abstract class AiProvider<TContext, TConfig = {}> {
  protected config: TConfig;
  protected functionCall: (context: TContext, name: string, params: any) => any;
  public constructor(
    config: TConfig,
    functionCall: (
      context: TContext,
      name: string,
      params: any
    ) => Promise<unknown>
  ) {
    this.config = config;
    this.functionCall = functionCall;
  }

  public abstract analyze(
    context: TContext,
    userPrompt: string,
    previousPipeline: Record<string, GenericNode>,
    onMessages?: (message: unknown[]) => Promise<void> | void
  ): Promise<AiResult<AnalysisResult>>;

  public abstract generate(
    context: TContext,
    analysisResult: AnalysisResult,
    previousPipeline: Record<string, GenericNode>,
    onMessages?: (message: unknown[]) => Promise<void> | void
  ): Promise<AiResult<Pipeline>>;
}

export interface AiEvaluationContext<TContext> {
  agent: AiEvaluator<TContext>;
  provider: AiProvider<TContext, unknown>;
}
