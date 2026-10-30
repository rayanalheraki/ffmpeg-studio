/**
 * Minimal, platform-agnostic path helpers usable in both the renderer and the
 * main process. They preserve the separator style of the input path.
 */

function separatorOf(filePath: string): '\\' | '/' {
  return filePath.includes('\\') ? '\\' : '/';
}

export function basename(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

export function dirname(filePath: string): string {
  const index = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  if (index < 0) return '.';
  if (index === 0) return filePath.slice(0, 1);
  // Keep the trailing separator for drive roots such as `C:\`.
  if (/^[A-Za-z]:$/.test(filePath.slice(0, index))) return filePath.slice(0, index + 1);
  return filePath.slice(0, index);
}

/** POSIX (`/x`), drive (`C:\x`) and UNC (`\\server\x`) paths are absolute. */
export function isAbsolute(filePath: string): boolean {
  return filePath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(filePath) || filePath.startsWith('\\\\');
}

export function stripExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

export function joinPath(directory: string, fileName: string): string {
  const sep = separatorOf(directory);
  return directory.endsWith('/') || directory.endsWith('\\') ? `${directory}${fileName}` : `${directory}${sep}${fileName}`;
}
