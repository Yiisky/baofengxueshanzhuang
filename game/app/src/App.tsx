/**
 * ============================================
 * 暴风雪山庄游戏系统 - 主入口文件
 * ============================================
 */

import { useState, useEffect, useCallback } from 'react';
import { useWebSocketStore } from '@/store/websocketStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HostPanel } from '@/sections/HostPanel';
import { PlayerPanel } from '@/sections/PlayerPanel';
import './App.css';

function App() {
  const { createGame, joinGame, roomCode, isConnected, connectionError, reconnect } = useWebSocketStore();
  
  const [userType, setUserType] = useState<'host' | 'player' | null>(null);
  const [showRoleSelect, setShowRoleSelect] = useState(true);
  const [inputRoomCode, setInputRoomCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [appError, setAppError] = useState('');
  const [isRestoringSession, setIsRestoringSession] = useState(false);

  // 页面加载时恢复会话
  useEffect(() => {
    const savedRoomCode = localStorage.getItem('roomCode');
    const savedPlayerId = localStorage.getItem('myPlayerId');
    const savedHostId = localStorage.getItem('hostId');
    
    if (savedRoomCode && savedPlayerId) {
      console.log('[App] 检测到保存的会话，正在恢复...', { savedRoomCode, savedPlayerId });
      setIsRestoringSession(true);
      
      const isUserHost = savedHostId === savedPlayerId;
      setUserType(isUserHost ? 'host' : 'player');
      setShowRoleSelect(false);
    }
  }, []);

  // 当 WebSocket 连接成功时，重新加入房间
  useEffect(() => {
    if (!isConnected || !isRestoringSession) return;
    
    const savedRoomCode = localStorage.getItem('roomCode');
    const savedPlayerId = localStorage.getItem('myPlayerId');
    
    if (savedRoomCode && savedPlayerId) {
      console.log('[App] WebSocket 已连接，重新加入房间:', savedRoomCode, 'playerId:', savedPlayerId);
      
      // 调用 joinGame 并传入 playerId，让服务器识别为断线重连
      const success = joinGame(savedRoomCode, savedPlayerId);
      
      if (!success) {
        console.error('[App] 重新加入房间失败');
        setAppError('重新连接失败，请手动刷新重试');
      }
      
      setIsRestoringSession(false);
    }
  }, [isConnected, joinGame, isRestoringSession]);

  // 监听 roomCode，如果恢复会话后 roomCode 仍为空，说明加入失败
useEffect(() => {
  if (isRestoringSession && !roomCode) {
    // 等待一段时间后检查
    const timer = setTimeout(() => {
      if (!roomCode) {
        console.log('[App] 恢复会话失败，roomCode 为空');
        setAppError('房间已过期，请重新创建或加入房间');
        setShowRoleSelect(true);
        setUserType(null);
        setIsRestoringSession(false);
      }
    }, 3000);
    
    return () => clearTimeout(timer);
  }
}, [isRestoringSession, roomCode]);

  useEffect(() => {
    if (appError) {
      const timer = setTimeout(() => setAppError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [appError]);

  const handleSelectRole = async (type: 'host' | 'player') => {
    setAppError('');
    
    if (!isConnected) {
      setAppError('正在连接服务器，请稍后再试...');
      return;
    }
    
    if (type === 'host') {
      setIsCreatingRoom(true);
      try {
        console.log('[App] 开始创建房间...');
        const newRoomCode = await createGame();
        console.log('[App] 房间创建结果:', newRoomCode);
        
        if (newRoomCode && newRoomCode.length > 0) {
          setUserType('host');
          setShowRoleSelect(false);
        } else {
          setAppError('创建房间失败，请检查服务器连接');
        }
      } catch (error) {
        console.error('[App] 创建房间失败:', error);
        setAppError('创建房间失败: ' + (error instanceof Error ? error.message : '未知错误'));
      } finally {
        setIsCreatingRoom(false);
      }
    } else {
      setUserType(type);
    }
  };

  const handleJoinGame = () => {
    setAppError('');
    
    if (!isConnected) {
      setJoinError('正在连接服务器，请稍后再试...');
      return;
    }
    
    // 验证4位数字房间码
    if (!inputRoomCode.trim()) {
      setJoinError('请输入房间号');
      return;
    }
    if (!/^\d{4}$/.test(inputRoomCode)) {
      setJoinError('房间号必须是4位数字');
      return;
    }
    
    try {
      // 新玩家加入，不传 playerId
      const success = joinGame(inputRoomCode);
      if (success) {
        setUserType('player');
        setShowRoleSelect(false);
        setJoinError('');
      } else {
        setJoinError('加入房间失败');
      }
    } catch (error) {
      console.error('[App] 加入房间失败:', error);
      setJoinError('加入房间失败: ' + (error instanceof Error ? error.message : '未知错误'));
    }
  };

  if (showRoleSelect) {
    return (
      <div 
        className="min-h-screen flex flex-col items-center justify-center p-6 relative"
        style={{
          backgroundImage: 'url(/images/main-bg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <div className="absolute inset-0 bg-black/60" />
        
        <div 
          className="relative z-10 w-full max-w-md p-8 rounded-xl"
          style={{
            background: 'rgba(26, 26, 26, 0.95)',
            border: '2px solid #d4a853',
            boxShadow: '0 0 30px rgba(212, 168, 83, 0.3)'
          }}
        >
          <h1 
            className="text-center text-4xl font-bold mb-2"
            style={{ 
              color: '#d4a853',
              textShadow: '0 0 20px rgba(212, 168, 83, 0.5)'
            }}
          >
            暴风雪山庄
          </h1>
          
          <p className="text-[#aaaaaa] text-center text-sm mb-8">
            《大侦探 第十一季》先导片同款游戏
          </p>
          
          {isRestoringSession && (
            <div 
              className="mb-4 p-3 rounded-lg text-center"
              style={{ 
                background: 'rgba(91, 192, 222, 0.2)', 
                border: '1px solid #5bc0de',
                color: '#5bc0de'
              }}
            >
              <span className="inline-block animate-pulse mr-2">🔄</span>
              正在恢复游戏会话...
            </div>
          )}
          
          {!isConnected && (
            <div 
              className="mb-4 p-3 rounded-lg text-center"
              style={{ 
                background: 'rgba(197, 152, 74, 0.2)', 
                border: '1px solid #d4a853',
                color: '#d4a853'
              }}
            >
              <span className="inline-block animate-pulse mr-2">●</span>
              正在连接服务器...
              <button 
                onClick={reconnect}
                className="ml-2 text-sm underline hover:no-underline"
              >
                重试
              </button>
            </div>
          )}
          
          {(appError || connectionError) && (
            <div 
              className="mb-4 p-3 rounded-lg text-center"
              style={{ 
                background: 'rgba(201, 48, 44, 0.2)', 
                border: '1px solid #c9302c',
                color: '#c9302c'
              }}
            >
              {appError || connectionError}
            </div>
          )}
          
          <div className="grid grid-cols-1 gap-4">
            <Button
              onClick={() => handleSelectRole('host')}
              disabled={!isConnected || isCreatingRoom || isRestoringSession}
              className="h-16 text-lg font-bold transition-all hover:scale-105 disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #d4a853 0%, #b8941d 100%)',
                color: '#0a0a0a',
                border: '2px solid #d4a853'
              }}
            >
              {isCreatingRoom ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span>
                  正在创建房间...
                </span>
              ) : (
                '🎮 我是主持人'
              )}
            </Button>
            
            <div className="border-t border-[#444] pt-4">
              <p className="text-[#aaaaaa] text-sm mb-3 text-center">玩家加入</p>
              
              <div className="flex gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="输入4位房间号"
                  value={inputRoomCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setInputRoomCode(value);
                  }}
                  className="bg-[#2a2a2a] border-[#444] text-[#f5f5f5] text-center tracking-widest"
                  maxLength={4}
                  style={{ fontSize: '1.5rem', letterSpacing: '0.5rem' }}
                  disabled={!isConnected}
                />
                <Button
                  onClick={handleJoinGame}
                  disabled={!isConnected || inputRoomCode.length !== 4}
                  className="bg-[#5bc0de] text-[#0a0a0a] hover:bg-[#4ab0ce] font-bold disabled:opacity-50"
                >
                  加入
                </Button>
              </div>
              
              {joinError && (
                <p className="text-[#c9302c] text-sm mt-2 text-center">{joinError}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      

      {userType === 'host' && <HostPanel />}
      {userType === 'player' && <PlayerPanel />}
    </div>
  );
}

export default App;