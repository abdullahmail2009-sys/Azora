import React, { useState, useEffect, useRef } from 'react';
import { App as CapApp } from '@capacitor/app';
import { AppProvider, useApp } from './context/AppContext.tsx';
import { LocalMusicProvider, useLocalMusic } from './context/LocalMusicContext.tsx';
import { resolveAndroidBackAction } from './utils/apiClient.ts';
import { Navbar } from './components/Navbar.tsx';
import { BottomNav } from './components/BottomNav.tsx';
import { OfflineBanner } from './components/OfflineBanner.tsx';
import { TopicModal } from './components/TopicModal.tsx';
import { SyllabusDiffModal } from './components/SyllabusDiffModal.tsx';
import { AITutorModal } from './components/AITutorModal.tsx';
import { LocalMusicPlayer } from './components/LocalMusicPlayer.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';

// Views
import { DashboardView } from './views/DashboardView.tsx';
import { SyllabusView } from './views/SyllabusView.tsx';
import { SyllabusImportView } from './views/SyllabusImportView.tsx';
import { PYQView } from './views/PYQView.tsx';
import { BacklogView } from './views/BacklogView.tsx';
import { StudyPlannerView } from './views/StudyPlannerView.tsx';
import { AIAssistantView } from './views/AIAssistantView.tsx';
import { ThreeDLabView } from './views/ThreeDLabView.tsx';
import { SettingsView } from './views/SettingsView.tsx';

const MainAppContent: React.FC = () => {
  const { activeSyllabus } = useApp();
  const { isPlayerOpen, setIsPlayerOpen, isExpanded, setIsExpanded } = useLocalMusic();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState<boolean>(false);

  // Selected Topic for Topic Management Modal
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);

  // Syllabus Diff Modal
  const [isSyllabusDiffOpen, setIsSyllabusDiffOpen] = useState(false);

  // AI Tutor Modal State (for topic-specific explanations)
  const [isAITutorOpen, setIsAITutorOpen] = useState(false);
  const [aiTutorContext, setAiTutorContext] = useState<{
    topicTitle?: string;
    chapterTitle?: string;
    subjectName?: string;
  }>({});

  const backStateRef = useRef({
    isAITutorOpen,
    isSyllabusDiffOpen,
    hasSelectedTopic: selectedTopicId !== null,
    isMobileMoreMenuOpen: isMobileMoreOpen,
    isMusicPlayerExpanded: isExpanded,
    isMusicPlayerOpen: isPlayerOpen,
    activeTab,
  });

  useEffect(() => {
    backStateRef.current = {
      isAITutorOpen,
      isSyllabusDiffOpen,
      hasSelectedTopic: selectedTopicId !== null,
      isMobileMoreMenuOpen: isMobileMoreOpen,
      isMusicPlayerExpanded: isExpanded,
      isMusicPlayerOpen: isPlayerOpen,
      activeTab,
    };
  }, [
    isAITutorOpen,
    isSyllabusDiffOpen,
    selectedTopicId,
    isMobileMoreOpen,
    isExpanded,
    isPlayerOpen,
    activeTab,
  ]);

  // Android Hardware Back Button Listener (@capacitor/app)
  useEffect(() => {
    let listenerHandle: { remove: () => Promise<void> } | null = null;
    let isMounted = true;

    CapApp.addListener('backButton', () => {
      const action = resolveAndroidBackAction(backStateRef.current);
      switch (action) {
        case 'close_ai_tutor':
          setIsAITutorOpen(false);
          break;
        case 'close_syllabus_diff':
          setIsSyllabusDiffOpen(false);
          break;
        case 'close_topic_modal':
          setSelectedTopicId(null);
          break;
        case 'close_mobile_more_menu':
          setIsMobileMoreOpen(false);
          break;
        case 'collapse_music_player':
          setIsExpanded(false);
          break;
        case 'close_music_player':
          setIsPlayerOpen(false);
          break;
        case 'navigate_to_syllabus':
          setActiveTab('syllabus');
          break;
        case 'navigate_to_dashboard':
          setActiveTab('dashboard');
          break;
        case 'exit_app':
          CapApp.exitApp();
          break;
      }
    })
      .then((handle) => {
        if (!isMounted) {
          handle.remove();
        } else {
          listenerHandle = handle;
        }
      })
      .catch(() => {
        // Ignored on standard web browsers where native Capacitor bridge is inactive
      });

    return () => {
      isMounted = false;
      if (listenerHandle) {
        listenerHandle.remove().catch(() => {});
      }
    };
  }, [setIsExpanded, setIsPlayerOpen]);

  // Helper to locate a topic object from active syllabus
  const findTopicDetails = (topicId: string) => {
    for (const sub of activeSyllabus.subjects) {
      for (const unit of sub.units) {
        for (const chap of unit.chapters) {
          for (const top of chap.topics) {
            if (top.id === topicId) {
              return {
                topic: top,
                chapterTitle: chap.title,
                subjectName: sub.name,
              };
            }
          }
        }
      }
    }
    return null;
  };

  const selectedTopicDetails = selectedTopicId ? findTopicDetails(selectedTopicId) : null;

  const handleOpenAITutorForTopic = (
    topicTitle: string,
    chapterTitle: string,
    subjectName: string
  ) => {
    setAiTutorContext({ topicTitle, chapterTitle, subjectName });
    setIsAITutorOpen(true);
  };

  const handleOpenGeneralAITutor = () => {
    setActiveTab('ai-assistant');
  };

  const plannerTabs = ['planner', 'revisions', 'tests-exams', 'pcm-tools', 'reports'];

  return (
    <div className="min-h-screen bg-[#FBF7EF] text-[#1B4D48] flex flex-col font-sans selection:bg-[#42BDAE] selection:text-white">
      {/* Offline Banner */}
      <OfflineBanner />

      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAITutor={handleOpenGeneralAITutor}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 pt-5 pb-24 lg:pb-12">
        <ErrorBoundary onReset={() => setActiveTab('dashboard')}>
          {(activeTab === 'dashboard' || activeTab === 'home') && (
            <DashboardView
              onSelectTopic={(id: string) => setSelectedTopicId(id)}
              setActiveTab={(tab: string) => setActiveTab(tab)}
              onOpenAITutor={handleOpenGeneralAITutor}
            />
          )}

          {activeTab === 'syllabus' && (
            <SyllabusView
              onSelectTopic={(id: string) => setSelectedTopicId(id)}
              onOpenSyllabusDiff={() => setIsSyllabusDiffOpen(true)}
              onOpenAITutor={handleOpenGeneralAITutor}
              onNavigateToImportPDF={() => setActiveTab('import-syllabus')}
            />
          )}

          {(activeTab === 'import-syllabus' || activeTab === 'syllabus_import') && (
            <SyllabusImportView
              onBackToSyllabus={() => setActiveTab('syllabus')}
              onNavigateToPlanner={() => setActiveTab('planner')}
            />
          )}

          {(activeTab === 'pyqs' || activeTab === 'pyq') && (
            <PYQView onSelectTopic={(id: string) => setSelectedTopicId(id)} />
          )}

          {activeTab === 'backlog' && (
            <BacklogView
              onSelectTopic={(id: string) => setSelectedTopicId(id)}
              onNavigateToAI={() => setActiveTab('ai-assistant')}
            />
          )}

          {plannerTabs.includes(activeTab) && (
            <StudyPlannerView
              initialSection={
                activeTab === 'revisions'
                  ? 'revisions'
                  : activeTab === 'tests-exams'
                  ? 'tests-exams'
                  : activeTab === 'pcm-tools'
                  ? 'pcm-tools'
                  : activeTab === 'reports'
                  ? 'reports'
                  : 'schedule'
              }
              onOpenAITutorForMistake={(mistakeText: string) => {
                setAiTutorContext({ topicTitle: mistakeText, subjectName: 'Physics' });
                setIsAITutorOpen(true);
              }}
            />
          )}

          {(activeTab === '3d-lab' || activeTab === '3d_lab') && (
            <ThreeDLabView />
          )}

          {(activeTab === 'ai-assistant' || activeTab === 'ai_assistant') && (
            <AIAssistantView
              setActiveTab={(tab: string) => setActiveTab(tab)}
              onSelectTopic={(id: string) => setSelectedTopicId(id)}
            />
          )}

          {activeTab === 'settings' && <SettingsView />}
        </ErrorBoundary>
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isMoreOpen={isMobileMoreOpen}
        onToggleMore={setIsMobileMoreOpen}
      />

      {/* Topic Management Modal */}
      {selectedTopicDetails && (
        <TopicModal
          topic={selectedTopicDetails.topic}
          chapterTitle={selectedTopicDetails.chapterTitle}
          subjectName={selectedTopicDetails.subjectName}
          onClose={() => setSelectedTopicId(null)}
          onOpenAITutorForTopic={handleOpenAITutorForTopic}
        />
      )}

      {/* Syllabus Edition Comparison Modal */}
      {isSyllabusDiffOpen && (
        <SyllabusDiffModal onClose={() => setIsSyllabusDiffOpen(false)} />
      )}

      {/* AI Tutor Modal */}
      {isAITutorOpen && (
        <AITutorModal
          onClose={() => setIsAITutorOpen(false)}
          initialTopic={aiTutorContext.topicTitle}
          initialChapter={aiTutorContext.chapterTitle}
          initialSubject={aiTutorContext.subjectName}
        />
      )}

      {/* Custom Local Background Music Player */}
      <LocalMusicPlayer />

      {/* Unified Account Sign-In / Registration Modal */}
      <AuthModal />
    </div>
  );
};

export function App() {
  return (
    <AppProvider>
      <LocalMusicProvider>
        <MainAppContent />
      </LocalMusicProvider>
    </AppProvider>
  );
}

export default App;
