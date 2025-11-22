import React, { useState, useRef, useEffect } from 'react';
import { connectLiveSession } from '../services/gemini';
import { LiveServerMessage } from '@google/genai';
import { createPCM16Blob, decodeAudioData, decode } from '../services/audioUtils';
import { Mic, MicOff, Radio, Volume2 } from 'lucide-react';

export const LiveConversation: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false); // User is speaking
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false); // Agent is speaking

  // Refs for audio processing
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const sessionRef = useRef<Promise<any> | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const stopEverything = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    // Close Gemini session if possible (the SDK wraps the ws, we usually just let it drop or send close)
    // Current SDK pattern doesn't expose explicit abort on the promise easily without signal, 
    // but dropping references cleans up mostly.
    
    setIsConnected(false);
    setIsSpeaking(false);
    setIsAgentSpeaking(false);
    nextStartTimeRef.current = 0;
    sourcesRef.current.forEach(s => s.stop());
    sourcesRef.current.clear();
  };

  const startSession = async () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass({ sampleRate: 16000 }); // Input 16k
      const outputContext = new AudioContextClass({ sampleRate: 24000 }); // Output 24k default for Live

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // Initialize Gemini Session
      sessionRef.current = connectLiveSession({
        onOpen: () => {
          console.log("Live Session Opened");
          setIsConnected(true);
          
          // Setup Audio Input Pipeline
          if (!audioContextRef.current) return;
          
          sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
          processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
          
          processorRef.current.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            // Simple volume check for UI visualization
            const sum = inputData.reduce((a, b) => a + Math.abs(b), 0);
            setIsSpeaking(sum > 10); // Threshold

            const pcmBlob = createPCM16Blob(inputData);
            
            sessionRef.current?.then(session => {
              session.sendRealtimeInput({ media: pcmBlob });
            });
          };

          sourceRef.current.connect(processorRef.current);
          processorRef.current.connect(audioContextRef.current.destination);
        },
        onMessage: async (msg: LiveServerMessage) => {
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
                setIsAgentSpeaking(true);
                const audioBuffer = await decodeAudioData(
                    decode(audioData),
                    outputContext,
                    24000,
                    1
                );
                
                const source = outputContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputContext.destination);
                
                // Schedule playback
                const currentTime = outputContext.currentTime;
                if (nextStartTimeRef.current < currentTime) {
                    nextStartTimeRef.current = currentTime;
                }
                
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                
                sourcesRef.current.add(source);
                source.onended = () => {
                    sourcesRef.current.delete(source);
                    if (sourcesRef.current.size === 0) setIsAgentSpeaking(false);
                };
            }

            if (msg.serverContent?.interrupted) {
                sourcesRef.current.forEach(s => s.stop());
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
                setIsAgentSpeaking(false);
            }
        },
        onClose: () => {
            console.log("Session Closed");
            stopEverything();
        },
        onError: (err) => {
            console.error("Session Error", err);
            stopEverything();
        }
      });

    } catch (e) {
      console.error("Failed to start session", e);
      alert("Could not access microphone or connect to API.");
    }
  };

  useEffect(() => {
    return () => {
      stopEverything();
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-12">
        <div className="space-y-4">
            <h2 className="text-3xl font-serif text-emerald-900">Conversational Knowledge</h2>
            <p className="text-slate-600 max-w-md mx-auto">
                Speak directly with BayanAI to ask questions, clarify summaries, or discuss topics in real-time.
            </p>
        </div>

        <div className="relative">
            {/* Visualizer Rings */}
            {(isSpeaking || isAgentSpeaking) && (
                <>
                    <div className={`absolute inset-0 rounded-full animate-ping opacity-20 ${isAgentSpeaking ? 'bg-amber-400' : 'bg-emerald-400'}`}></div>
                    <div className={`absolute -inset-4 rounded-full animate-pulse opacity-10 ${isAgentSpeaking ? 'bg-amber-400' : 'bg-emerald-400'}`}></div>
                </>
            )}
            
            <button
                onClick={isConnected ? stopEverything : startSession}
                className={`relative z-10 w-32 h-32 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ${
                    isConnected 
                    ? 'bg-red-50 text-red-600 hover:bg-red-100 border-4 border-red-200' 
                    : 'bg-emerald-600 text-white hover:bg-emerald-700 hover:scale-105 border-4 border-emerald-200'
                }`}
            >
                {isConnected ? (
                    <MicOff className="w-12 h-12" />
                ) : (
                    <Mic className="w-12 h-12" />
                )}
            </button>
        </div>

        <div className="h-12 flex items-center gap-3 text-sm font-medium text-slate-500">
            {isConnected ? (
                <>
                    {isAgentSpeaking ? (
                        <span className="flex items-center gap-2 text-amber-600 animate-pulse">
                            <Volume2 className="w-4 h-4" /> BayanAI is speaking...
                        </span>
                    ) : isSpeaking ? (
                        <span className="flex items-center gap-2 text-emerald-600">
                            <Radio className="w-4 h-4 animate-pulse" /> Listening to you...
                        </span>
                    ) : (
                        <span>Connected. Listening...</span>
                    )}
                </>
            ) : (
                <span>Tap microphone to start</span>
            )}
        </div>
    </div>
  );
};