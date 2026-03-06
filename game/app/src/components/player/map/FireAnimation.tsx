//火焰动画

import React from 'react';
import type { RoomFragmentData } from '@/data/roomFragments';

export const FireAnimation: React.FC<{ room: RoomFragmentData }> = ({ room }) => {
  const getCenter = () => {
    const left = parseFloat(room.position.left) / 100 * 2160;
    const top = parseFloat(room.position.top) / 100 * 2580;
    const width = parseFloat(room.position.width) / 100 * 2160;
    const height = parseFloat(room.position.height) / 100 * 2580;
    return { x: left + width/2, y: top + height/2 };
  };
  
  const center = getCenter();
  
  return (
    <g>
      {/* 火焰光晕效果 */}
      <circle
        cx={center.x}
        cy={center.y}
        r="80"
        fill="url(#fireGlow)"
        opacity="0.6"
      >
        <animate attributeName="r" values="70;90;70" dur="0.8s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.4;0.7;0.4" dur="0.8s" repeatCount="indefinite" />
      </circle>
      
      {/* 火焰粒子 */}
      {[...Array(5)].map((_, i) => (
        <g key={i} transform={`translate(${center.x + (i - 2) * 30}, ${center.y})`}>
          <path
            d="M0,0 Q-10,-20 0,-40 Q10,-20 0,0"
            fill="#ff6b35"
            opacity="0.8"
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              values={`0,0; 0,-30; 0,0`}
              dur={`${0.6 + i * 0.1}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.8;0;0.8"
              dur={`${0.6 + i * 0.1}s`}
              repeatCount="indefinite"
            />
          </path>
          <path
            d="M0,0 Q-8,-15 0,-30 Q8,-15 0,0"
            fill="#ffd93d"
            opacity="0.9"
          >
            <animateTransform
              attributeName="transform"
              type="translate"
              values={`0,0; 0,-25; 0,0`}
              dur={`${0.5 + i * 0.08}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.9;0;0.9"
              dur={`${0.5 + i * 0.08}s`}
              repeatCount="indefinite"
            />
          </path>
        </g>
      ))}
      
      {/* 火星粒子 */}
      {[...Array(8)].map((_, i) => (
        <circle
          key={`spark-${i}`}
          cx={center.x + (Math.random() - 0.5) * 100}
          cy={center.y - Math.random() * 50}
          r="4"
          fill="#ffaa00"
        >
          <animate
            attributeName="cy"
            values={`${center.y - 20};${center.y - 80}`}
            dur={`${1 + Math.random()}s`}
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="1;0"
            dur={`${1 + Math.random()}s`}
            repeatCount="indefinite"
          />
          <animate
            attributeName="r"
            values="4;1"
            dur={`${1 + Math.random()}s`}
            repeatCount="indefinite"
          />
        </circle>
      ))}
    </g>
  );
};