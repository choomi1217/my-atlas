export type SeniorTab = 'chat' | 'faq';

interface SeniorTabBarProps {
  activeTab: SeniorTab;
  onTabChange: (tab: SeniorTab) => void;
}

const tabs: { key: SeniorTab; label: string }[] = [
  { key: 'chat', label: 'Chat' },
  { key: 'faq', label: 'FAQ' },
];

export default function SeniorTabBar({ activeTab, onTabChange }: SeniorTabBarProps) {
  return (
    <div className="flex border-b border-gray-200 mb-4">
      {tabs.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onTabChange(key)}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === key
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
