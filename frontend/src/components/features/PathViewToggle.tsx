interface PathViewToggleProps {
  viewMode: 'input' | 'tree';
  onViewChange: (mode: 'input' | 'tree') => void;
}

export const PathViewToggle: React.FC<PathViewToggleProps> = ({
  viewMode,
  onViewChange,
}) => {
  return (
    <div className="flex gap-1 bg-gray-200 rounded p-0.5">
      <button
        onClick={() => onViewChange('input')}
        className={`px-3 py-1 text-sm rounded transition ${
          viewMode === 'input'
            ? 'bg-white text-blue-600 shadow-sm font-medium'
            : 'text-gray-600 hover:text-gray-800'
        }`}
      >
        Input View
      </button>
      <button
        onClick={() => onViewChange('tree')}
        className={`px-3 py-1 text-sm rounded transition ${
          viewMode === 'tree'
            ? 'bg-white text-blue-600 shadow-sm font-medium'
            : 'text-gray-600 hover:text-gray-800'
        }`}
      >
        Tree View
      </button>
    </div>
  );
};
