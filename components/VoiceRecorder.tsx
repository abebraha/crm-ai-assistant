'use client';

import { useState, useRef, useCallback } from 'react';
import { Mic, Square } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  onRecorded: (blob: Blob) => void;
  disabled?: boolean;
}

export default function VoiceRecorder({ onRecorded, disabled }: Props) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(async () => {
    if (disabled) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        onRecorded(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start(200);
      mediaRef.current = mr;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      alert('Microphone access denied. Please allow microphone access and try again.');
    }
  }, [disabled, onRecorded]);

  const stop = useCallback(() => {
    mediaRef.current?.stop();
    mediaRef.current = null;
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }, []);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-2">
      {recording && (
        <span className="text-xs text-red-500 font-mono font-semibold tabular-nums select-none">
          {fmt(seconds)}
        </span>
      )}
      <button
        onClick={recording ? stop : start}
        disabled={disabled}
        title={recording ? 'Stop recording' : 'Record voice note'}
        className={clsx(
          'relative flex items-center justify-center w-9 h-9 rounded-full transition-all duration-200 disabled:opacity-40',
          recording
            ? 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-200'
            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
        )}
      >
        {recording && (
          <span className="absolute inset-0 rounded-full bg-red-400 animate-ping-slow opacity-40" />
        )}
        {recording
          ? <Square className="w-4 h-4 fill-current" />
          : <Mic className="w-4 h-4" />}
      </button>
    </div>
  );
}