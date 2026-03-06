//等待大厅组件
// src/components/player/WaitingLobby.tsx
import React from 'react';
import { Users } from 'lucide-react';
import type { Player } from '@/types/game';

interface WaitingLobbyProps {
  players: Player[];
  currentPlayer: Player;
}

export const WaitingLobby: React.FC<WaitingLobbyProps> = ({ players, currentPlayer }) => {
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
      <div className="absolute inset-0 bg-black/70" />
      
      <div 
        className="relative z-10 w-full max-w-md p-8 rounded-xl"
        style={{
          background: 'rgba(26, 26, 26, 0.95)',
          border: '2px solid #d4a853',
          boxShadow: '0 0 30px rgba(212, 168, 83, 0.3)'
        }}
      >
        <h1 
          className="text-center text-3xl font-bold mb-2"
          style={{ 
            color: '#d4a853',
            textShadow: '0 0 20px rgba(212, 168, 83, 0.5)'
          }}
        >
          暴风雪山庄
        </h1>
        
        <p className="text-[#aaaaaa] text-center text-sm mb-6">
          《大侦探 第十一季》先导片同款游戏
        </p>
        
        <div 
          className="text-center mb-6 p-6 rounded-lg"
          style={{
            background: 'linear-gradient(135deg, rgba(212, 168, 83, 0.2) 0%, rgba(212, 168, 83, 0.05) 100%)',
            border: '2px solid #d4a853'
          }}
        >
          <div className="text-[#d4a853] text-sm mb-2 tracking-widest">WELCOME TO</div>
          <div 
            className="text-5xl font-bold tracking-wider"
            style={{ 
              color: '#d4a853',
              textShadow: '0 0 30px rgba(212, 168, 83, 0.8)'
            }}
          >
            MCITY
          </div>
          <div className="mt-3 text-[#aaaaaa] text-sm">
            芒果tv粉丝线下聚会场所
          </div>
        </div>
        
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-[#d4a853]">
              <Users className="w-5 h-5" />
              <span className="font-bold">玩家列表</span>
            </div>
            <span className="text-[#aaaaaa] text-sm">
              {players.length}/10人
            </span>
          </div>
          
          <div 
            className="space-y-2 max-h-48 overflow-y-auto p-3 rounded-lg"
            style={{
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid #444'
            }}
          >
            {players.map((player, index) => (
              <div 
                key={player.id}
                className="flex items-center justify-between p-2 rounded"
                style={{
                  background: player.id === currentPlayer.id 
                    ? 'rgba(212, 168, 83, 0.2)' 
                    : 'rgba(42, 42, 42, 0.5)',
                  border: player.id === currentPlayer.id 
                    ? '1px solid #d4a853' 
                    : '1px solid transparent'
                }}
              >
                <span className="text-[#f5f5f5]">玩家 {index + 1}</span>
                <span className={player.id === currentPlayer.id ? "text-[#d4a853] font-bold" : "text-[#aaaaaa]"}>
                  {player.id === currentPlayer.id ? "你" : "已加入"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};