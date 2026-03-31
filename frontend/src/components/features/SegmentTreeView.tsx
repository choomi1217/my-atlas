import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Segment, TestCase } from '@/types/features';
import { segmentApi } from '@/api/features';
import ConfirmDialog from '@/components/features/ConfirmDialog';

interface SegmentTreeViewProps {
  segments: Segment[];
  testCases: TestCase[];
  selectedPath: number[];
  onSelectPath: (path: number[]) => void;
  productId: number;
  onSegmentCreated: (segment: Segment) => void;
  onSegmentDeleted: (id: number) => void;
  onSegmentsUpdated: (segments: Segment[]) => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  segmentId: number;
  isRoot: boolean;
  parentId: number | null;
  path: number[];
}

interface InlineInputState {
  mode: 'above' | 'below' | 'root';
  targetId: number | null;
  parentId: number | null;
}

export const SegmentTreeView: React.FC<SegmentTreeViewProps> = ({
  segments,
  testCases,
  selectedPath,
  onSelectPath,
  productId,
  onSegmentCreated,
  onSegmentDeleted,
  onSegmentsUpdated,
}) => {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [inlineInput, setInlineInput] = useState<InlineInputState | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const childrenMap = useMemo(() => {
    const map = new Map<number | null, Segment[]>();
    segments.forEach((seg) => {
      const key = seg.parentId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(seg);
    });
    return map;
  }, [segments]);

  const countTestCases = (pathPrefix: number[]): number => {
    return testCases.filter((tc) => {
      if (!tc.path || tc.path.length < pathPrefix.length) return false;
      return pathPrefix.every((id, i) => tc.path[i] === id);
    }).length;
  };

  const toggleExpand = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectNode = (path: number[]) => {
    onSelectPath(path);
  };

  // Close context menu on outside click or ESC
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu]);

  // Auto-focus inline input
  useEffect(() => {
    if (inlineInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [inlineInput]);

  const handleContextMenu = (
    e: React.MouseEvent,
    segment: Segment,
    path: number[]
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const menuWidth = 180;
    const menuHeight = 120;
    let x = e.clientX;
    let y = e.clientY;
    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth;
    if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight;

    setContextMenu({
      x,
      y,
      segmentId: segment.id,
      isRoot: segment.parentId === null,
      parentId: segment.parentId,
      path,
    });
  };

  const handleAddAbove = useCallback(() => {
    if (!contextMenu) return;
    setInlineInput({
      mode: 'above',
      targetId: contextMenu.segmentId,
      parentId: contextMenu.parentId,
    });
    setInputValue('');
    setContextMenu(null);
  }, [contextMenu]);

  const handleAddBelow = useCallback((segmentId?: number) => {
    if (segmentId !== undefined) {
      setInlineInput({
        mode: 'below',
        targetId: segmentId,
        parentId: null,
      });
    } else if (contextMenu) {
      setInlineInput({
        mode: 'below',
        targetId: contextMenu.segmentId,
        parentId: null,
      });
      setContextMenu(null);
    }
    setInputValue('');
  }, [contextMenu]);

  const handleRequestDeletePath = useCallback(() => {
    if (!contextMenu || contextMenu.isRoot) return;
    const seg = segments.find((s) => s.id === contextMenu.segmentId);
    setDeleteTarget({ id: contextMenu.segmentId, name: seg?.name || '' });
    setContextMenu(null);
  }, [contextMenu, segments]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await segmentApi.delete(deleteTarget.id);
      onSegmentDeleted(deleteTarget.id);
    } catch (error) {
      console.error('Failed to delete segment:', error);
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleInlineSubmit = async () => {
    if (!inputValue.trim() || isCreating || !inlineInput) return;
    setIsCreating(true);
    try {
      if (inlineInput.mode === 'root') {
        const newSegment = await segmentApi.create(productId, inputValue.trim());
        onSegmentCreated(newSegment);
      } else if (inlineInput.mode === 'below') {
        const newSegment = await segmentApi.create(
          productId,
          inputValue.trim(),
          inlineInput.targetId ?? undefined
        );
        onSegmentCreated(newSegment);
        if (inlineInput.targetId !== null) {
          setExpanded((prev) => new Set([...prev, inlineInput.targetId!]));
        }
      } else if (inlineInput.mode === 'above') {
        const newSegment = await segmentApi.create(
          productId,
          inputValue.trim(),
          inlineInput.parentId ?? undefined
        );
        try {
          const reparented = await segmentApi.reparent(
            inlineInput.targetId!,
            newSegment.id
          );
          const updated = segments.map((s) =>
            s.id === reparented.id ? reparented : s
          );
          updated.push(newSegment);
          onSegmentsUpdated(updated);
          setExpanded((prev) => new Set([...prev, newSegment.id]));
        } catch (error) {
          console.error('Failed to reparent, rolling back:', error);
          await segmentApi.delete(newSegment.id);
        }
      }
    } catch (error) {
      console.error('Failed to create segment:', error);
    } finally {
      setIsCreating(false);
      setInlineInput(null);
      setInputValue('');
    }
  };

  const handleInlineCancel = () => {
    setInlineInput(null);
    setInputValue('');
  };

  const handleInlineKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleInlineSubmit();
    } else if (e.key === 'Escape') {
      handleInlineCancel();
    }
  };

  const renderInlineInput = () => (
    <div className="flex items-center gap-1 ml-4 my-1">
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleInlineKeyDown}
        placeholder="Path 이름 입력..."
        className="w-40 px-2 py-1 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
        disabled={isCreating}
      />
      <button
        onClick={handleInlineSubmit}
        disabled={!inputValue.trim() || isCreating}
        className="text-green-600 hover:text-green-700 text-sm px-1 disabled:opacity-50"
        title="확인"
      >
        {isCreating ? '...' : '✓'}
      </button>
      <button
        onClick={handleInlineCancel}
        className="text-gray-400 hover:text-red-500 text-sm px-1"
        title="취소"
      >
        ✕
      </button>
    </div>
  );

  const isSelected = (path: number[]): boolean => {
    return (
      selectedPath.length === path.length &&
      selectedPath.every((id, i) => path[i] === id)
    );
  };

  const renderNode = (segment: Segment, ancestorPath: number[]) => {
    const currentPath = [...ancestorPath, segment.id];
    const isExpanded = expanded.has(segment.id);
    const children = childrenMap.get(segment.id) || [];
    const count = countTestCases(currentPath);
    const isLeaf = children.length === 0;
    const nodeSelected = isSelected(currentPath);

    const showAboveInput =
      inlineInput?.mode === 'above' && inlineInput.targetId === segment.id;
    const showBelowInput =
      inlineInput?.mode === 'below' && inlineInput.targetId === segment.id;

    return (
      <div key={segment.id}>
        {showAboveInput && renderInlineInput()}
        <div className="ml-4">
          <div
            className={`flex items-center gap-1 py-1 px-2 rounded text-sm group ${
              nodeSelected
                ? 'bg-blue-100 border-l-2 border-blue-500'
                : 'hover:bg-gray-100'
            } cursor-pointer`}
            onClick={() => handleSelectNode(currentPath)}
            onContextMenu={(e) => handleContextMenu(e, segment, currentPath)}
          >
            {!isLeaf ? (
              <span
                className="text-gray-400 w-4 text-center cursor-pointer hover:text-gray-600 flex-shrink-0"
                onClick={(e) => toggleExpand(segment.id, e)}
              >
                {isExpanded ? '▼' : '▶'}
              </span>
            ) : (
              <span className="w-4 text-center text-gray-300 flex-shrink-0">
                -
              </span>
            )}
            <span
              className={`${
                nodeSelected ? 'text-blue-700 font-medium' : isLeaf ? 'text-blue-600' : 'font-medium'
              }`}
            >
              {segment.name}
            </span>
            {count > 0 && (
              <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">
                {count}
              </span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAddBelow(segment.id);
              }}
              className="ml-auto text-gray-300 hover:text-blue-500 text-xs px-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
              title="하단에 Path 추가"
            >
              +
            </button>
          </div>
          {isExpanded &&
            children.map((child) => renderNode(child, currentPath))}
          {showBelowInput && (
            <div className="ml-4">{renderInlineInput()}</div>
          )}
        </div>
      </div>
    );
  };

  const rootSegments = childrenMap.get(null) || [];

  // Empty state: Register Root Path
  if (rootSegments.length === 0 && !inlineInput) {
    return (
      <div className="bg-white border rounded p-4">
        <div className="text-center py-4">
          <p className="text-sm text-gray-500 mb-3">
            등록된 Path가 없습니다. Root Path를 등록하세요.
          </p>
          <button
            onClick={() => {
              setInlineInput({ mode: 'root', targetId: null, parentId: null });
              setInputValue('');
            }}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            Root Path 등록
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white border rounded p-2 relative">
        {inlineInput?.mode === 'root' && (
          <div className="mb-2">{renderInlineInput()}</div>
        )}
        {rootSegments.map((seg) => renderNode(seg, []))}

        {/* Context Menu */}
        {contextMenu && (
          <div
            ref={contextMenuRef}
            className="fixed bg-white border rounded shadow-lg py-1 z-50"
            style={{ left: contextMenu.x, top: contextMenu.y, minWidth: 160 }}
          >
            <button
              onClick={handleAddAbove}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
            >
              상단에 Path 추가
            </button>
            <button
              onClick={() => handleAddBelow()}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
            >
              하단에 Path 추가
            </button>
            <hr className="my-1" />
            <button
              onClick={handleRequestDeletePath}
              disabled={contextMenu.isRoot}
              className={`w-full text-left px-4 py-2 text-sm ${
                contextMenu.isRoot
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-red-600 hover:bg-red-50'
              }`}
            >
              Path 삭제
            </button>
          </div>
        )}
      </div>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Path"
        message={`"${deleteTarget?.name}" 경로를 삭제하시겠습니까? 하위 Path도 함께 삭제됩니다.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
};
