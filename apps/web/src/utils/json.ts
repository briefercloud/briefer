export function tryJSONParse<T>(raw: string, or: T): T {
  try {
    return JSON.parse(raw)
  } catch (err) {
    void err
    return or
  }
}
