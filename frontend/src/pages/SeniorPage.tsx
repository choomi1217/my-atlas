import { useState } from 'react';
import SeniorTabBar, { SeniorTab } from '@/components/senior/SeniorTabBar';
import ChatView from '@/components/senior/ChatView';
import FaqListView from '@/components/senior/FaqListView';
import KbManagementView from '@/components/senior/KbManagementView';

export default function SeniorPage() {
  const [activeTab, setActiveTab] = useState<SeniorTab>('chat');

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-4">My Senior</h2>
      <SeniorTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'chat' && <ChatView />}
      {activeTab === 'faq' && <FaqListView />}
      {activeTab === 'kb' && <KbManagementView />}
    </div>
  );
}
