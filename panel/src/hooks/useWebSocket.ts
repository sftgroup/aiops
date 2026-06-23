import { useEffect, useRef, useCallback, useState } from 'react';
import { getToken as getMemToken } from '../token';

// ── Types ──

export interface UseWebSocketOptions {
  wsUrl?: string;
  onProgress?: (data: { taskId: string; step: string; status: string; errorMsg?: string; employee?: string; [key: string]: unknown }) => void;
  onVideoReady?: (data: { taskId: string; videoId: string; videoUrl: string }) => void;
  onAuthError?: () => void;
  onConnectionChange?: (connected: boolean) => void;
}

export interface UseWebSocketReturn {
  readyState: number;
  isAuthenticated: boolean;
  connectionError: string | null;
  send: (data: object) => void;
}

// ── Constants ──

const WS_DEV_URL = 'ws://localhost:5289/ws';
const WS_PROD_URL = 'wss://0xainet.top/aiops/ws';
const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

// ── Helpers ──

function getWsUrl(): string {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return WS_DEV_URL;
  }
  return WS_PROD_URL;
}

function getToken(): string | null {
  return getMemToken();
}

/**
 * useWebSocket — unified WebSocket connection management hook.
 *
 * Connection management:
 *  - Auto-connects on mount (dev: ws://localhost:5289/ws, prod: wss://0xainet.top/aiops/ws)
 *  - Sends { type: "auth", token } on open, waits for auth_ok
 *  - Closes cleanly on unmount
 *
 * Reconnection:
 *  - Initial failure: exponential backoff 1s→2s→4s→8s→max 30s, max 10 attempts
 *  - Runtime disconnect: immediate retry, then exponential backoff if it also fails
 *  - Auth error: no reconnect, reports via onAuthError
 *  - visibilitychange → visible: reconnect immediately if disconnected
 */
export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const { wsUrl: customWsUrl, onProgress, onVideoReady, onAuthError, onConnectionChange } = options;

  const [readyState, setReadyState] = useState<number>(WebSocket.CONNECTING);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // ── Mutable refs to avoid stale closures ──

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const intentionalCloseRef = useRef(false);
  const hasConnectedOnceRef = useRef(false);
  // Track that we already attempted an immediate reconnect after runtime disconnect.
  // Reset when open succeeds or when entering backoff mode.
  const immediateReconnectTriedRef = useRef(false);
  // Store setupHandlers by ref so the reconnect path can invoke it on the new socket
  const setupHandlersRef = useRef<(ws: WebSocket) => void>(() => {});

  // Callback refs (updated each render to avoid stale closures in event handlers)
  const onProgressRef = useRef(onProgress);
  const onVideoReadyRef = useRef(onVideoReady);
  const onAuthErrorRef = useRef(onAuthError);
  const onConnectionChangeRef = useRef(onConnectionChange);
  onProgressRef.current = onProgress;
  onVideoReadyRef.current = onVideoReady;
  onAuthErrorRef.current = onAuthError;
  onConnectionChangeRef.current = onConnectionChange;

  // ── Helper: clear pending reconnect timer ──

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  // ── Helper: create a new WebSocket, update state for CONNECTING, return the instance ──

  const openSocket = useCallback((): WebSocket | null => {
    const token = getToken();
    if (!token) {
      setConnectionError('connection_failed');
      setReadyState(WebSocket.CLOSED);
      return null;
    }
    setReadyState(WebSocket.CONNECTING);
    setConnectionError(null);
    const url = customWsUrl || getWsUrl();
    return new WebSocket(url);
  }, [customWsUrl]);

  // ── WebSocket event handlers (shared between initial connect and reconnect) ──

  const setupHandlers = useCallback((ws: WebSocket) => {
    ws.onopen = () => {
      if (!mountedRef.current) {
        ws.close();
        return;
      }
      setReadyState(WebSocket.OPEN);
      hasConnectedOnceRef.current = true;
      immediateReconnectTriedRef.current = false;
      reconnectAttemptRef.current = 0;
      onConnectionChangeRef.current?.(true);

      // Send auth immediately after connection opens
      const token = getToken();
      if (token) {
        ws.send(JSON.stringify({ type: 'auth', token }));
      }
    };

    ws.onmessage = (event: MessageEvent) => {
      if (!mountedRef.current) return;

      try {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case 'auth_ok':
            setIsAuthenticated(true);
            setConnectionError(null);
            break;

          case 'auth_error':
            setConnectionError('auth_error');
            setIsAuthenticated(false);
            // Auth failure — close and do NOT reconnect
            intentionalCloseRef.current = true;
            ws.close();
            wsRef.current = null;
            setReadyState(WebSocket.CLOSED);
            onConnectionChangeRef.current?.(false);
            onAuthErrorRef.current?.();
            break;

          case 'progress':
          case 'team_progress':
            onProgressRef.current?.({
              taskId: data.taskId,
              step: data.employee || data.step,
              status: data.status,
            });
            break;

          case 'video_ready':
            onVideoReadyRef.current?.({
              taskId: data.taskId,
              videoId: data.videoId,
              videoUrl: data.videoUrl,
            });
            break;

          default:
            // Unknown message types are silently ignored
            break;
        }
      } catch {
        // Non-JSON messages are silently ignored
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;

      setReadyState(WebSocket.CLOSED);
      onConnectionChangeRef.current?.(false);

      if (intentionalCloseRef.current) {
        // Auth error or manual close — do not reconnect
        intentionalCloseRef.current = false;
        return;
      }

      if (hasConnectedOnceRef.current && !immediateReconnectTriedRef.current) {
        // ⚡ Runtime disconnect: immediately retry once (no delay)
        immediateReconnectTriedRef.current = true;
        // Reset attempt counter — this isn't a "regular" failed attempt
        reconnectAttemptRef.current = 0;
        const nextWs = openSocket();
        if (nextWs) {
          wsRef.current = nextWs;
          setupHandlersRef.current(nextWs);
        }
        return;
      }

      // 💤 Enter exponential backoff
      scheduleReconnectRef.current();
    };

    ws.onerror = () => {
      // onclose fires immediately after onerror; reconnect logic lives there
    };
  }, [openSocket]);

  setupHandlersRef.current = setupHandlers;

  // ── Reconnect scheduler (exponential backoff) ──

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return;

    // Reset the immediate-reconnect flag: next disconnect will try immediate again
    immediateReconnectTriedRef.current = false;

    if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setConnectionError('connection_failed');
      setReadyState(WebSocket.CLOSED);
      return;
    }

    const delay = Math.min(
      INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptRef.current),
      MAX_RECONNECT_DELAY
    );

    reconnectTimerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      reconnectAttemptRef.current++;
      const ws = openSocket();
      if (ws) {
        wsRef.current = ws;
        setupHandlers(ws);
      }
    }, delay);
  }, [openSocket, setupHandlers]);

  // Keep a mutable ref so event handlers can call scheduleReconnect without stale closures
  const scheduleReconnectRef = useRef(scheduleReconnect);
  scheduleReconnectRef.current = scheduleReconnect;

  // ── Public send function ──

  const send = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  // ── Visibility change handler ──

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && mountedRef.current) {
        const ws = wsRef.current;
        if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
          // Tab became visible and WS is disconnected — reconnect immediately
          clearReconnectTimer();
          immediateReconnectTriedRef.current = false;
          reconnectAttemptRef.current = 0;
          const nextWs = openSocket();
          if (nextWs) {
            wsRef.current = nextWs;
            setupHandlers(nextWs);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [clearReconnectTimer, openSocket, setupHandlers]);

  // ── Lifecycle ──

  useEffect(() => {
    mountedRef.current = true;
    reconnectAttemptRef.current = 0;
    hasConnectedOnceRef.current = false;
    immediateReconnectTriedRef.current = false;

    const ws = openSocket();
    if (ws) {
      wsRef.current = ws;
      setupHandlers(ws);
    }

    return () => {
      mountedRef.current = false;
      intentionalCloseRef.current = true;
      clearReconnectTimer();
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [clearReconnectTimer, openSocket, setupHandlers]);

  return {
    readyState,
    isAuthenticated,
    connectionError,
    send,
  };
}
