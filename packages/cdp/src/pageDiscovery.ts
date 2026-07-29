import type { CdpPage } from "./client.js";
import type { CdpRuntime } from "./runtime.js";

export interface CdpExecutionContext {
  id: number;
  name: string;
  origin: string;
  type?: string;
}

export function findA360Page(pages: CdpPage[], fileId?: string): CdpPage | null {
  return (
    pages.find(
      (page) =>
        page.type === "page" &&
        page.url.includes("/#/bots/repository/private/files/task/") &&
        (!fileId || page.url.includes(`/task/${fileId}/`))
    ) ?? null
  );
}

export function findTargetPages(pages: CdpPage[], targetUrls: string[]): CdpPage[] {
  return pages.filter((page) => page.type === "page" && targetUrls.some((url) => page.url.startsWith(url)));
}

export async function discoverExecutionContexts(runtime: CdpRuntime, waitMs = 700): Promise<CdpExecutionContext[]> {
  const contexts: CdpExecutionContext[] = [];
  const unsubscribe = runtime.on("Runtime.executionContextCreated", (params: any) => {
    const context = params.context;
    contexts.push({
      id: context.id,
      name: context.name,
      origin: context.origin,
      type: context.auxData?.type
    });
  });
  await runtime.send("Runtime.enable");
  await new Promise((resolve) => setTimeout(resolve, waitMs));
  unsubscribe();
  return contexts;
}

export function pickDefaultContext(contexts: CdpExecutionContext[], originPart: string): CdpExecutionContext | null {
  return contexts.find((context) => context.origin.includes(originPart) && (!context.name || context.type === "default")) ?? null;
}

export function pickExtensionContext(contexts: CdpExecutionContext[], extensionName: string): CdpExecutionContext | null {
  return contexts.find((context) => context.name === extensionName) ?? null;
}
