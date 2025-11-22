import React, { useState, useEffect, useRef } from 'react';
import { AppMode } from '../types';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';

interface Step {
  targetId?: string;
  title: string;
  content: string;
  mode?: AppMode;
}

interface OnboardingTourProps {
  onClose: () => void;
  setAppMode: (mode: AppMode) => void;
}

const STEPS: Step[] = [
  {
    title: "Welcome to BayanAI",
    content: "Your intelligent companion for Islamic lectures. Let's take a quick tour to get you started.",
    mode: AppMode.SUMMARIZER
  },
  {
    targetId: "summarizer-input-container",
    title: "Add Content",
    content: "Start here! You can paste text, upload audio files, or provide a URL to a lecture you want to analyze.",
    mode: AppMode.SUMMARIZER
  },
  {
    targetId: "summarizer-generate-btn",
    title: "Generate Summary",
    content: "Click this button to let Gemini process the content. We'll create a summary, check facts, and even generate an audio version for you.",
    mode: AppMode.SUMMARIZER
  },
  {
    targetId: "nav-chat",
    title: "Scholar Chat",
    content: "Have questions about what you heard? Switch to the Scholar Chat to discuss the lecture topic in depth.",
    mode: AppMode.CHAT
  },
  {
    targetId: "chat-input-area",
    title: "Ask Questions",
    content: "Type your questions here. Our AI scholar will provide answers referenced from authentic sources.",
    mode: AppMode.CHAT
  },
  {
    targetId: "nav-dashboard",
    title: "Save Your Work",
    content: "Create an account to access the Dashboard, where you can save and manage all your lecture summaries.",
    mode: AppMode.SUMMARIZER
  }
];

export const OnboardingTour: React.FC<OnboardingTourProps> = ({ onClose, setAppMode }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const step = STEPS[currentStepIndex];
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Change app mode if required by the step
    if (step.mode) {
      setAppMode(step.mode);
    }

    // Small delay to allow rendering of new mode before calculating position
    const timer = setTimeout(() => {
      updatePosition();
    }, 100);

    window.addEventListener('resize', updatePosition);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePosition);
    };
  }, [currentStepIndex, step.mode]);

  const updatePosition = () => {
    if (!step.targetId) {
      setPosition(null); // Center screen
      return;
    }

    const target = document.getElementById(step.targetId);
    if (target) {
      const rect = target.getBoundingClientRect();
      const cardWidth = 320; // Approximate width
      
      // Default: Position below
      let top = rect.bottom + 12;
      let left = rect.left + (rect.width / 2) - (cardWidth / 2);

      // Boundary checks (simple)
      if (left < 10) left = 10;
      if (left + cardWidth > window.innerWidth) left = window.innerWidth - cardWidth - 10;
      if (top + 200 > window.innerHeight) {
        // Flip to top if inconsistent space below
        top = rect.top - 220; 
      }

      setPosition({ top, left });
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
        // Fallback if element not found (e.g., hidden on mobile or not mounted)
        setPosition(null);
    }
  };

  const handleNext = () => {
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 pointer-events-auto transition-opacity" />

      {/* Spotlight Hole (Optional - simplified to just overlay card for now to avoid complexity with canvas/svg masks) */}
      
      {/* Tour Card */}
      <div 
        ref={cardRef}
        className="absolute pointer-events-auto bg-white rounded-xl shadow-2xl p-6 w-80 border border-emerald-100 animate-in fade-in zoom-in duration-300"
        style={position ? { 
          top: position.top, 
          left: position.left,
          position: 'fixed'
        } : {
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          position: 'fixed'
        }}
      >
        <div className="flex justify-between items-start mb-4">
          <h3 className="font-serif font-bold text-emerald-900 text-lg">{step.title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <p className="text-slate-600 text-sm mb-6 leading-relaxed">
          {step.content}
        </p>

        <div className="flex justify-between items-center">
          <div className="flex gap-1">
            {STEPS.map((_, idx) => (
              <div 
                key={idx} 
                className={`w-2 h-2 rounded-full transition-colors ${idx === currentStepIndex ? 'bg-emerald-600' : 'bg-slate-200'}`}
              />
            ))}
          </div>
          
          <div className="flex gap-2">
            {currentStepIndex > 0 && (
               <button 
                onClick={handlePrev}
                className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <button 
              onClick={handleNext}
              className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md transition-all"
            >
              {currentStepIndex === STEPS.length - 1 ? 'Finish' : 'Next'}
              {currentStepIndex !== STEPS.length - 1 && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
        
        {/* Arrow indicator if positioned relative */}
        {position && (
             <div className={`absolute w-4 h-4 bg-white border-l border-t border-emerald-100 transform rotate-45 -top-2 left-1/2 -ml-2`}></div>
        )}
      </div>
    </div>
  );
};