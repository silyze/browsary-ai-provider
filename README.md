# Browsary AI Provider

The Browsary AI Provider package defines the core abstractions and interfaces for integrating AI-driven analysis and pipeline generation into the Browsary ecosystem.

## Install

```bash
npm install @silyze/browsary-ai-provider
```

## Usage

Create custom evaluators and providers by extending the supplied base classes:

```ts
import {
  AiEvaluator,
  AiProvider,
  AiEvaluationContext,
  AnalyzeOutput,
  AnalysisResult,
  AiResult,
  Pipeline,
  GenericNode,
} from "@silyze/browsary-ai-provider";

class MyAiEvaluator extends AiEvaluator<MyContext> {
  async evaluate<TArgs extends any[], TResult>(
    fn: (context: MyContext, ...args: TArgs) => TResult,
    ...args: TArgs
  ) {
    // call into your AI runtime and return the result
  }

  createContext<TConfig>(
    constructor: new (
      config: TConfig,
      functionCall: (
        context: MyContext,
        name: string,
        params: any,
        abortController?: AbortController
      ) => Promise<unknown>
    ) => AiProvider<MyContext, TConfig>,
    config: TConfig
  ): AiEvaluationContext<MyContext> {
    const provider = new constructor(config, this.evaluate.bind(this));
    return { agent: this, provider };
  }
}

class MyAiProvider extends AiProvider<MyContext, MyConfig> {
  async analyze(...) { /* implement analysis */ }
  async generate(...) { /* implement pipeline generation */ }
}

const evaluator = new MyAiEvaluator();
const { provider } = evaluator.createContext(MyAiProvider, myConfig);
const analysis = await provider.analyze(context, "Find buttons", {});
const { result: pipeline } = await provider.generate(context, analysis.result, {});
```

### Tracking Usage

Expose token usage or other billing metrics by pairing calls to `emitStart` and `emitEnd`. They allow you to annotate requests with timestamps and usage numbers gathered from your underlying SDK.

```ts
const modelId = "gpt-4o";
const start = provider.emitStart({
  source: "model.prompt",
  model: modelId,
});

const sdk = await callIntoYourModel();

provider.emitEnd({
  source: "model.prompt",
  model: modelId,
  startedAt: start.startedAt,
  usage: {
    inputTokens: sdk.usage?.prompt_tokens,
    outputTokens: sdk.usage?.completion_tokens,
    totalTokens: sdk.usage?.total_tokens,
  },
});
```

Place these hooks around every model invocation to keep downstream systems aware of runtime cost.

### Analyze vs. Generate

- `analyze` runs first and produces an `AnalysisResult` that describes findings and raw AI output.
- `generate` consumes the analysis and returns a `Pipeline` ready to be executed or merged.

## API Reference

### Types and Interfaces

#### `AnalyzeOutput`

```ts
export type AnalyzeOutput = {
  selectors: {
    selector: string;
    locatedAtUrl: string;
    description: string;
    type: "guess" | "tested-valid" | "tested-fail";
  }[];
  metadata: string[];
};
```

- selectors: Array of discovered CSS selectors, including context and test status.
- metadata: Additional context or notes collected during analysis.

#### `AnalysisResult`

```ts
export interface AnalysisResult {
  analysis: AnalyzeOutput;
  prompt: string;
}
```

- analysis: The raw output of the AI analysis step.
- prompt: The actual prompt sent to the AI model.

#### `AiResult<T>`

```ts
export type AiResult<T> = {
  result?: T;
  messages: object[];
};
```

- result: The final produced value (for example `AnalysisResult` or `Pipeline`).
- messages: Log of messages exchanged with the AI service.

#### `AiEvaluationContext<TContext>`

```ts
export interface AiEvaluationContext<TContext> {
  agent: AiEvaluator<TContext>;
  provider: AiProvider<TContext, unknown>;
}
```

- agent: Instance of `AiEvaluator`, responsible for calling AI functions.
- provider: The configured `AiProvider` instance.

### Classes

#### `AiEvaluator<TContext>`

```ts
export abstract class AiEvaluator<TContext> {
  abstract evaluate<TArgs extends any[], TResult>(
    fn: (context: TContext, ...args: TArgs) => TResult,
    ...args: TArgs
  ): Promise<Awaited<TResult>>;

  abstract createContext<TConfig>(
    constructor: new (
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
```

- evaluate: Runs a pure function under AI supervision.
- createContext: Instantiates a provider context for analysis and generation.

#### `AiProvider<TContext, TConfig>`

Abstract class implemented by concrete AI backends.

```ts
export abstract class AiProvider<TContext, TConfig = {}> {
  constructor(
    config: TConfig,
    functionCall: (
      context: TContext,
      name: string,
      params: any,
      abortController?: AbortController
    ) => Promise<unknown>
  );

  analyze(
    context: TContext,
    userPrompt: string,
    previousPipeline: Record<string, GenericNode>,
    onMessages?: (message: unknown[]) => Promise<void> | void,
    abortController?: AbortController
  ): Promise<AiResult<AnalysisResult>>;

  generate(
    context: TContext,
    analysisResult: AnalysisResult,
    previousPipeline: Record<string, GenericNode>,
    onMessages?: (message: unknown[]) => Promise<void> | void,
    abortController?: AbortController
  ): Promise<AiResult<Pipeline>>;
}
```

- analyze: Produces an initial analysis of a user prompt against an existing pipeline.
- generate: Builds or updates a `Pipeline` based on analysis results.

### Aborting work

Use the optional `AbortController` argument on `analyze` and `generate` when you need to cancel long‑running operations. Provide the controller you manage upstream and propagate its signal into any downstream SDK calls (including those made through `callFunctionWithTelemetry`). Reject the promise when cancellation happens so callers can react and telemetry can close out properly.

## Example Implementation

```ts
const evaluator = new MyAiEvaluator();
const { agent, provider } = evaluator.createContext(MyAiProvider, config);
const analysis = await provider.analyze(context, "Find buttons", {});
const { result: pipeline } = await provider.generate(context, analysis.result, {});
```
