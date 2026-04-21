import { useMemo, useState } from 'react';
import { Segment } from '@/types/features';

interface SegmentTreePickerProps {
  segments: Segment[];
  selectedPath: number[];
  onChange: (nextPath: number[]) => void;
  emptyLabel?: string;
}

interface SegmentNode {
  segment: Segment;
  children: SegmentNode[];
}

/**
 * Reusable Segment tree picker.
 *
 * - Renders the product's segment tree with collapse/expand.
 * - Clicking a node sets the full ancestor-chain as the selected path (`[root, ..., node]`).
 * - Clicking "(경로 없음)" at the top clears the path to `[]`.
 * - Never mutates segments; it only emits onChange with the new id path.
 */
export default function SegmentTreePicker({
  segments,
  selectedPath,
  onChange,
  emptyLabel = '경로 없음 (Segment 미지정)',
}: SegmentTreePickerProps) {
  const tree = useMemo(() => buildTree(segments), [segments]);
  const idToSegment = useMemo(() => {
    const map = new Map<number, Segment>();
    segments.forEach((s) => map.set(s.id, s));
    return map;
  }, [segments]);

  // Start expanded along the currently selected path AND at the root level so first-level
  // children are immediately visible when the picker opens.
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => {
    const ids = new Set<number>(selectedPath);
    segments.filter((s) => s.parentId == null).forEach((s) => ids.add(s.id));
    return ids;
  });

  const toggle = (id: number) => {
    setExpandedIds((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  };

  const selectedLeaf =
    selectedPath.length > 0 ? selectedPath[selectedPath.length - 1] : null;

  // Compute the full ancestor chain when a node is picked.
  const handlePick = (segmentId: number) => {
    const chain: number[] = [];
    let current: Segment | undefined = idToSegment.get(segmentId);
    while (current) {
      chain.unshift(current.id);
      if (current.parentId == null) break;
      current = idToSegment.get(current.parentId);
    }
    onChange(chain);
  };

  return (
    <div
      className="max-h-60 overflow-y-auto rounded border border-gray-200 bg-white p-2 text-sm"
      data-testid="segment-tree-picker"
    >
      <button
        type="button"
        onClick={() => onChange([])}
        className={`w-full text-left px-2 py-1 rounded text-xs ${
          selectedLeaf == null
            ? 'bg-indigo-50 text-indigo-700 font-medium'
            : 'text-gray-500 hover:bg-gray-50'
        }`}
        data-testid="segment-tree-picker-clear"
      >
        {emptyLabel}
      </button>
      <div className="mt-1">
        {tree.length === 0 ? (
          <div className="text-xs text-gray-400 px-2 py-3 text-center">
            이 제품에 Segment가 없습니다.
          </div>
        ) : (
          tree.map((node) => (
            <TreeNode
              key={node.segment.id}
              node={node}
              depth={0}
              expandedIds={expandedIds}
              toggle={toggle}
              selectedLeaf={selectedLeaf}
              onPick={handlePick}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface TreeNodeProps {
  node: SegmentNode;
  depth: number;
  expandedIds: Set<number>;
  toggle: (id: number) => void;
  selectedLeaf: number | null;
  onPick: (id: number) => void;
}

function TreeNode({ node, depth, expandedIds, toggle, selectedLeaf, onPick }: TreeNodeProps) {
  const { segment, children } = node;
  const hasChildren = children.length > 0;
  const expanded = expandedIds.has(segment.id);
  const isSelected = selectedLeaf === segment.id;

  return (
    <div>
      <div
        className={`flex items-center gap-1 px-1 py-1 rounded cursor-pointer ${
          isSelected
            ? 'bg-indigo-100 text-indigo-800 font-medium'
            : 'hover:bg-gray-50'
        }`}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600"
            onClick={(e) => {
              e.stopPropagation();
              toggle(segment.id);
            }}
          >
            {expanded ? '▾' : '▸'}
          </button>
        ) : (
          <span className="w-4 h-4 inline-block" />
        )}
        <button
          type="button"
          onClick={() => onPick(segment.id)}
          className="flex-1 text-left text-xs truncate"
          data-testid="segment-tree-picker-node"
          data-segment-id={segment.id}
        >
          {segment.name}
        </button>
      </div>
      {hasChildren && expanded && (
        <div>
          {children.map((child) => (
            <TreeNode
              key={child.segment.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              toggle={toggle}
              selectedLeaf={selectedLeaf}
              onPick={onPick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function buildTree(segments: Segment[]): SegmentNode[] {
  const byId = new Map<number, SegmentNode>();
  segments.forEach((s) => byId.set(s.id, { segment: s, children: [] }));
  const roots: SegmentNode[] = [];
  segments.forEach((s) => {
    const node = byId.get(s.id)!;
    if (s.parentId != null && byId.has(s.parentId)) {
      byId.get(s.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  // Stable sort by name, then id — matches the feel of SegmentTreeView.
  const sortNodes = (nodes: SegmentNode[]) => {
    nodes.sort((a, b) => {
      const n = a.segment.name.localeCompare(b.segment.name, 'ko');
      return n !== 0 ? n : a.segment.id - b.segment.id;
    });
    nodes.forEach((n) => sortNodes(n.children));
  };
  sortNodes(roots);
  return roots;
}
