import { useState, useMemo } from 'react';
import { Segment, TestCase } from '@/types/features';

interface SegmentTreeViewProps {
  segments: Segment[];
  testCases: TestCase[];
  onSelectPath: (path: number[]) => void;
}

export const SegmentTreeView: React.FC<SegmentTreeViewProps> = ({
  segments,
  testCases,
  onSelectPath,
}) => {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // Group segments by parentId
  const childrenMap = useMemo(() => {
    const map = new Map<number | null, Segment[]>();
    segments.forEach((seg) => {
      const key = seg.parentId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(seg);
    });
    return map;
  }, [segments]);

  // Count test cases for a given path prefix
  const countTestCases = (pathPrefix: number[]): number => {
    return testCases.filter((tc) => {
      if (!tc.path || tc.path.length < pathPrefix.length) return false;
      return pathPrefix.every((id, i) => tc.path[i] === id);
    }).length;
  };

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const renderNode = (segment: Segment, ancestorPath: number[]) => {
    const currentPath = [...ancestorPath, segment.id];
    const isExpanded = expanded.has(segment.id);
    const children = childrenMap.get(segment.id) || [];
    const count = countTestCases(currentPath);
    const isLeaf = children.length === 0;

    return (
      <div key={segment.id} className="ml-4">
        <div
          className={`flex items-center gap-2 py-1 px-2 rounded text-sm ${
            isLeaf
              ? 'cursor-pointer hover:bg-blue-50'
              : 'cursor-pointer hover:bg-gray-100'
          }`}
          onClick={() => {
            if (isLeaf) {
              onSelectPath(currentPath);
            } else {
              toggleExpand(segment.id);
            }
          }}
        >
          {!isLeaf && (
            <span className="text-gray-400 w-4 text-center">
              {isExpanded ? '▼' : '▶'}
            </span>
          )}
          {isLeaf && <span className="w-4 text-center text-gray-300">-</span>}
          <span className={isLeaf ? 'text-blue-600' : 'font-medium'}>
            {segment.name}
          </span>
          {count > 0 && (
            <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">
              {count}
            </span>
          )}
        </div>
        {isExpanded &&
          children.map((child) => renderNode(child, currentPath))}
      </div>
    );
  };

  const rootSegments = childrenMap.get(null) || [];

  if (rootSegments.length === 0) {
    return (
      <div className="text-sm text-gray-400 py-4 text-center">
        No segments yet. Use Input View to create segments.
      </div>
    );
  }

  return (
    <div className="bg-white border rounded p-2">
      {rootSegments.map((seg) => renderNode(seg, []))}
    </div>
  );
};
