export function createJsonRequest(body: unknown) {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

export function createInvalidJsonRequest() {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: "{invalid-json"
  });
}

export async function readJson<T>(response: Response) {
  return (await response.json()) as T;
}
