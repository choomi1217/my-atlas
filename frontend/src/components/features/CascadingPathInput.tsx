import { useState, useRef, useEffect } from 'react';
import { Segment } from '@/types/features';
import { segmentApi } from '@/api/features';

interface CascadingPathInputProps {
  segments: Segment[];
  selectedPath: number[];
  onPathChange: (path: number[]) => void;
  productId: number;
  onSegmentCreated: (segment: Segment) => void;
}

export const CascadingPathInput: React.FC<CascadingPathInputProps> = ({
  segments,
  selectedPath,
  onPathChange,
  productId,
  onSegmentCreated,
}) => {
  // Determine how many depth levels to show
  const depthCount = selectedPath.length + 1;

  const getChildrenOf = (parentId: number | null): Segment[] => {
    return segments.filter((s) =>
      parentId === null ? s.parentId === null : s.parentId === parentId
    );
  };

  const handleSelect = (depth: number, segmentId: number) => {
    const newPath = [...selectedPath.slice(0, depth), segmentId];
    onPathChange(newPath);
  };

  const handleRemoveDepth = (depth: number) => {
    onPathChange(selectedPath.slice(0, depth));
  };

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {Array.from({ length: depthCount }).map((_, depth) => {
        const parentId = depth === 0 ? null : selectedPath[depth - 1];
        // Only show this depth if parent exists or it's root
        if (depth > 0 && parentId === undefined) return null;
        const options = getChildrenOf(parentId);
        const selectedId = selectedPath[depth];

        return (
          <div key={depth} className="flex items-center gap-1">
            {depth > 0 && <span className="text-gray-400 text-sm">{'>'}</span>}
            <ComboboxSegment
              options={options}
              selectedId={selectedId}
              onSelect={(id) => handleSelect(depth, id)}
              onRemove={depth > 0 ? () => handleRemoveDepth(depth) : undefined}
              productId={productId}
              parentId={parentId}
              onSegmentCreated={onSegmentCreated}
            />
          </div>
        );
      })}
    </div>
  );
};

interface ComboboxSegmentProps {
  options: Segment[];
  selectedId: number | undefined;
  onSelect: (id: number) => void;
  onRemove?: () => void;
  productId: number;
  parentId: number | null;
  onSegmentCreated: (segment: Segment) => void;
}

const ComboboxSegment: React.FC<ComboboxSegmentProps> = ({
  options,
  selectedId,
  onSelect,
  onRemove,
  productId,
  parentId,
  onSegmentCreated,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedSegment = options.find((o) => o.id === selectedId);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        if (selectedSegment) {
          setInputValue(selectedSegment.name);
        } else {
          setInputValue('');
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedSegment]);

  useEffect(() => {
    if (selectedSegment) {
      setInputValue(selectedSegment.name);
    } else {
      setInputValue('');
    }
  }, [selectedSegment]);

  const filteredOptions = options.filter((o) =>
    o.name.toLowerCase().includes(inputValue.toLowerCase())
  );

  const exactMatch = options.some(
    (o) => o.name.toLowerCase() === inputValue.toLowerCase()
  );

  const handleInputFocus = () => {
    setIsOpen(true);
    setInputValue('');
  };

  const handleSelectOption = (segment: Segment) => {
    onSelect(segment.id);
    setInputValue(segment.name);
    setIsOpen(false);
  };

  const handleCreateNew = async () => {
    if (!inputValue.trim() || isCreating) return;
    setIsCreating(true);
    try {
      const newSegment = await segmentApi.create(
        productId,
        inputValue.trim(),
        parentId ?? undefined
      );
      onSegmentCreated(newSegment);
      onSelect(newSegment.id);
      setInputValue(newSegment.name);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to create segment:', error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-0.5">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setIsOpen(true);
          }}
          onFocus={handleInputFocus}
          placeholder="Select..."
          className="w-32 px-2 py-1 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        {onRemove && (
          <button
            onClick={onRemove}
            className="text-gray-400 hover:text-red-500 text-xs px-1"
            title="Remove"
          >
            x
          </button>
        )}
      </div>

      {isOpen && (
        <ul className="absolute z-10 mt-1 w-48 bg-white border rounded shadow-lg max-h-48 overflow-auto">
          {filteredOptions.map((segment) => (
            <li
              key={segment.id}
              onClick={() => handleSelectOption(segment)}
              className={`px-3 py-1.5 text-sm cursor-pointer hover:bg-blue-50 ${
                segment.id === selectedId
                  ? 'bg-blue-100 font-medium'
                  : ''
              }`}
            >
              {segment.name}
            </li>
          ))}
          {inputValue.trim() && !exactMatch && (
            <li
              onClick={handleCreateNew}
              className="px-3 py-1.5 text-sm cursor-pointer hover:bg-green-50 text-green-700 border-t"
            >
              {isCreating ? 'Creating...' : `+ Create "${inputValue.trim()}"`}
            </li>
          )}
          {filteredOptions.length === 0 && !inputValue.trim() && (
            <li className="px-3 py-1.5 text-sm text-gray-400">
              No segments. Type to create.
            </li>
          )}
        </ul>
      )}
    </div>
  );
};
