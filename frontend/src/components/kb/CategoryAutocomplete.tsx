import { useState, useEffect, useRef, useCallback } from 'react';
import { KbCategory } from '@/types/senior';
import { kbCategoryApi } from '@/api/senior';

interface CategoryAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function CategoryAutocomplete({ value, onChange, disabled }: CategoryAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<KbCategory[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [allCategories, setAllCategories] = useState<KbCategory[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    kbCategoryApi.getAll().then(setAllCategories).catch(() => {});
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = useCallback(
    (inputValue: string) => {
      onChange(inputValue);
      if (inputValue.trim()) {
        const filtered = allCategories.filter((c) =>
          c.name.toLowerCase().includes(inputValue.toLowerCase())
        );
        setSuggestions(filtered);
        setIsOpen(filtered.length > 0);
      } else {
        setSuggestions(allCategories.slice(0, 10));
        setIsOpen(allCategories.length > 0);
      }
    },
    [allCategories, onChange]
  );

  const handleSelect = (name: string) => {
    onChange(name);
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative flex-1">
      <input
        type="text"
        value={value}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => {
          const filtered = value.trim()
            ? allCategories.filter((c) => c.name.toLowerCase().includes(value.toLowerCase()))
            : allCategories.slice(0, 10);
          setSuggestions(filtered);
          setIsOpen(filtered.length > 0);
        }}
        disabled={disabled}
        placeholder="카테고리 (예: Test Design, Automation)"
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md
                   focus:outline-none focus:ring-2 focus:ring-indigo-500
                   disabled:bg-gray-100 disabled:text-gray-500"
      />
      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg
                       max-h-40 overflow-y-auto">
          {suggestions.map((cat) => (
            <li
              key={cat.id}
              onClick={() => handleSelect(cat.name)}
              className="px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50 cursor-pointer"
            >
              {cat.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
