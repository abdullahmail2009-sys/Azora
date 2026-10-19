import React from 'react';
import { useApp } from '../context/AppContext.tsx';
import { useLocalMusic } from '../context/LocalMusicContext.tsx';
import { LogIn, LogOut, Sparkles, Music } from 'lucide-react';
import { AzoraPrimaryLogo } from './AzoraBrandLogo.tsx';
import { PWAInstallButton } from './PWAInstallButton.tsx';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenAITutor: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const { currentUser, loginGoogle, logoutUser } = useApp();
  const { isPlaying, masterEnabled, setIsPlayerOpen, isPausedByBackground } = useLocalMusic();

  const navItems = [
    { id: 'dashboard', label: 'Home' },
    { id: 'syllabus', label: 'My Syllabus' },
    { id: 'pyqs', label: 'PYQ Analysis' },
    { id: 'backlog', label: 'Backlog' },
    { id: 'planner', label: 'Study Planner' },
    { id: '3d-lab', label: '3D Science Lab' },
    { id: 'ai-assistant', label: 'AI Assistant' },
    { id: 'settings', label: 'Settings' },
  ];

  const plannerSubTabs = ['planner', 'revisions', 'tests-exams', 'pcm-tools', 'reports'];

  return (
    <header className="sticky top-0 z-40 bg-[#FBF7EF]/95 backdrop-blur-md border-b border-[#E5DEC9] transition-colors pt-safe">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Zone 1: Primary Horizontal AZORA Logo (Symbol + AZORA Wordmark in Deep Muted Teal) */}
          <button
            onClick={() => setActiveTab('dashboard')}
            aria-label="AZORA Home"
            className="flex items-center gap-2.5 shrink-0 cursor-pointer group focus:outline-none"
          >
            <AzoraPrimaryLogo
              layout="horizontal"
              symbolSize={38}
              showTagline={false}
              idPrefix="navbar-logo"
            />
          </button>

          {/* Zone 2: Clean single-line text navigation links */}
          <nav
            aria-label="Primary Navigation"
            className="hidden lg:flex items-center gap-6 text-sm font-medium text-[#4A6B66]"
          >
            {navItems.map((item) => {
              const isActive =
                activeTab === item.id ||
                (item.id === 'syllabus' && activeTab === 'import-syllabus') ||
                (item.id === 'planner' && plannerSubTabs.includes(activeTab));
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`py-1.5 whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
                    isActive
                      ? 'border-[#42BDAE] text-[#1B4D48] font-bold'
                      : 'border-transparent text-[#4A6B66] hover:text-[#1B4D48] hover:border-[#75D9B4]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Primary action & Auth */}
          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton />

            <button
              onClick={() => {
                setIsPlayerOpen(true);
              }}
              aria-label="Local Music Player"
              title={
                !masterEnabled
                  ? 'Custom Local Music Player (Disabled)'
                  : isPausedByBackground
                  ? 'Custom Local Music Player (Paused in Background)'
                  : isPlaying
                  ? 'Custom Local Music Player (Playing)'
                  : 'Custom Local Music Player'
              }
              className={`p-2 rounded-xl transition flex items-center justify-center cursor-pointer ${
                isPlaying
                  ? 'bg-[#75D9B4]/20 text-[#1B4D48] border border-[#42BDAE]'
                  : isPausedByBackground
                  ? 'bg-amber-100 text-amber-900 border border-amber-400'
                  : 'text-[#4A6B66] hover:text-[#1B4D48] hover:bg-[#F2ECE0]'
              }`}
            >
              <Music className={`w-4 h-4 ${isPlaying ? 'animate-bounce text-[#1B4D48]' : ''}`} />
            </button>

            <button
              onClick={() => setActiveTab('ai-assistant')}
              aria-label="Open AI Assistant"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1B4D48] hover:bg-[#143B37] text-[#FBF7EF] text-xs font-semibold shadow-2xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#75D9B4]" />
              <span>Ask AI</span>
            </button>

            {currentUser ? (
              <button
                onClick={logoutUser}
                aria-label="Sign out"
                title={`Signed in as ${currentUser.email || 'User'} — Click to sign out`}
                className="p-2 rounded-xl text-[#4A6B66] hover:text-[#1B4D48] hover:bg-[#F2ECE0] transition cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={loginGoogle}
                aria-label="Sign in with Google"
                title="Sign in with Google"
                className="p-2 rounded-xl text-[#4A6B66] hover:text-[#1B4D48] hover:bg-[#F2ECE0] transition cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
