import { unzipSync } from 'fflate';

export function readOfficeArchive(buffer: ArrayBuffer, include: (name: string) => boolean) {
  let expandedBytes = 0;
  return unzipSync(new Uint8Array(buffer), {
    filter(entry) {
      expandedBytes += entry.originalSize;
      if (expandedBytes > 64 * 1024 * 1024) {
        throw new Error('This Office file is too large to open in the browser.');
      }
      return include(entry.name);
    },
  });
}
