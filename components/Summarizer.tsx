
import React, { useState, useEffect } from 'react';
import { summarizeLecture, transcribeAudio, generateTTS } from '../services/gemini';
import { fetchYoutubeTranscript } from '../services/transcriptApi';
import { LectureSummary, Project, User, UserPreferences } from '../types';
import { decode, pcmToWav } from '../services/audioUtils';
import { StorageService } from '../services/storage';
import { Upload, FileText, Play, CheckCircle, AlertTriangle, Globe, Loader2, Save, Settings, ToggleLeft, ToggleRight, Link, AlignLeft, FileAudio, XCircle } from 'lucide-react';
import { AudioPlayer } from './AudioPlayer';

interface SummarizerProps {
  user: User | null;
  initialProject: Project | null;
  onRequireAuth: () => void;
}

type InputMode = 'text' | 'file' | 'url';

export const Summarizer: React.FC<SummarizerProps> = ({ user, initialProject, onRequireAuth }) => {
  const [inputMode, setInputMode] = useState<InputMode>('text');
  const [inputText, setInputText] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<LectureSummary | null>(null);
  
  // Audio Playback State
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  
  // Project State
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Preferences
  const [preferences, setPreferences] = useState<UserPreferences>(
    user?.preferences || { transliterationScheme: 'ISO', includeLiteralTranslation: true }
  );
  const [showSettings, setShowSettings] = useState(false);

  // Load initial project if provided
  useEffect(() => {
    if (initialProject) {
      setInputText(initialProject.transcript);
      setSummary(initialProject.summary);
      setProjectTitle(initialProject.title);
      setCurrentProjectId(initialProject.id);
      setInputMode('text'); // Ensure we show the text
      setError(null);
      setAudioUrl(null); // Reset audio on new project load
    } else {
      // Reset
      setInputText('');
      setInputUrl('');
      setFile(null);
      setSummary(null);
      setProjectTitle('');
      setCurrentProjectId(null);
      setInputMode('text');
      setError(null);
      setAudioUrl(null);
    }
  }, [initialProject]);

  // Update preferences if user changes
  useEffect(() => {
    if (user) {
      setPreferences(user.preferences);
    }
  }, [user]);

  // Clean up object URL on unmount or change
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleProcess = async () => {
    setIsLoading(true);
    setSummary(null);
    setError(null);
    setAudioUrl(null);
    
    try {
      let textToSummarize = inputText;

      if (inputMode === 'file' && file) {
        setStatus('Transcribing audio file...');
        textToSummarize = await transcribeAudio(file);
        setInputText(textToSummarize);
        setInputMode('text');
      } else if (inputMode === 'url') {
        if (!inputUrl.trim()) throw new Error("Please enter a URL.");
        
        // Validate URL format
        try {
          new URL(inputUrl);
        } catch (e) {
          throw new Error("Invalid URL format. Please include http:// or https://");
        }

        const isYouTube = inputUrl.match(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/);
        
        if (isYouTube) {
            setStatus('Checking for transcript...');
            
            // Attempt to fetch transcript using specialized API
            const fetchedTranscript = await fetchYoutubeTranscript(inputUrl);
            
            if (fetchedTranscript) {
                setStatus('Transcript retrieved. Analyzing...');
                textToSummarize = fetchedTranscript;
                setInputText(fetchedTranscript); // Show text to user
                setInputMode('text');
            } else {
                // Fallback: YouTube URLs cannot be fetched client-side directly due to CORS.
                // We pass the URL directly to Gemini to use Search Grounding as a fallback.
                setStatus('Direct transcript unavailable. Analyzing content via Gemini Search...');
                textToSummarize = inputUrl;
            }
        } else {
            setStatus('Fetching content from URL...');
            try {
              const response = await fetch(inputUrl);
              if (!response.ok) throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
              
              const contentType = response.headers.get('content-type');
              
              if (contentType && (contentType.includes('text') || contentType.includes('json') || contentType.includes('xml'))) {
                 // Treat as transcript/text
                 setStatus('Reading transcript...');
                 textToSummarize = await response.text();
                 setInputText(textToSummarize);
                 setInputMode('text');
              } else {
                 // Assume Audio/Binary
                 const blob = await response.blob();
                 if (blob.size === 0) throw new Error("Fetched content is empty.");
                 
                 setStatus('Transcribing audio from URL...');
                 // Ensure we have a mime type for Gemini, fallback to mp3 if unknown
                 const audioBlob = blob.type ? blob : new Blob([blob], { type: 'audio/mp3' });
                 textToSummarize = await transcribeAudio(audioBlob);
                 setInputText(textToSummarize);
                 setInputMode('text');
              }
            } catch (e: any) {
              console.warn("Direct fetch failed, falling back to Gemini URL processing", e);
              // Fallback: If CORS or other network issues, pass the URL to Gemini
              setStatus('Direct access restricted. Attempting analysis via Gemini Search...');
              textToSummarize = inputUrl;
            }
        }
      }

      if (!textToSummarize) {
        throw new Error("Please provide content to summarize");
      }

      setStatus('Analyzing & Summarizing (checking sources)...');
      const result = await summarizeLecture(textToSummarize, preferences);
      setSummary(result);
      
      // Auto-suggest title if new
      if (!currentProjectId) {
        setProjectTitle(`Lecture Summary - ${new Date().toLocaleString()}`);
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred while processing your request.");
    } finally {
      setIsLoading(false);
      setStatus('');
    }
  };

  const handleSave = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    if (!summary || !inputText) return;

    setIsSaving(true);
    try {
      const project: Project = {
        id: currentProjectId || crypto.randomUUID(),
        userId: user.id,
        title: projectTitle || 'Untitled Lecture',
        createdAt: Date.now(),
        transcript: inputText,
        summary: summary,
      };
      
      StorageService.saveProject(project);
      setCurrentProjectId(project.id);
      
      // Update User preferences if changed in UI
      if (user.preferences.transliterationScheme !== preferences.transliterationScheme || 
          user.preferences.includeLiteralTranslation !== preferences.includeLiteralTranslation) {
          StorageService.updatePreferences(user.id, preferences);
      }

      // Fake delay for UX
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      console.error(e);
      setError('Failed to save project');
    } finally {
      setIsSaving(false);
    }
  };

  const prepareAudio = async () => {
    if (!summary) return;
    try {
      setIsGeneratingAudio(true);
      const base64Audio = await generateTTS(summary.summary_medium);
      
      // Convert PCM base64 to WAV Blob URL
      const pcmData = decode(base64Audio);
      const wavBlob = pcmToWav(pcmData, 24000); // Gemini usually returns 24k
      const url = URL.createObjectURL(wavBlob);
      
      setAudioUrl(url);
    } catch (e) {
      console.error(e);
      setError("Failed to generate audio.");
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const toggleScheme = () => {
    setPreferences(prev => ({
      ...prev,
      transliterationScheme: prev.transliterationScheme === 'ISO' ? 'Buckwalter' : 'ISO'
    }));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
      {/* Input Section */}
      <div className="flex flex-col space-y-6">
        <div id="summarizer-input-container" className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-emerald-900 flex items-center gap-2">
              <Upload className="w-5 h-5" /> Input Source
            </h2>
            <button 
               onClick={() => setShowSettings(!showSettings)}
               className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-slate-100 text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
               title="Preferences"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>

          {showSettings && (
             <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200 animate-in fade-in slide-in-from-top-2">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Transliteration Settings</h3>
                <div className="space-y-3">
                   <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Scheme: <span className="font-medium text-emerald-700">{preferences.transliterationScheme}</span></span>
                      <button onClick={toggleScheme} className="text-emerald-600 hover:text-emerald-700 text-xs font-medium px-3 py-1 bg-white border border-emerald-200 rounded-md shadow-sm">
                         Switch to {preferences.transliterationScheme === 'ISO' ? 'Buckwalter' : 'ISO'}
                      </button>
                   </div>
                   <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Include Literal Translation</span>
                      <button 
                        onClick={() => setPreferences(p => ({...p, includeLiteralTranslation: !p.includeLiteralTranslation}))}
                        className="text-emerald-600 transition-colors"
                      >
                        {preferences.includeLiteralTranslation ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8 text-slate-300" />}
                      </button>
                   </div>
                </div>
             </div>
          )}

          {/* Tabs */}
          <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg mb-4">
            <button 
              onClick={() => { setInputMode('text'); setError(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${inputMode === 'text' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <AlignLeft className="w-4 h-4" /> Text
            </button>
            <button 
              onClick={() => { setInputMode('file'); setError(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${inputMode === 'file' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <FileAudio className="w-4 h-4" /> File
            </button>
            <button 
              onClick={() => { setInputMode('url'); setError(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${inputMode === 'url' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Link className="w-4 h-4" /> URL
            </button>
          </div>
          
          {/* Input Areas */}
          <div className="space-y-4">
             {error && (
               <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-800 text-sm">
                 <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                 <span>{error}</span>
               </div>
             )}

             {inputMode === 'file' && (
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-emerald-500 transition-colors cursor-pointer relative bg-slate-50/50">
                    <input 
                      type="file" 
                      accept="audio/*" 
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="text-slate-500 flex flex-col items-center gap-2">
                      <Upload className="w-8 h-8 text-slate-400 mb-2" />
                      {file ? (
                        <span className="text-emerald-600 font-medium break-all">{file.name}</span>
                      ) : (
                        <>
                           <span className="font-medium text-slate-700">Click to upload audio</span>
                           <span className="text-xs text-slate-400">MP3, WAV, M4A supported</span>
                        </>
                      )}
                    </div>
                </div>
             )}
             
             {inputMode === 'url' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Content URL</label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                    <input 
                       type="url"
                       value={inputUrl}
                       onChange={(e) => { setInputUrl(e.target.value); setError(null); }}
                       placeholder="https://example.com/lecture.mp3"
                       className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    Supports YouTube links and direct Audio files. (YouTube processing uses Transcript API or Gemini Grounding).
                  </p>
                </div>
             )}

             {inputMode === 'text' && (
                 <div className="relative">
                    {inputText && (
                      <div className="mb-2">
                        <input 
                           type="text" 
                           value={projectTitle} 
                           onChange={(e) => setProjectTitle(e.target.value)}
                           placeholder="Project Title"
                           className="text-sm font-medium text-slate-700 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-500 outline-none w-full py-1"
                        />
                      </div>
                    )}
                    <textarea
                      className="w-full h-64 p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none text-sm leading-relaxed font-mono text-slate-600"
                      placeholder="Paste lecture transcript here..."
                      value={inputText}
                      onChange={(e) => { setInputText(e.target.value); setError(null); }}
                    />
                 </div>
             )}

             <div className="flex gap-3 pt-2">
               <button
                  id="summarizer-generate-btn"
                  onClick={handleProcess}
                  disabled={isLoading || (inputMode === 'text' && !inputText) || (inputMode === 'file' && !file) || (inputMode === 'url' && !inputUrl)}
                  className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white font-medium py-3 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
               >
                  {isLoading ? <Loader2 className="animate-spin" /> : <FileText className="w-5 h-5" />}
                  {isLoading ? status : 'Generate Summary'}
               </button>
               
               {summary && (
                 <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    title="Save Project"
                 >
                    {isSaving ? <Loader2 className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
                 </button>
               )}
             </div>
          </div>
        </div>
      </div>

      {/* Output Section */}
      <div className="flex flex-col space-y-6 overflow-y-auto">
        {!summary ? (
          <div className="flex items-center justify-center h-full text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 min-h-[400px]">
             <div className="text-center">
               <FileText className="w-12 h-12 mx-auto text-slate-300 mb-2" />
               <p>Summary results will appear here</p>
             </div>
          </div>
        ) : (
          <>
            {/* Summary Card */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-amber-100">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-serif text-emerald-900">Executive Summary</h2>
                
                {!audioUrl ? (
                  <button 
                    onClick={prepareAudio}
                    disabled={isGeneratingAudio}
                    className="text-emerald-600 hover:bg-emerald-50 px-3 py-1.5 rounded-full transition-colors flex items-center gap-2 text-sm font-medium border border-transparent hover:border-emerald-100"
                    title="Generate Audio Summary"
                  >
                    {isGeneratingAudio ? <Loader2 className="animate-spin w-4 h-4" /> : <Play className="w-4 h-4" />}
                    Listen
                  </button>
                ) : null}
              </div>
              
              {audioUrl && (
                <div className="mb-4 animate-in fade-in slide-in-from-top-2">
                  <AudioPlayer src={audioUrl} title={projectTitle} />
                </div>
              )}

              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                {summary.summary_medium}
              </p>
            </div>

            {/* Transliterations */}
            {summary.transliterations.length > 0 && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Key Terminology</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {summary.transliterations.map((t, i) => (
                    <div key={i} className="bg-white p-3 rounded border border-slate-100">
                      <div className="font-arabic text-emerald-800 text-lg text-right">{t.original}</div>
                      <div className="text-slate-800 font-medium text-sm">{t.translit}</div>
                      <div className="text-slate-500 text-xs italic">{t.translation}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Claims & Verification */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" /> Fact Check & Sources
              </h3>
              {summary.claims.map((claim) => (
                <div key={claim.id} className={`p-4 rounded-lg border ${claim.flagged ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-100'}`}>
                  <div className="flex justify-between">
                    <p className="text-slate-800 font-medium">{claim.text}</p>
                    <span className={`text-xs font-bold px-2 py-1 rounded h-fit ${claim.flagged ? 'bg-red-200 text-red-800' : 'bg-emerald-200 text-emerald-800'}`}>
                      {Math.round(claim.confidence)}% Conf.
                    </span>
                  </div>
                  {claim.flagged && (
                    <div className="mt-2 flex items-start gap-2 text-red-700 text-sm">
                      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <p>{claim.notes || "Flagged for potential contradiction or uncertainty."}</p>
                    </div>
                  )}
                  {claim.sources && claim.sources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-emerald-100/50">
                      <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><Globe className="w-3 h-3"/> Verified Sources:</p>
                      <ul className="space-y-1">
                        {claim.sources.map((source, idx) => (
                          <li key={idx}>
                            <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate block max-w-md">
                              {source.title || source.uri}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
