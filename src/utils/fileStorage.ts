import type { FsNode } from '../db/types';

const encoder = new TextEncoder();

export function getFileSizeBytes(node: FsNode): number {
  if (node.kind !== 'file') return 0;
  const size = node.sizeBytes;
  const storedSize = typeof size === 'number' && Number.isFinite(size) && size >= 0 ? size : undefined;
  if (node.blobId && storedSize !== undefined) return storedSize;
  if (node.content !== undefined) return encoder.encode(node.content).length;
  return storedSize ?? 0;
}

export function getOwningDriveId(nodes: Record<string, FsNode>, nodeId: string): string {
  const visited = new Set<string>();
  let node: FsNode | undefined = nodes[nodeId];
  while (node && !visited.has(node.id)) {
    visited.add(node.id);
    if (node.kind === 'drive') return node.id;
    const parent: FsNode | undefined = node.parentId ? nodes[node.parentId] : undefined;
    if (parent?.kind === 'bin') {
      if (node.originalDriveId) return node.originalDriveId;
      node = node.originalParentId ? nodes[node.originalParentId] : undefined;
    } else {
      node = parent;
    }
  }
  // User folders such as Downloads live directly under This PC and belong to C:.
  return 'drive-c';
}

export function getDriveUsageBytes(nodes: Record<string, FsNode>): Map<string, number> {
  const usage = new Map<string, number>();
  for (const file of Object.values(nodes)) {
    if (file.kind !== 'file') continue;
    const driveId = getOwningDriveId(nodes, file.id);
    usage.set(driveId, (usage.get(driveId) ?? 0) + getFileSizeBytes(file));
  }
  return usage;
}
