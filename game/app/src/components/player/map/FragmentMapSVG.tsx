//SVG地图

import React, { useMemo } from 'react';
import type { Player } from '@/types/game';
import { roomFragments, type RoomFragmentData } from '@/data/roomFragments';
import { isGarden } from '@/utils/movementRules';
import { FireAnimation } from './FireAnimation';

interface FragmentMapSVGProps {
  currentPlayer: Player;
  players: Player[];
  fireLocations: string[];
  onRoomClick: (roomId: string) => void;
}

export const FragmentMapSVG: React.FC<FragmentMapSVGProps> = ({
  currentPlayer,
  fireLocations,
  onRoomClick
}) => {
  const roomStates = useMemo(() => {
    const states = new Map<string, {
      isVisited: boolean;
      isBurning: boolean;
      isCurrent: boolean;
      isAvailable: boolean;
    }>();

    const currentRoom = roomFragments.find(r => r.id === currentPlayer.currentLocation);
    const currentIsGarden = currentRoom ? isGarden(currentRoom.id) : false;
    const hasSki = currentPlayer.items?.includes('ski') || false;
    const actionPoints = currentPlayer.actionPoints || 0;

    roomFragments.forEach(room => {
      const isVisited = currentPlayer.visitedLocations?.includes(room.id) || false;
      const isBurning = fireLocations.includes(room.id) || false;
      const isCurrent = currentPlayer.currentLocation === room.id;
      
      const isConnected = currentRoom?.connections.includes(room.id) || false;
      
      let isAvailable = false;
      if (isCurrent) {
        isAvailable = true;
      } else if (isConnected) {
        const targetIsGarden = isGarden(room.id);
        
        if (targetIsGarden && !currentIsGarden) {
          isAvailable = hasSki ? actionPoints >= 1 : actionPoints >= 2;
        } else if (!targetIsGarden && currentIsGarden) {
          isAvailable = actionPoints >= 1;
        } else if (targetIsGarden && currentIsGarden) {
          isAvailable = actionPoints >= 2;
        } else {
          isAvailable = actionPoints >= 1;
        }
      }

      states.set(room.id, { isVisited, isBurning, isCurrent, isAvailable });
    });

    return states;
  }, [currentPlayer, fireLocations]);

  const getFillColor = (isVisited: boolean, isCurrent: boolean): string => {
    if (isCurrent || isVisited) return 'rgba(76, 175, 80, 0.5)';
    return 'rgba(60, 60, 80, 0)';
  };

  const getStrokeColor = (isVisited: boolean, isCurrent: boolean): string => {
    if (isCurrent || isVisited) return 'rgba(76, 175, 80, 0.8)';
    return 'rgba(100, 100, 120, 0.3)';
  };

  const parseClipPathToPoints = (room: RoomFragmentData): string => {
    const left = parseFloat(room.position.left) / 100 * 2160;
    const top = parseFloat(room.position.top) / 100 * 2580;
    const width = parseFloat(room.position.width) / 100 * 2160;
    const height = parseFloat(room.position.height) / 100 * 2580;
    
    const clipContent = room.clipPath
      .replace('polygon(', '')
      .replace(')', '');
    
    const points = clipContent.split(', ').map(pair => {
      const [xPct, yPct] = pair.trim().split(' ');
      const xRel = parseFloat(xPct.replace('%', '')) / 100;
      const yRel = parseFloat(yPct.replace('%', '')) / 100;
      
      const x = left + xRel * width;
      const y = top + yRel * height;
      
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    
    return points.join(' ');
  };

  return (
    <g>
      <defs>
        <radialGradient id="fireGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff4500" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#ff6b35" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#ff4500" stopOpacity="0" />
        </radialGradient>
      </defs>

      {roomFragments.map(room => {
        const roomState = roomStates.get(room.id);
        if (!roomState?.isCurrent) return null;
        
        return room.connections.map(connId => {
          const connRoom = roomFragments.find(r => r.id === connId);
          if (!connRoom) return null;
          
          const getCenter = (r: RoomFragmentData) => {
            const left = parseFloat(r.position.left) / 100 * 2160;
            const top = parseFloat(r.position.top) / 100 * 2580;
            const width = parseFloat(r.position.width) / 100 * 2160;
            const height = parseFloat(r.position.height) / 100 * 2580;
            return { x: left + width/2, y: top + height/2 };
          };
          
          const start = getCenter(room);
          const end = getCenter(connRoom);
          
          return (
            <line
              key={`${room.id}-${connId}`}
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              stroke="#d4a853"
              strokeWidth="3"
              strokeDasharray="8,8"
              opacity="0.6"
            />
          );
        });
      })}

      {roomFragments.map((room) => {
        const state = roomStates.get(room.id)!;
        const points = parseClipPathToPoints(room);
        const fillColor = getFillColor(state.isVisited, state.isCurrent);
        const strokeColor = getStrokeColor(state.isVisited, state.isCurrent);
        
        return (
          <g key={room.id} style={{ pointerEvents: 'all' }}>
            <polygon
              points={points}
              fill="transparent"
              stroke="transparent"
              strokeWidth="30"
              strokeLinejoin="round"
              onClick={() => onRoomClick(room.id)}
              style={{ 
                cursor: state.isAvailable || state.isCurrent ? 'pointer' : 'not-allowed',
                pointerEvents: 'all',
              }}
            />
            
            <polygon
              points={points}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={state.isCurrent ? 4 : 2}
              strokeLinejoin="round"
              strokeLinecap="round"
              style={{ 
                transition: 'all 0.3s ease',
                pointerEvents: 'none',
              }}
            />
            
            {state.isCurrent && (
              <g>
                <circle
                  cx={(parseFloat(room.position.left) + parseFloat(room.position.width)/2) / 100 * 2160}
                  cy={(parseFloat(room.position.top) + parseFloat(room.position.height)/2) / 100 * 2580}
                  r="30"
                  fill="none"
                  stroke="#4CAF50"
                  strokeWidth="3"
                  opacity="0.8"
                >
                  <animate attributeName="r" values="25;35;25" dur="1.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.8;0.3;0.8" dur="1.5s" repeatCount="indefinite" />
                </circle>
              </g>
            )}

            {state.isBurning && <FireAnimation room={room} />}
          </g>
        );
      })}
    </g>
  );
};