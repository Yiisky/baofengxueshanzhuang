/**
 * ============================================================
 * 【文件名称】useWebSocket.ts
 * 【文件作用】WebSocket连接管理Hook
 * ============================================================
 */

import { useEffect, useRef, useState, useCallback } from 'react';

// ============================================================
// 【全局单例】确保只有一个 WebSocket 连接
// ============================================================
let globalWs: WebSocket | null = null;
let globalUrl: string = '';
let globalListeners: ((message: any) => void)[] = [];

const HEARTBEAT_INTERVAL = 30000;
const RECONNECT_INTERVAL = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export interface UseWebSocketReturn {
  isConnected: boolean;
  sendMessage: (message: WebSocketMessage) => void;
  lastMessage: WebSocketMessage | null;
  error: string | null;
  reconnect: () => void;
}

export function useWebSocket(url: string): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const wsRef = useRef<WebSocket | null>(globalWs);
  const reconnectAttemptsRef = useRef(0);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isManualCloseRef = useRef(false);
  const listenerRef = useRef<((message: any) => void) | null>(null);
  
  // 新增：标记是否是主持人重连
  const isHostReconnectRef = useRef(false);
  
  // 检查是否是主持人
  const checkIsHost = useCallback(() => {
    try {
      const savedIsHost = localStorage.getItem('isHost') === 'true';
      const savedHostId = localStorage.getItem('hostPlayerId');
      return savedIsHost && !!savedHostId;
    } catch (e) {
      return false;
    }
  }, []);

  const clearTimers = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    const ws = globalWs || wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
      console.log('[WebSocket] 发送:', message.type);
    } else {
      console.warn('[WebSocket] 未连接，无法发送消息');
      setError('未连接到服务器');
    }
  }, []);

  const connect = useCallback(() => {
    // 如果全局连接已存在且 URL 相同，直接使用
    if (globalWs && globalUrl === url && 
        (globalWs.readyState === WebSocket.OPEN || globalWs.readyState === WebSocket.CONNECTING)) {
      console.log('[WebSocket] 使用已有连接:', url);
      wsRef.current = globalWs;
      setIsConnected(globalWs.readyState === WebSocket.OPEN);
      
      // 关键修复：如果已经连接，立即检查是否需要重连
      if (globalWs.readyState === WebSocket.OPEN && checkIsHost() && !isHostReconnectRef.current) {
        console.log('[WebSocket] 检测到主持人且连接已打开，自动发送重连');
        isHostReconnectRef.current = true;
        const savedRoomCode = localStorage.getItem('roomCode');
        const savedHostId = localStorage.getItem('hostPlayerId');
        if (savedRoomCode && savedHostId) {
          setTimeout(() => {
            sendMessage({ 
              type: 'RECONNECT_HOST', 
              roomCode: savedRoomCode, 
              hostPlayerId: savedHostId 
            });
          }, 300);
        }
      }
      
      return;
    }

    // 如果 URL 不同，关闭旧连接
    if (globalWs && globalUrl !== url) {
      globalWs.close();
      globalWs = null;
    }

    console.log('[WebSocket] 创建新连接:', url);
    setError(null);
    
    // 重置主持人重连标记
    isHostReconnectRef.current = false;

    try {
      const ws = new WebSocket(url);
      globalWs = ws;
      globalUrl = url;
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WebSocket] 连接成功');
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;

        // 关键修复：连接成功后，立即从 localStorage 恢复 playerId 并发送重连
        const savedRoomCode = localStorage.getItem('roomCode');
        const savedPlayerId = localStorage.getItem('myPlayerId');
        const savedHostId = localStorage.getItem('hostPlayerId');
        const savedIsHost = localStorage.getItem('isHost') === 'true';
        
        console.log('[WebSocket] 连接成功，检查本地存储:', { 
          savedRoomCode, 
          savedPlayerId: savedPlayerId?.slice(0,6), 
          savedHostId: savedHostId?.slice(0,6),
          savedIsHost 
        });

        // 如果是主持人，立即发送重连消息
        if (savedIsHost && savedHostId && savedRoomCode) {
          console.log('[WebSocket] 检测到主持人，发送重连');
          isHostReconnectRef.current = true;
          setTimeout(() => {
            sendMessage({ 
              type: 'RECONNECT_HOST', 
              roomCode: savedRoomCode, 
              hostPlayerId: savedHostId 
            });
          }, 300);
        } 
        // 如果是普通玩家，发送 JOIN_ROOM 重连
        else if (savedRoomCode && savedPlayerId) {
          console.log('[WebSocket] 检测到普通玩家，发送重连');
          setTimeout(() => {
            sendMessage({
              type: 'JOIN_ROOM',
              roomCode: savedRoomCode,
              playerId: savedPlayerId,
              isReconnect: true
            });
          }, 300);
        }

        heartbeatTimerRef.current = setInterval(() => {
          sendMessage({ type: 'PING' });
        }, HEARTBEAT_INTERVAL);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('[WebSocket] 收到:', message.type);
          setLastMessage(message);
          // 通知所有监听器
          globalListeners.forEach(listener => listener(message));
        } catch (err) {
          console.error('[WebSocket] 消息解析失败:', err);
        }
      };

      ws.onclose = (event) => {
        console.log('[WebSocket] 连接关闭:', event.code, event.reason);
        setIsConnected(false);
        clearTimers();

        if (!isManualCloseRef.current && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current++;
          console.log(`[WebSocket] ${RECONNECT_INTERVAL}ms后重连... (尝试 ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);
          
          reconnectTimerRef.current = setTimeout(() => {
            connect();
          }, RECONNECT_INTERVAL);
        } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          setError('连接失败，请检查服务器地址');
        }
      };

      ws.onerror = (error) => {
        console.error('[WebSocket] 连接错误:', error);
        setError('连接错误');
      };

    } catch (err) {
      console.error('[WebSocket] 创建连接失败:', err);
      setError('创建连接失败');
    }
  }, [url, sendMessage, clearTimers, checkIsHost]);

  const reconnect = useCallback(() => {
    console.log('[WebSocket] 手动重连');
    isManualCloseRef.current = false;
    reconnectAttemptsRef.current = 0;
    
    if (globalWs) {
      globalWs.close();
      globalWs = null;
    }
    
    clearTimers();
    connect();
  }, [connect, clearTimers]);

  useEffect(() => {
    // 添加消息监听器
    listenerRef.current = (message) => {
      setLastMessage(message);
    };
    globalListeners.push(listenerRef.current);

    // 连接（如果还没有连接）
    if (!globalWs || globalWs.readyState === WebSocket.CLOSED) {
      connect();
    } else {
      // 使用已有连接
      wsRef.current = globalWs;
      setIsConnected(globalWs.readyState === WebSocket.OPEN);
    }

    return () => {
      // 移除监听器，但不关闭连接
      if (listenerRef.current) {
        globalListeners = globalListeners.filter(l => l !== listenerRef.current);
      }
    };
  }, [url, connect]);

  return {
    isConnected,
    sendMessage,
    lastMessage,
    error,
    reconnect
  };
}
