import React, { useState } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  FileSearch,
  Layers,
  CalendarCheck,
  Sparkles,
  Settings,
  MoreHorizontal,
  RotateCcw,
  Wrench,
  Award,
  BarChart3,
  X,
  Box,
} from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isMoreOpen?: boolean;
  onToggleMore?: (open: boolean) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  isMoreOpen,
  onToggleMore,
}) => {
  const [internalMoreMenu, setInternalMoreMenu] = useState(false);
  const showMoreMenu = isMoreOpen !== undefined ? isMoreOpen : internalMoreMenu;
  const setShowMoreMenu = (val: boolean | ((prev: boolean) => boolean)) => {
    const nextVal = typeof val === 'function' ? val(showMoreMenu) : val;
    setInternalMoreMenu(nextVal);
    if (onToggleMore) onToggleMore(nextVal);
  };

  const primaryItems = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'syllabus', label: 'My Syllabus', icon: BookOpen },
    { id: 'pyqs', label: 'PYQ Analysis', icon: FileSearch },
    { id: 'backlog', label: 'Backlog', icon: Layers },
    { id: 'ai-assistant', label: 'AI Assistant', icon: Sparkles },
  ];

  const secondaryItems = [
    {
      id: '3d-lab',
      label: '3D Science Lab',
      icon: Box,
      description: 'Interactive 3D Three.js simulations for Physics, Chemistry & Biology',
    },
    {
      id: 'planner',
      label: 'Study Planner',
      icon: CalendarCheck,
      description: 'Daily schedule, energy-slot tasks, and session limits',
    },
    {
      id: 'revisions',
      label: 'Spaced Revisions',
      icon: RotateCcw,
      description: 'Adaptive 1-3-7-21 day revision queue and recall tracking',
    },
    {
      id: 'tests-exams',
      label: 'Mock Tests & Milestones',
      icon: Award,
      description: 'Score logs, mistake records, and editable exam targets',
    },
    {
      id: 'pcm-tools',
      label: 'Formula & Mistake Tools',
      icon: Wrench,
      description: 'Physics, Chemistry & Math formulas, reactions, and mistake log',
    },
    {
      id: 'reports',
      label: 'Analytics & Pace Reports',
      icon: BarChart3,
      description: 'High-yield priority matrix and required daily study pace',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      description: 'Global personalization, subjects, priorities, and cloud backup',
    },
  ];

  const isMoreActive = secondaryItems.some((item) => item.id === activeTab);

  return (
    <>
      <nav
        aria-label="Mobile Bottom Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FBF7EF]/95 backdrop-blur-md border-t border-[#E5DEC9] pb-safe"
      >
        <div className="grid grid-cols-6 items-center h-14 px-1">
          {primaryItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              activeTab === item.id ||
              (item.id === 'syllabus' && activeTab === 'import-syllabus');
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setShowMoreMenu(false);
                }}
                className={`flex flex-col items-center justify-center min-h-[44px] rounded-xl transition cursor-pointer ${
                  isActive
                    ? 'text-[#1B4D48] font-bold'
                    : 'text-[#52736E] hover:text-[#1B4D48]'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-[#42BDAE]' : ''}`} />
                <span className="text-[10px] mt-0.5 tracking-tight whitespace-nowrap truncate max-w-[60px]">
                  {item.label}
                </span>
              </button>
            );
          })}

          <button
            onClick={() => setShowMoreMenu((prev) => !prev)}
            aria-label="More navigation options"
            className={`flex flex-col items-center justify-center min-h-[44px] rounded-xl transition cursor-pointer ${
              isMoreActive || showMoreMenu
                ? 'text-[#1B4D48] font-bold'
                : 'text-[#52736E] hover:text-[#1B4D48]'
            }`}
          >
            <MoreHorizontal className={`w-5 h-5 ${isMoreActive ? 'text-[#42BDAE]' : ''}`} />
            <span className="text-[10px] mt-0.5 tracking-tight whitespace-nowrap">More</span>
          </button>
        </div>
      </nav>

      {showMoreMenu && (
        <div className="lg:hidden fixed inset-0 z-50 bg-[#1B4D48]/30 backdrop-blur-xs flex flex-col justify-end">
          <div className="bg-[#FBF7EF] rounded-t-3xl p-5 border-t border-[#E5DEC9] shadow-xl max-h-[82vh] overflow-y-auto">
            <div className="w-10 h-1.5 bg-[#D8CFB8] rounded-full mx-auto mb-3" />
            <div className="flex items-center justify-between pb-3 border-b border-[#E5DEC9]">
              <span className="font-bold text-sm text-[#1B4D48]">More AZORA Study Modules</span>
              <button
                onClick={() => setShowMoreMenu(false)}
                aria-label="Close more menu"
                className="p-2 rounded-full text-[#4A6B66] hover:text-[#1B4D48]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2.5 mt-4">
              {secondaryItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setShowMoreMenu(false);
                    }}
                    className={`flex items-center gap-3.5 p-3.5 rounded-2xl text-left transition cursor-pointer ${
                      isActive
                        ? 'bg-[#75D9B4]/25 text-[#1B4D48] border border-[#42BDAE]'
                        : 'bg-[#F5EFE2] text-[#1B4D48] hover:bg-[#EDE5D4] border border-[#E2DAC7]'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isActive ? 'bg-[#1B4D48] text-[#FBF7EF]' : 'bg-[#E6DEC8] text-[#1B4D48]'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[#1B4D48]">{item.label}</div>
                      <div className="text-xs text-[#4A6B66]">{item.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
