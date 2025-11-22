import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, Download, Volume2, VolumeX, Volume1 } from 'lucide-react';

interface AudioPlayerProps {
  src: string;
  title?: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, title }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (audioRef.current) {
      // Reset state when src changes
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      audioRef.current.load();
      audioRef.current.volume = volume;
      audioRef.current.muted = isMuted;
    }
  }, [src]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const onTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const onLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const onEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
        audioRef.current.currentTime = 0;
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
    if (newVolume > 0 && isMuted) {
      setIsMuted(false);
      if (audioRef.current) audioRef.current.muted = false;
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      audioRef.current.muted = newMuted;
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = src;
    link.download = `${title || 'bayan-audio-summary'}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getVolumeIcon = () => {
    if (isMuted || volume === 0) return <VolumeX className="w-4 h-4" />;
    if (volume < 0.5) return <Volume1 className="w-4 h-4" />;
    return <Volume2 className="w-4 h-4" />;
  };

  return (
    <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 shadow-sm select-none">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onEnded={onEnded}
        className="hidden"
      />
      
      <div className="flex items-center justify-between mb-3">
         <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-2">
            {getVolumeIcon()} Audio Summary
         </h4>
         <button 
            onClick={handleDownload}
            className="text-emerald-600 hover:text-emerald-800 px-2 py-1 rounded hover:bg-emerald-100 transition-colors flex items-center gap-1 text-xs font-medium"
            title="Download Audio"
         >
             <Download className="w-3 h-3" /> Save WAV
         </button>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-emerald-600 text-white hover:bg-emerald-700 shadow transition-all flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-emerald-500"
        >
          {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
        </button>
        
        <button 
            onClick={() => {
                if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
            }}
            className="text-emerald-500 hover:text-emerald-700 p-1.5 hover:bg-emerald-100 rounded-full transition-colors"
            title="Rewind 10s"
        >
            <RotateCcw className="w-4 h-4" />
        </button>

        <div className="flex-1 space-y-1 min-w-0">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 bg-emerald-200 rounded-lg appearance-none cursor-pointer accent-emerald-600 hover:accent-emerald-700"
          />
          <div className="flex justify-between text-[10px] text-emerald-700 font-medium font-mono tracking-tight">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 group pl-2 border-l border-emerald-200">
            <button 
                onClick={toggleMute} 
                className="text-emerald-500 hover:text-emerald-700 p-1 rounded-full hover:bg-emerald-100 transition-colors"
                title={isMuted ? "Unmute" : "Mute"}
            >
                {getVolumeIcon()}
            </button>
            <div className="w-0 overflow-hidden group-hover:w-16 transition-all duration-300 ease-out">
                <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.05" 
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-16 h-1 bg-emerald-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                />
            </div>
        </div>
      </div>
    </div>
  );
};