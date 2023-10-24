export default function fastCopy<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}
