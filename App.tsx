import React, { useState, useEffect } from 'react';
import { AppMode, User, Project } from './types';
import { Summarizer } from './components/Summarizer';
import { ChatInterface } from './components/ChatInterface';
import { LiveConversation } from './components/LiveConversation';
import { Dashboard } from './components/Dashboard';
import { AuthModal } from './components/AuthModal';
import { OnboardingTour } from './components/OnboardingTour';
import { StorageService } from './services/storage';
import { FileText, MessageSquare, Mic, Moon, LayoutDashboard, LogIn, LogOut, UserCircle } from 'lucide-react';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.SUMMARIZER);
  const [user, setUser] = useState<User | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    const currentUser = StorageService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
    }

    // Check if user has seen onboarding
    const hasSeen = StorageService.getOnboardingStatus();
    if (!hasSeen) {
       // Add a small delay before showing tour for better UX
       const timer = setTimeout(() => setShowTour(true), 1000);
       return () => clearTimeout(timer);
    }
  }, []);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    StorageService.logout();
    setUser(null);
    setMode(AppMode.SUMMARIZER);
  };

  const handleOpenProject = (project: Project) => {
    setCurrentProject(project);
    setMode(AppMode.SUMMARIZER);
  };

  const handleRequireAuth = () => {
    setShowAuth(true);
  };

  const handleTourClose = () => {
    setShowTour(false);
    StorageService.saveOnboardingStatus(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AuthModal 
        isOpen={showAuth} 
        onClose={() => setShowAuth(false)} 
        onLogin={handleLogin} 
      />
      
      {showTour && (
        <OnboardingTour onClose={handleTourClose} setAppMode={setMode} />
      )}

      {/* Header */}
      <header className="bg-emerald-900 text-white shadow-lg sticky top-0 z-40">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-800 rounded-lg border border-emerald-700">
              <Moon className="w-6 h-6 text-amber-400 fill-current" />
            </div>
            <div>
              <h1 className="text-2xl font-serif font-bold tracking-wide">Bayan<span className="text-emerald-400">AI</span></h1>
              <p className="text-xs text-emerald-200 opacity-80 tracking-widest uppercase">Islamic Lecture Companion</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <div className="hidden md:flex items-center gap-2 text-emerald-100">
                  <UserCircle className="w-5 h-5" />
                  <span className="font-medium">{user.username}</span>
                </div>
                <button 
                  onClick={handleLogout}
                  className="text-xs bg-emerald-800 hover:bg-emerald-700 px-3 py-1.5 rounded border border-emerald-600 transition-colors flex items-center gap-1"
                >
                  <LogOut className="w-3 h-3" /> Logout
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setShowAuth(true)}
                className="text-sm bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2 rounded-lg shadow transition-colors flex items-center gap-2"
              >
                <LogIn className="w-4 h-4" /> Login
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl h-full flex flex-col">
        
        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 mb-8 p-1 bg-white rounded-xl shadow-sm border border-slate-200 w-fit mx-auto">
          <button
            id="nav-summarizer"
            onClick={() => {
              setMode(AppMode.SUMMARIZER);
              setCurrentProject(null); // Reset current project when clicking tab manually
            }}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
              mode === AppMode.SUMMARIZER 
                ? 'bg-emerald-100 text-emerald-900 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <FileText className="w-4 h-4" /> Summarizer
          </button>
          
          <button
            id="nav-chat"
            onClick={() => setMode(AppMode.CHAT)}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
              mode === AppMode.CHAT 
                ? 'bg-emerald-100 text-emerald-900 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <MessageSquare className="w-4 h-4" /> Scholar Chat
          </button>
          
          <button
            id="nav-live"
            onClick={() => setMode(AppMode.LIVE)}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
              mode === AppMode.LIVE 
                ? 'bg-emerald-100 text-emerald-900 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Mic className="w-4 h-4" /> Live
          </button>

          {user && (
            <button
              id="nav-dashboard"
              onClick={() => setMode(AppMode.DASHBOARD)}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                mode === AppMode.DASHBOARD 
                  ? 'bg-emerald-100 text-emerald-900 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </button>
          )}
        </div>

        {/* View Container */}
        <div className="flex-1 bg-transparent">
          {mode === AppMode.SUMMARIZER && (
            <Summarizer 
              user={user} 
              initialProject={currentProject} 
              onRequireAuth={handleRequireAuth} 
            />
          )}
          {mode === AppMode.CHAT && <ChatInterface />}
          {mode === AppMode.LIVE && <LiveConversation />}
          {mode === AppMode.DASHBOARD && user && (
            <Dashboard user={user} onOpenProject={handleOpenProject} />
          )}
        </div>

      </main>
    </div>
  );
};

export default App;