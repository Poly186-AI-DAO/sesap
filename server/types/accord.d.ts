// Type declarations for Accord Project modules without TypeScript definitions

declare module '@accordproject/markdown-template' {
  import { ModelManager } from '@accordproject/concerto-core';
  
  export class TemplateMarkTransformer {
    fromMarkdownTemplate(
      input: { content: string },
      modelManager: ModelManager,
      templateName: string,
      options?: { verbose?: boolean }
    ): unknown;
  }
}

declare module '@accordproject/markdown-transform' {
  export function transform(
    source: unknown,
    sourceFormat: string,
    targetFormats: string[],
    options?: Record<string, unknown>,
    transformOptions?: { verbose?: boolean }
  ): Promise<unknown>;
}
