export interface ApiError extends Error {
  status: number;
  url: string;
}

function toError(res: Response): Error {
  const err = new Error(`${res.status} ${res.url}`) as Error & { status: number; url: string };
  err.status = res.status;
  err.url = res.url;
  return err;
}

export async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw toError(res);
  return res.json() as Promise<T>;
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw toError(res);
  return res.json() as Promise<T>;
}