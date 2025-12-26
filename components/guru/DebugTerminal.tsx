'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface LogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'success' | 'debug';
  source: string;
  message: string;
  data?: unknown;
}

interface DebugTerminalProps {
  logs: LogEntry[];
  maxHeight?: string;
  title?: string;
  onClear?: () => void;
}

const levelColors: Record<LogEntry['level'], string> = {
  info: 'text-blue-400',
  warn: 'text-yellow-400',
  error: 'text-red-400',
  success: 'text-green-400',
  debug: 'text-gray-400',
};

const levelIcons: Record<LogEntry['level'], string> = {
  info: 'ℹ️',
  warn: '⚠️',
  error: '❌',
  success: '✅',
  debug: '🔍',
};

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }) + '.' + date.getMilliseconds().toString().padStart(3, '0');
}

export function DebugTerminal({
  logs,
  maxHeight = '200px',
  title = 'Debug Terminal',
  onClear,
}: DebugTerminalProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollRef.current && isExpanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isExpanded]);

  const copyToClipboard = () => {
    const text = logs
      .map((log) => {
        const dataStr = log.data ? ` | ${JSON.stringify(log.data)}` : '';
        return `[${formatTimestamp(log.timestamp)}] [${log.level.toUpperCase()}] [${log.source}] ${log.message}${dataStr}`;
      })
      .join('\n');
    navigator.clipboard.writeText(text);
  };

  if (logs.length === 0) {
    return null; // Don't show empty terminal
  }

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden font-mono text-xs">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-gray-300 hover:text-white"
        >
          <span className="text-green-400">●</span>
          <span>{title}</span>
          <span className="text-gray-500">({logs.length} entries)</span>
          <span className="ml-1">{isExpanded ? '▼' : '▶'}</span>
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={copyToClipboard}
            className="px-2 py-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
            title="Copy all logs"
          >
            📋 Copy
          </button>
          {onClear && (
            <button
              onClick={onClear}
              className="px-2 py-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
              title="Clear logs"
            >
              🗑️ Clear
            </button>
          )}
        </div>
      </div>

      {/* Log entries */}
      {isExpanded && (
        <div
          ref={scrollRef}
          className="overflow-auto p-2 space-y-1"
          style={{ maxHeight }}
        >
          {logs.map((log, index) => (
            <div key={index} className="mb-1">
              <div
                className={`flex items-start gap-2 hover:bg-gray-800 rounded px-1 cursor-pointer ${
                  selectedLog === log ? 'bg-gray-800' : ''
                }`}
                onClick={() => setSelectedLog(selectedLog === log ? null : log)}
              >
                <span className="text-gray-500 whitespace-nowrap">
                  {formatTimestamp(log.timestamp)}
                </span>
                <span>{levelIcons[log.level]}</span>
                <span className="text-purple-400 whitespace-nowrap">
                  [{log.source}]
                </span>
                <span className={levelColors[log.level]}>{log.message}</span>
                {log.data !== undefined && log.data !== null && (
                  <span className="text-gray-500 ml-auto">
                    {selectedLog === log ? '▼' : '▶'}
                  </span>
                )}
              </div>
              {/* Expanded data view - directly under clicked log */}
              {selectedLog === log && log.data !== undefined && log.data !== null && (
                <div className="mt-1 ml-8 p-2 bg-gray-800 rounded border border-gray-700">
                  <pre className="text-gray-300 whitespace-pre-wrap overflow-x-auto text-xs">
                    {JSON.stringify(log.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Hook for managing debug logs
export function useDebugLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = useCallback(
    (
      level: LogEntry['level'],
      source: string,
      message: string,
      data?: unknown
    ) => {
      setLogs((prev) => [
        ...prev,
        {
          timestamp: new Date(),
          level,
          source,
          message,
          data,
        },
      ]);
    },
    []
  );

  const log = useMemo(
    () => ({
      info: (source: string, message: string, data?: unknown) =>
        addLog('info', source, message, data),
      warn: (source: string, message: string, data?: unknown) =>
        addLog('warn', source, message, data),
      error: (source: string, message: string, data?: unknown) =>
        addLog('error', source, message, data),
      success: (source: string, message: string, data?: unknown) =>
        addLog('success', source, message, data),
      debug: (source: string, message: string, data?: unknown) =>
        addLog('debug', source, message, data),
    }),
    [addLog]
  );

  const clearLogs = useCallback(() => setLogs([]), []);

  return { logs, log, clearLogs };
}
