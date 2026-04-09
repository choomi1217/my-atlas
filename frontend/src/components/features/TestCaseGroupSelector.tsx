import { useState, useMemo, useCallback } from 'react';
import { Segment, TestCase } from '@/types/features';

interface TestCaseGroupSelectorProps {
  segments: Segment[];
  testCases: TestCase[];
  selectedIds: Set<number>;
  onChange: (selectedIds: Set<number>) => void;
}

interface TreeNode {
  segment: Segment;
  children: TreeNode[];
  testCases: TestCase[];
}

export default function TestCaseGroupSelector({
  segments,
  testCases,
  selectedIds,
  onChange,
}: TestCaseGroupSelectorProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');

  // Build segment tree
  const { roots, orphanTestCases } = useMemo(() => {
    const segMap = new Map<number, Segment>();
    segments.forEach((s) => segMap.set(s.id, s));

    const childrenMap = new Map<number | null, Segment[]>();
    segments.forEach((s) => {
      const key = s.parentId;
      if (!childrenMap.has(key)) childrenMap.set(key, []);
      childrenMap.get(key)!.push(s);
    });

    // Group test cases by their first path segment
    const tcBySegment = new Map<number, TestCase[]>();
    const orphans: TestCase[] = [];
    testCases.forEach((tc) => {
      if (tc.path && tc.path.length > 0) {
        // Assign to the deepest (last) segment in path
        const leafId = tc.path[tc.path.length - 1];
        if (!tcBySegment.has(leafId)) tcBySegment.set(leafId, []);
        tcBySegment.get(leafId)!.push(tc);
      } else {
        orphans.push(tc);
      }
    });

    function buildTree(parentId: number | null): TreeNode[] {
      const children = childrenMap.get(parentId) || [];
      return children.map((seg) => ({
        segment: seg,
        children: buildTree(seg.id),
        testCases: tcBySegment.get(seg.id) || [],
      }));
    }

    return { roots: buildTree(null), orphanTestCases: orphans };
  }, [segments, testCases]);

  // Initialize expanded to all nodes on first render
  useMemo(() => {
    if (expanded.size === 0 && segments.length > 0) {
      setExpanded(new Set(segments.map((s) => s.id)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments]);

  // Filtered test cases by search
  const filteredIds = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return new Set(
      testCases
        .filter((tc) => tc.title.toLowerCase().includes(q))
        .map((tc) => tc.id)
    );
  }, [search, testCases]);

  // Collect all TC ids under a node (recursive)
  const collectTcIds = useCallback(
    (node: TreeNode): number[] => {
      const ids: number[] = [];
      node.testCases.forEach((tc) => {
        if (!filteredIds || filteredIds.has(tc.id)) ids.push(tc.id);
      });
      node.children.forEach((child) => ids.push(...collectTcIds(child)));
      return ids;
    },
    [filteredIds]
  );

  const toggleExpand = (segId: number) => {
    const next = new Set(expanded);
    if (next.has(segId)) next.delete(segId);
    else next.add(segId);
    setExpanded(next);
  };

  const toggleTc = (tcId: number) => {
    const next = new Set(selectedIds);
    if (next.has(tcId)) next.delete(tcId);
    else next.add(tcId);
    onChange(next);
  };

  const toggleNode = (node: TreeNode) => {
    const ids = collectTcIds(node);
    const allSelected = ids.every((id) => selectedIds.has(id));
    const next = new Set(selectedIds);
    if (allSelected) {
      ids.forEach((id) => next.delete(id));
    } else {
      ids.forEach((id) => next.add(id));
    }
    onChange(next);
  };

  const getNodeStats = (node: TreeNode): { selected: number; total: number } => {
    let selected = 0;
    let total = 0;
    node.testCases.forEach((tc) => {
      if (!filteredIds || filteredIds.has(tc.id)) {
        total++;
        if (selectedIds.has(tc.id)) selected++;
      }
    });
    node.children.forEach((child) => {
      const s = getNodeStats(child);
      selected += s.selected;
      total += s.total;
    });
    return { selected, total };
  };

  const isNodeVisible = (node: TreeNode): boolean => {
    if (!filteredIds) return true;
    if (node.testCases.some((tc) => filteredIds.has(tc.id))) return true;
    return node.children.some((child) => isNodeVisible(child));
  };

  const renderNode = (node: TreeNode, depth: number): React.ReactNode => {
    if (!isNodeVisible(node)) return null;

    const stats = getNodeStats(node);
    if (stats.total === 0) return null;

    const isExpanded = expanded.has(node.segment.id);
    const allSelected = stats.selected === stats.total && stats.total > 0;
    const someSelected = stats.selected > 0 && !allSelected;

    const visibleTcs = filteredIds
      ? node.testCases.filter((tc) => filteredIds.has(tc.id))
      : node.testCases;

    return (
      <div key={node.segment.id}>
        {/* Segment node row */}
        <div
          className="flex items-center gap-1 py-1 hover:bg-gray-50 rounded cursor-pointer"
          style={{ paddingLeft: `${depth * 20 + 4}px` }}
        >
          <button
            type="button"
            onClick={() => toggleExpand(node.segment.id)}
            className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            {isExpanded ? '▼' : '▶'}
          </button>

          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
            }}
            onChange={() => toggleNode(node)}
            className="w-4 h-4 cursor-pointer flex-shrink-0"
          />

          <span
            className="text-sm font-medium text-gray-700 flex-1"
            onClick={() => toggleExpand(node.segment.id)}
          >
            {node.segment.name}
          </span>

          <span className="text-xs text-gray-400 mr-2">
            ({stats.selected}/{stats.total})
          </span>
        </div>

        {/* Expanded children */}
        {isExpanded && (
          <>
            {node.children.map((child) => renderNode(child, depth + 1))}
            {visibleTcs.map((tc) => (
              <div
                key={tc.id}
                className="flex items-center gap-2 py-1 hover:bg-gray-50 rounded"
                style={{ paddingLeft: `${(depth + 1) * 20 + 24}px` }}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(tc.id)}
                  onChange={() => toggleTc(tc.id)}
                  className="w-4 h-4 cursor-pointer flex-shrink-0"
                />
                <span className="text-xs text-gray-400 flex-shrink-0">
                  T{tc.id}
                </span>
                <span className="text-sm text-gray-700 truncate">
                  {tc.title}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    );
  };

  const totalSelected = selectedIds.size;
  const totalAvailable = filteredIds ? filteredIds.size : testCases.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700">
          Test Cases *
        </label>
        <span className="text-xs text-gray-500">
          {totalSelected}/{totalAvailable}
        </span>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search test cases..."
        className="w-full px-3 py-2 mb-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* Tree */}
      <div className="border border-gray-300 rounded-lg p-2 max-h-64 overflow-y-auto">
        {testCases.length === 0 ? (
          <p className="text-gray-500 text-sm py-2 text-center">
            No test cases available
          </p>
        ) : (
          <>
            {roots.map((node) => renderNode(node, 0))}

            {/* Orphan test cases (no path) */}
            {orphanTestCases.length > 0 && (
              <div className="mt-1">
                <div className="flex items-center gap-1 py-1 text-sm font-medium text-gray-500 pl-1">
                  Unassigned
                </div>
                {orphanTestCases
                  .filter((tc) => !filteredIds || filteredIds.has(tc.id))
                  .map((tc) => (
                    <div
                      key={tc.id}
                      className="flex items-center gap-2 py-1 hover:bg-gray-50 rounded pl-6"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(tc.id)}
                        onChange={() => toggleTc(tc.id)}
                        className="w-4 h-4 cursor-pointer flex-shrink-0"
                      />
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        T{tc.id}
                      </span>
                      <span className="text-sm text-gray-700 truncate">
                        {tc.title}
                      </span>
                    </div>
                  ))}
              </div>
            )}

            {filteredIds && filteredIds.size === 0 && (
              <p className="text-gray-500 text-sm py-2 text-center">
                No matching test cases
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
