# Browsary AI Provider

The Browsary AI Provider package defines core abstractions and interfaces for integrating AI-driven analysis and pipeline generation into the Browsary ecosystem.

## Install

```bash
npm install @silyze/browsary-ai-provider
```

## Usage

Import and use the interfaces and classes in your project:

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

// Example: creating your own AI provider and evaluator
```

## API Reference

### Types & Interfaces

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

- **selectors** — An array of discovered CSS selectors, with context and test status.
- **metadata** — Additional context or notes collected during analysis.

#### `AnalysisResult`

```ts
export interface AnalysisResult {
  analysis: AnalyzeOutput;
  prompt: string;
}
```

- **analysis** — The raw output of the AI analysis step.
- **prompt** — The actual prompt sent to the AI model.

#### `AiResult<T>`

```ts
export type AiResult<T> = {
  result?: T;
  messages: object[];
};
```

- **result** — The final produced value (e.g., `AnalysisResult` or `Pipeline`).
- **messages** — Log of messages exchanged with the AI service.

#### `AiEvaluationContext<TContext>`

```ts
export interface AiEvaluationContext<TContext> {
  agent: AiEvaluator<TContext>;
  provider: AiProvider<TContext, unknown>;
}
```

- **agent** — An instance of `AiEvaluator`, responsible for calling AI functions.
- **provider** — The configured `AiProvider` instance.

### Classes

#### `AiEvaluator<TContext>`

Abstract base class defining how to evaluate functions using AI.

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
        params: any
      ) => Promise<unknown>
    ) => AiProvider<TContext, TConfig>,
    config: TConfig
  ): AiEvaluationContext<TContext>;
}
```

- **evaluate** — Runs a pure function under AI supervision.
- **createContext** — Instantiates a provider context for analysis and generation.

#### `AiProvider<TContext, TConfig>`

Abstract class to be implemented by concrete AI backends.

```ts
export abstract class AiProvider<TContext, TConfig = {}> {
  constructor(
    config: TConfig,
    functionCall: (
      context: TContext,
      name: string,
      params: any
    ) => Promise<unknown>
  );

  analyze(
    context: TContext,
    userPrompt: string,
    previousPipeline: Record<string, GenericNode>,
    onMessages?: (message: unknown[]) => Promise<void> | void
  ): Promise<AiResult<AnalysisResult>>;

  generate(
    context: TContext,
    analysisResult: AnalysisResult,
    previousPipeline: Record<string, GenericNode>,
    onMessages?: (message: unknown[]) => Promise<void> | void
  ): Promise<AiResult<Pipeline>>;
}
```

- **analyze** — Produces an initial analysis of a user prompt against an existing pipeline.
- **generate** — Builds or updates a `Pipeline` based on analysis results.

## Example Implementation

```ts
class MyAiEvaluator extends AiEvaluator<MyContext> {
  // implement evaluate and createContext...
}

class MyAiProvider extends AiProvider<MyContext, MyConfig> {
  async analyze(...) { /* ... */ }
  async generate(...) { /* ... */ }
}

// Usage:
const evaluator = new MyAiEvaluator(...);
const { agent, provider } = evaluator.createContext(MyAiProvider, config);
const analysis = await provider.analyze(context, "Find buttons", {});
const { result: pipeline } = await provider.generate(context, analysis.result, {});
```
