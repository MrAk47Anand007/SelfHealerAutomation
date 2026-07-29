export interface CdpPage {
  id: string;
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl: string;
}

export async function listCdpPages(port: number): Promise<CdpPage[]> {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!response.ok) throw new Error(`Unable to list CDP pages: HTTP ${response.status}`);
  return (await response.json()) as CdpPage[];
}
