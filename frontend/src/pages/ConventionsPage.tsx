import { useNavigate } from 'react-router-dom';
import { useConvention, SortBy } from '@/hooks/useConvention';
import ConventionCard from '@/components/convention/ConventionCard';

const sortOptions: { key: SortBy; label: string }[] = [
  { key: 'date', label: '등록순' },
  { key: 'name', label: '이름순' },
];

export default function ConventionsPage() {
  const {
    filteredAndSorted,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    deleteConvention,
  } = useConvention();

  const navigate = useNavigate();

  const handleDelete = async (id: number, term: string) => {
    if (!window.confirm(`"${term}" 용어를 삭제하시겠습니까?`)) return;
    try {
      await deleteConvention(id);
    } catch {
      alert('삭제에 실패했습니다.');
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-800">Word Conventions</h2>
        <button
          onClick={() => navigate('/conventions/new')}
          className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
        >
          + Add Word
        </button>
      </div>

      {/* Search + Sort */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="용어, 정의, 카테고리 검색..."
            className="w-full px-3 py-2 pl-9 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        <div className="flex border border-gray-300 rounded-md overflow-hidden">
          {sortOptions.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`px-3 py-2 text-sm transition-colors ${
                sortBy === key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-gray-400 text-sm">Loading...</div>
      ) : error ? (
        <div className="text-red-500 text-sm">Error: {error}</div>
      ) : filteredAndSorted.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>{searchQuery.trim() ? '일치하는 용어가 없습니다.' : '등록된 용어가 없습니다. 새 용어를 추가하세요.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAndSorted.map((item) => (
            <ConventionCard
              key={item.id}
              convention={item}
              onClick={() => navigate(`/conventions/${item.id}`)}
              onDelete={() => handleDelete(item.id, item.term)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
