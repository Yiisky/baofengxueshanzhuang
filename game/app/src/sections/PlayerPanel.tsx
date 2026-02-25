import React, { useState, useEffect, Component, useCallback } from 'react';
import { 
  Users, User, Lightbulb, Package, CheckCircle, 
  X, AlertCircle
} from 'lucide-react';
import { 
  getLocationById, 
  getConnectedLocations, 
  getMoveCost 
} from '@/data/locations';
import type { 
  Player, 
  ItemType, 
  RoleType, 
  CampType 
} from '@/types/game';
import { useWebSocketStore } from '@/store/websocketStore';

// ====================== 优化后的 SVG 房间定义 ======================
interface RoomPolygon {
  id: string;
  name: string;
  points: string;
  center: { x: string; y: string };
  floor: 'attic' | 'second' | 'first' | 'basement';
  isCrimeScene?: boolean;
}

const roomPolygons: RoomPolygon[] = [
  // ===== 阁楼 =====
  {
    id: 'attic_therapy',
    name: '理疗室',
    floor: 'attic',
    points: "28.5,18.5 41.5,18.5 41.5,27.5 35,27.5 35,31.5 28.5,31.5",
    center: { x: '35%', y: '25%' }
  },
  {
    id: 'attic_main',
    name: '阁楼',
    floor: 'attic',
    points: "41.5,18.5 64.5,18.5 64.5,31.5 41.5,31.5",
    center: { x: '53%', y: '25%' }
  },
  {
    id: 'attic_balcony',
    name: '阁楼阳台',
    floor: 'attic',
    points: "64.5,18.5 77.5,18.5 77.5,31.5 64.5,31.5",
    center: { x: '71%', y: '25%' }
  },

  // ===== 二楼 =====
  {
    id: 'second_control',
    name: '中控室',
    floor: 'second',
    points: "12.5,32.5 21.5,32.5 21.5,37.5 24.5,37.5 24.5,44.5 12.5,44.5",
    center: { x: '18%', y: '38%' }
  },
  {
    id: 'second_tool',
    name: '工具间',
    floor: 'second',
    points: "12.5,44.5 24.5,44.5 27.5,51.5 17.5,51.5 12.5,47.5",
    center: { x: '20%', y: '48%' }
  },
  {
    id: 'second_storage',
    name: '储物室',
    floor: 'second',
    points: "27.5,32.5 41.5,32.5 41.5,37.5 34.5,37.5 31.5,41.5 27.5,41.5",
    center: { x: '34.5%', y: '36%' }
  },
  {
    id: 'second_corridor',
    name: '二楼走廊',
    floor: 'second',
    points: "31.5,41.5 44.5,41.5 47.5,47.5 34.5,47.5 27.5,51.5 24.5,44.5 27.5,41.5",
    center: { x: '37%', y: '45%' }
  },
  {
    id: 'second_crime',
    name: '第二案发现场',
    floor: 'second',
    isCrimeScene: true,
    points: "41.5,32.5 61.5,32.5 61.5,41.5 47.5,41.5 44.5,37.5 41.5,37.5",
    center: { x: '51.5%', y: '37%' }
  },
  {
    id: 'second_hall',
    name: '二楼大厅',
    floor: 'second',
    points: "34.5,47.5 47.5,47.5 51.5,57.5 41.5,57.5 34.5,51.5",
    center: { x: '43%', y: '52%' }
  },
  {
    id: 'second_bedroom_a',
    name: '客房A',
    floor: 'second',
    points: "61.5,34.5 71.5,34.5 71.5,44.5 61.5,44.5",
    center: { x: '66.5%', y: '39.5%' }
  },
  {
    id: 'second_bedroom_b',
    name: '客房B',
    floor: 'second',
    points: "27.5,51.5 34.5,51.5 41.5,57.5 31.5,57.5 27.5,54.5",
    center: { x: '33%', y: '54%' }
  },
  {
    id: 'second_balcony_north',
    name: '二楼阳台北侧',
    floor: 'second',
    points: "71.5,32.5 84.5,32.5 84.5,37.5 71.5,37.5",
    center: { x: '78%', y: '35%' }
  },
  {
    id: 'second_balcony',
    name: '二楼阳台',
    floor: 'second',
    points: "71.5,44.5 84.5,44.5 84.5,51.5 71.5,47.5",
    center: { x: '78%', y: '47%' }
  },

  // ===== 一楼 =====
  {
    id: 'first_dining',
    name: '餐厅',
    floor: 'first',
    points: "15.5,58.5 34.5,58.5 34.5,67.5 24.5,71.5 15.5,67.5",
    center: { x: '25%', y: '64%' }
  },
  {
    id: 'first_living_b',
    name: '起居室B',
    floor: 'first',
    points: "34.5,55.5 47.5,55.5 47.5,61.5 41.5,64.5 34.5,64.5",
    center: { x: '41%', y: '60%' }
  },
  {
    id: 'first_corridor',
    name: '一楼走廊',
    floor: 'first',
    points: "34.5,64.5 41.5,64.5 47.5,61.5 51.5,67.5 47.5,74.5 34.5,71.5",
    center: { x: '43%', y: '68%' }
  },
  {
    id: 'first_crime',
    name: '第一案发现场',
    floor: 'first',
    isCrimeScene: true,
    points: "22.5,71.5 34.5,71.5 37.5,77.5 27.5,81.5 22.5,77.5",
    center: { x: '30%', y: '76%' }
  },
  {
    id: 'first_hall',
    name: '一楼大厅',
    floor: 'first',
    points: "47.5,61.5 61.5,61.5 61.5,71.5 51.5,74.5 47.5,67.5",
    center: { x: '54.5%', y: '67%' }
  },
  {
    id: 'first_living_a',
    name: '起居室A',
    floor: 'first',
    points: "51.5,55.5 64.5,55.5 61.5,61.5 51.5,61.5",
    center: { x: '57%', y: '58%' }
  },
  {
    id: 'first_kitchen',
    name: '厨房',
    floor: 'first',
    points: "61.5,61.5 74.5,61.5 71.5,71.5 61.5,71.5",
    center: { x: '67%', y: '66%' }
  },
  {
    id: 'first_cloakroom',
    name: '衣帽间',
    floor: 'first',
    points: "64.5,55.5 74.5,57.5 71.5,64.5 61.5,61.5 64.5,55.5",
    center: { x: '68%', y: '59%' }
  },
  {
    id: 'first_garden_north',
    name: '北花园',
    floor: 'first',
    points: "51.5,48.5 64.5,48.5 61.5,55.5 51.5,55.5",
    center: { x: '58%', y: '52%' }
  },
  {
    id: 'first_garden_south',
    name: '南花园',
    floor: 'first',
    points: "28.5,81.5 41.5,81.5 44.5,87.5 31.5,87.5",
    center: { x: '36.5%', y: '84.5%' }
  },
  {
    id: 'first_garden_east',
    name: '东花园',
    floor: 'first',
    points: "71.5,71.5 84.5,71.5 87.5,77.5 74.5,77.5",
    center: { x: '79%', y: '74%' }
  },

  // ===== 地下室 =====
  {
    id: 'basement_north',
    name: '地下室北走廊',
    floor: 'basement',
    points: "45.5,85.5 64.5,85.5 61.5,91.5 47.5,91.5",
    center: { x: '55%', y: '88%' }
  },
  {
    id: 'basement_south',
    name: '地下室南走廊',
    floor: 'basement',
    points: "35.5,91.5 47.5,91.5 44.5,97.5 31.5,97.5",
    center: { x: '40%', y: '94.5%' }
  },
  {
    id: 'basement_storage',
    name: '杂物间',
    floor: 'basement',
    points: "61.5,87.5 74.5,87.5 71.5,94.5 61.5,94.5",
    center: { x: '67%', y: '91%' }
  }
];

// ====================== 辅助函数 ======================
function getRoleName(role?: RoleType): string {
  const roleMap: Record<RoleType, string> = {
    detective: '侦探',
    killer: '凶手',        
    murderer: '凶手',
    innocent: '平民',
    accomplice: '帮凶',
    bad_fan: '坏粉丝',    
    good_fan: '好粉丝',    
    doctor: '医生',        
    engineer: '工程师',    
    hacker: '黑客'         
  };
  return role ? roleMap[role] : '未知身份';
}

function getCampColor(camp?: CampType): string {
  const colorMap: Record<CampType, string> = {
    good: '#4CAF50',
    detective: '#4CAF50',  
    evil: '#F44336',
    killer: '#F44336',     
    neutral: '#FFC107'
  };
  return camp ? colorMap[camp] : '#f5f5f5';
}

function getRoleSkillDescription(role?: RoleType): string {
  const skillMap: Record<RoleType, string> = {
    detective: '可以查看案发现场的线索，每轮可以额外移动一次',
    killer: '可以在夜晚行动，不被其他玩家发现',
    murderer: '可以在夜晚行动，不被其他玩家发现',
    innocent: '可以在投票阶段发起重新投票',
    accomplice: '可以替凶手掩盖线索，干扰侦探调查',
    bad_fan: '坏粉丝技能',
    good_fan: '好粉丝技能',
    doctor: '可以治疗其他玩家',
    engineer: '可以修理设备',
    hacker: '可以黑入系统'
  };
  return role ? skillMap[role] : '无特殊技能';
}

const itemNames: Record<ItemType, string> = {
  bandage: '急救绷带',
  powder: '迷药粉末',
  extinguisher: '灭火器',
  rope: '登山绳',
  ski: '滑雪套装'
};

function canVote(role?: RoleType): boolean {
  return role !== 'killer' && role !== 'murderer' && role !== 'accomplice' && role !== 'bad_fan';
}

function isKiller(role?: RoleType): boolean {
  return role === 'killer' || role === 'murderer';
}

// ====================== 确认弹窗组件 ======================
interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'info' | 'warning' | 'danger';
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  onConfirm,
  onCancel,
  type = 'info'
}) => {
  if (!isOpen) return null;

  const colors = {
    info: { border: '#d4a853', bg: '#d4a853', text: '#0a0a0a' },
    warning: { border: '#FF9800', bg: '#FF9800', text: '#0a0a0a' },
    danger: { border: '#c9302c', bg: '#c9302c', text: '#ffffff' }
  };

  const theme = colors[type];

  return (
    <div 
      className="fixed inset-0 bg-black/85 flex items-center justify-center z-[60] p-4"
      onClick={onCancel}
    >
      <div 
        className="bg-[#1a1a1a] border-2 rounded-xl max-w-sm w-full p-6 shadow-2xl"
        style={{ borderColor: theme.border }}
        onClick={e => e.stopPropagation()}
      >
        <h3 
          className="text-xl font-bold mb-4 text-center"
          style={{ color: theme.border }}
        >
          {title}
        </h3>
        
        <div className="text-[#cccccc] text-center mb-6 leading-relaxed">
          {message}
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-lg bg-[#2a2a2a] text-[#aaaaaa] font-bold active:bg-[#333] transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 rounded-lg font-bold active:opacity-80 transition-opacity"
            style={{ backgroundColor: theme.bg, color: theme.text }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

// ====================== 提示弹窗（仅确认） ======================
type AlertType = 'info' | 'warning' | 'error';

interface AlertDialogProps {
  isOpen: boolean;
  title: string;
  message: string | React.ReactNode;
  onConfirm: () => void;
  type?: AlertType;
}

const AlertDialog: React.FC<AlertDialogProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  type = 'info'
}) => {
  if (!isOpen) return null;

  const colors: Record<AlertType, string> = {
    info: '#d4a853',
    warning: '#FF9800',
    error: '#c9302c'
  };

  const bgColors: Record<AlertType, string> = {
    info: '#d4a853',
    warning: '#FF9800',
    error: '#c9302c'
  };

  return (
    <div 
      className="fixed inset-0 bg-black/85 flex items-center justify-center z-[60] p-4"
      onClick={onConfirm}
    >
      <div 
        className="bg-[#1a1a1a] border-2 rounded-xl max-w-sm w-full p-6 shadow-2xl"
        style={{ borderColor: colors[type] }}
        onClick={e => e.stopPropagation()}
      >
        <h3 
          className="text-xl font-bold mb-4 text-center"
          style={{ color: colors[type] }}
        >
          {title}
        </h3>
        
        <div className="text-[#cccccc] text-center mb-6 leading-relaxed">
          {message}
        </div>
        
        <button
          onClick={onConfirm}
          className="w-full py-3 rounded-lg font-bold active:opacity-80 transition-opacity"
          style={{ 
            backgroundColor: bgColors[type], 
            color: type === 'error' ? '#fff' : '#0a0a0a' 
          }}
        >
          我知道了
        </button>
      </div>
    </div>
  );
};

// ====================== SVG 地图组件 ======================
interface SVGMapOverlayProps {
  currentLocation: string;
  visitedLocations: string[];
  availableMoves: string[];
  onRoomClick: (roomId: string) => void;
}

const SVGMapOverlay: React.FC<SVGMapOverlayProps> = ({
  currentLocation,
  visitedLocations,
  availableMoves,
  onRoomClick
}) => {
  const getRoomFill = (roomId: string): string => {
    if (roomId === currentLocation) {
      return 'rgba(201, 48, 44, 0.35)';
    }
    if (visitedLocations.includes(roomId)) {
      return 'rgba(76, 175, 80, 0.25)';
    }
    return 'transparent';
  };

  const getRoomStroke = (roomId: string): { color: string; width: string; dash?: string } => {
    if (roomId === currentLocation) {
      return { color: '#d4a853', width: '1.5' };
    }
    if (visitedLocations.includes(roomId)) {
      return { color: '#4CAF50', width: '1' };
    }
    if (availableMoves.includes(roomId)) {
      return { color: '#d4a853', width: '1', dash: '3,3' };
    }
    return { color: 'transparent', width: '0' };
  };

  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      style={{ touchAction: 'none' }}
    >
      {roomPolygons.map((room) => {
        const fill = getRoomFill(room.id);
        const stroke = getRoomStroke(room.id);
        const isClickable = availableMoves.includes(room.id) || room.id === currentLocation;
        
        return (
          <g key={room.id}>
            <polygon
              points={room.points}
              fill={fill}
              stroke={stroke.color}
              strokeWidth={stroke.width}
              strokeDasharray={stroke.dash}
              strokeLinejoin="round"
              strokeLinecap="round"
              style={{
                cursor: isClickable ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
                pointerEvents: 'auto'
              }}
              onClick={() => onRoomClick(room.id)}
            />
            
            {room.id === currentLocation && (
              <g>
                <circle
                  cx={room.center.x}
                  cy={room.center.y}
                  r="2.5"
                  fill="none"
                  stroke="#d4a853"
                  strokeWidth="1"
                  opacity="0.6"
                >
                  <animate
                    attributeName="r"
                    values="2;4;2"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.8;0.2;0.8"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                </circle>
                <circle
                  cx={room.center.x}
                  cy={room.center.y}
                  r="1.5"
                  fill="#d4a853"
                />
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
};

// ====================== 错误边界 ======================
class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('PlayerPanel 错误:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-[#d4a853] p-4 text-center">
          <div>
            <h2 className="text-2xl font-bold mb-4">界面加载出错</h2>
            <p className="text-[#aaaaaa] mb-6">请刷新页面重试</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-3 rounded bg-[#d4a853] text-[#0a0a0a] font-bold text-lg"
            >
              刷新页面
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ====================== 等待大厅 ======================
function WaitingLobby({ 
  players,
  currentPlayer
}: { 
  players: Player[];
  currentPlayer: Player;
}) {
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
          10人阵营对抗 · 5轮推理博弈
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
            沉浸式推理游戏体验
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
        
        <div className="mt-8 text-center">
          <p className="text-[#aaaaaa] text-sm mb-2">房间码</p>
          <p className="text-[#d4a853] text-2xl font-bold">{localStorage.getItem('roomCode') || '未知'}</p>
        </div>
      </div>
    </div>
  );
}

// ====================== 主组件 ======================
export function PlayerPanel() {
  const currentPlayerId = (() => {
    try {
      return localStorage.getItem('myPlayerId') || '';
    } catch (e) {
      console.error('获取玩家ID失败:', e);
      return '';
    }
  })();
  
  const { 
    players = [], 
    phase = 'lobby', 
    round = 1,
    setPlayerLocation,
    vote,
    endAction
  } = useWebSocketStore();
  
  const currentPlayer = players.find((p: Player) => p.id === currentPlayerId) || {
    id: currentPlayerId,
    name: '未知玩家',
    role: 'innocent' as RoleType,
    camp: 'good' as CampType,
    health: 100,
    maxHealth: 100,
    actionPoints: 8,
    items: [] as ItemType[],
    locationId: '',
    currentLocation: '',
    actionLine: [],
    score: 0,
    isAlive: true,
    isExposed: false,
    visitedLocations: [],
    skillUsedThisRound: false
  };
  
  // 弹窗状态
  const [showMyInfo, setShowMyInfo] = useState(false);
  const [showVoteDialog, setShowVoteDialog] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<string>(currentPlayer.locationId || '');
  const [visitedLocations, setVisitedLocations] = useState<string[]>(currentPlayer.visitedLocations || []);
  const [availableMoves, setAvailableMoves] = useState<string[]>([]);
  
  const [initialSetupOpen, setInitialSetupOpen] = useState(false);
  const [moveConfirmOpen, setMoveConfirmOpen] = useState(false);
  const [endActionConfirmOpen, setEndActionConfirmOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{ 
    title: string; 
    message: string | React.ReactNode; 
    type: AlertType 
  }>({ title: '', message: '', type: 'info' });
  const [pendingMoveTarget, setPendingMoveTarget] = useState<string>('');
  const [pendingMoveCost, setPendingMoveCost] = useState<number>(0);

  // 计算可移动位置
  useEffect(() => {
    if (currentPlayer && currentLocation) {
      const moves = getConnectedLocations(currentLocation);
      setAvailableMoves(moves.map(m => m.id));
    } else if (!currentLocation && round === 1 && phase === 'action') {
      setInitialSetupOpen(true);
    }
  }, [currentLocation, currentPlayer, round, phase]);

  // 检查是否是初始设置阶段
  useEffect(() => {
    if (round === 1 && phase === 'action' && !currentLocation) {
      setInitialSetupOpen(true);
    }
  }, [round, phase, currentLocation]);

  // 显示提示弹窗
  const showAlert = (title: string, message: string | React.ReactNode, type: AlertType = 'info') => {
    setAlertConfig({ title, message, type });
    setAlertOpen(true);
  };

  // 处理房间点击
  const handleRoomClick = useCallback((roomId: string) => {
    const room = roomPolygons.find(r => r.id === roomId);
    if (!room) return;

    // 初始设置阶段
    if (round === 1 && !currentLocation) {
      if (isKiller(currentPlayer.role) && !room.isCrimeScene) {
        showAlert('初始位置限制', '作为凶手，你只能从第一案发现场或第二案发现场开始行动', 'warning');
        return;
      }
      setPendingMoveTarget(roomId);
      setPendingMoveCost(0);
      setMoveConfirmOpen(true);
      return;
    }

    // 正常游戏阶段
    if (roomId === currentLocation) {
      showAlert('提示', `你当前就在${room.name}`, 'info');
      return;
    }

    if (!availableMoves.includes(roomId)) {
      const currentRoom = roomPolygons.find(r => r.id === currentLocation);
      showAlert(
        '无法移动', 
        `您当前位置是${currentRoom?.name || '未知'}，不可移动到${room.name}，这两个房间不相邻`,
        'warning'
      );
      return;
    }

    const hasSki = currentPlayer.items?.includes('ski') || false;
    const cost = getMoveCost(currentLocation, roomId, hasSki);

    if (currentPlayer.actionPoints < cost) {
      showAlert(
        '行动点不足',
        `移动到${room.name}需要${cost}点行动点，你当前只有${currentPlayer.actionPoints}点`,
        'error'
      );
      return;
    }

    setPendingMoveTarget(roomId);
    setPendingMoveCost(cost);
    setMoveConfirmOpen(true);
  }, [currentLocation, availableMoves, currentPlayer, round]);

  // 确认移动
  const confirmMove = () => {
    const room = roomPolygons.find(r => r.id === pendingMoveTarget);
    if (!room) return;

    try {
      setCurrentLocation(pendingMoveTarget);
      setVisitedLocations(prev => {
        if (prev.includes(pendingMoveTarget)) return prev;
        return [...prev, pendingMoveTarget];
      });

      // 修复：只传递2个参数给 setPlayerLocation
      setPlayerLocation(currentPlayer.id, pendingMoveTarget);

      setMoveConfirmOpen(false);
      
      if (pendingMoveCost > 0) {
        showAlert('移动成功', `已移动到${room.name}，消耗${pendingMoveCost}点行动点`, 'info');
      } else {
        showAlert('初始位置设置成功', `你将在${room.name}开始游戏`, 'info');
      }
    } catch (error) {
      console.error('移动失败:', error);
      showAlert('移动失败', '请检查网络连接后重试', 'error');
    }
  };

  // 处理结束行动
  const handleEndAction = () => {
    if (currentPlayer.actionPoints > 0) {
      setEndActionConfirmOpen(true);
    } else {
      doEndAction();
    }
  };

  const doEndAction = () => {
    try {
      if (endAction) {
        endAction({
          playerId: currentPlayer.id,
          remainingPoints: currentPlayer.actionPoints,
          round: round,
          timestamp: Date.now()
        });
      }
      setEndActionConfirmOpen(false);
      showAlert('行动结束', '等待其他玩家完成行动', 'info');
    } catch (error) {
      console.error('结束行动失败:', error);
      showAlert('操作失败', '请重试', 'error');
    }
  };

  if (phase === 'lobby' || phase === 'config') {
    return <WaitingLobby players={players} currentPlayer={currentPlayer} />;
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#0a0a0a] text-[#f5f5f5] overflow-hidden relative select-none">
        {/* 顶部状态栏 */}
        <header className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/90 to-transparent p-4 flex justify-between items-center">
          <div>
            <h1 className="text-[#d4a853] text-xl font-bold drop-shadow-lg">暴风雪山庄</h1>
            <div className="text-[#aaaaaa] text-xs mt-1">
              第 {round} 轮 · {
                {
                  action: '行动阶段',
                  free: '自由阶段',
                  settlement: '结算阶段',
                  ended: '游戏结束'
                }[phase as string] || '准备中'
              }
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div 
              className="flex items-center gap-2 px-4 py-2 rounded-full border"
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                borderColor: 'rgba(212, 168, 83, 0.4)'
              }}
            >
              <span className="text-[#aaaaaa] text-sm">行动点</span>
              <span className="text-[#d4a853] font-bold text-xl">{currentPlayer.actionPoints}</span>
            </div>
            
            <button 
              onClick={() => setShowMyInfo(true)}
              className="px-5 py-2 rounded-full bg-[#d4a853] text-[#0a0a0a] text-sm font-bold active:scale-95 transition-transform"
            >
              我的信息
            </button>
            
            {phase === 'action' && (
              <>
                <button 
                  onClick={() => setShowVoteDialog(true)}
                  className="px-5 py-2 rounded-full bg-[#c9302c] text-white text-sm font-bold active:scale-95 transition-transform"
                >
                  投凶
                </button>
                <button 
                  onClick={handleEndAction}
                  className="px-5 py-2 rounded-full bg-[#2a2a2a] border border-[#d4a853] text-[#d4a853] text-sm font-bold active:scale-95 transition-transform"
                >
                  结束行动
                </button>
              </>
            )}
          </div>
        </header>

        {/* 主地图区域 */}
        <main className="h-screen w-full relative flex items-center justify-center bg-[#0a0a0a]">
          <div 
            className="relative w-full h-full max-w-5xl max-h-[95vh] aspect-[3/4]"
            style={{
              backgroundImage: 'url(/images/Action%20Map.png)',
              backgroundSize: 'contain',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }}
          >
            <SVGMapOverlay
              currentLocation={currentLocation}
              visitedLocations={visitedLocations}
              availableMoves={availableMoves}
              onRoomClick={handleRoomClick}
            />
          </div>
        </main>

        {/* 底部信息栏 */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent p-6 pt-12">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-[#d4a853] mb-1">
              {currentLocation ? (roomPolygons.find(r => r.id === currentLocation)?.name || '未知位置') : '请选择初始位置'}
            </h2>
            <p className="text-[#aaaaaa] text-sm mb-4">
              {currentLocation 
                ? (getLocationById(currentLocation)?.description || '点击相邻房间进行移动')
                : (isKiller(currentPlayer.role) 
                    ? '作为凶手，请从第一或第二案发现场开始' 
                    : '请选择你的起始房间')}
            </p>
            
            <div className="flex justify-center gap-8 text-xs text-[#aaaaaa]">
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-[rgba(201,48,44,0.35)] border border-[#d4a853]" />
                当前位置
              </span>
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-[rgba(76,175,80,0.25)] border border-[#4CAF50]" />
                已探索
              </span>
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded border border-[#d4a853] border-dashed" />
                可移动
              </span>
            </div>
          </div>
        </div>

        {/* ==================== 弹窗层 ==================== */}

        <ConfirmDialog
          isOpen={initialSetupOpen}
          title="选择初始位置"
          message={
            <div className="space-y-2">
              <p>请先选择自己的初始行动地点</p>
              {isKiller(currentPlayer.role) ? (
                <p className="text-[#c9302c] font-bold">
                  作为凶手，你只能从两个案发现场中选择一个开始行动
                </p>
              ) : (
                <p className="text-[#4CAF50]">你可以选择任意房间作为起点</p>
              )}
            </div>
          }
          confirmText="开始选择"
          cancelText=""
          onConfirm={() => setInitialSetupOpen(false)}
          onCancel={() => setInitialSetupOpen(false)}
          type="info"
        />

        <ConfirmDialog
          isOpen={moveConfirmOpen}
          title="确认移动"
          message={
            <div>
              <p>是否移动到 <span className="text-[#d4a853] font-bold">
                {roomPolygons.find(r => r.id === pendingMoveTarget)?.name}
              </span>？</p>
              {pendingMoveCost > 0 && (
                <p className="mt-2 text-[#aaaaaa]">
                  消耗行动点：<span className="text-[#d4a853]">{pendingMoveCost}</span>
                </p>
              )}
            </div>
          }
          confirmText="确认移动"
          cancelText="取消"
          onConfirm={confirmMove}
          onCancel={() => setMoveConfirmOpen(false)}
          type="info"
        />

        <ConfirmDialog
          isOpen={endActionConfirmOpen}
          title="行动点未使用完"
          message={
            <div>
              <p>你还剩余 <span className="text-[#d4a853] font-bold">{currentPlayer.actionPoints}</span> 点行动点未使用</p>
              <p className="mt-2 text-[#aaaaaa] text-sm">确认要提前结束行动吗？</p>
            </div>
          }
          confirmText="确认结束"
          cancelText="继续行动"
          onConfirm={doEndAction}
          onCancel={() => setEndActionConfirmOpen(false)}
          type="warning"
        />

        <AlertDialog
          isOpen={alertOpen}
          title={alertConfig.title}
          message={alertConfig.message}
          onConfirm={() => setAlertOpen(false)}
          type={alertConfig.type}
        />

        {/* 我的信息弹窗 */}
        {showMyInfo && (
          <div 
            className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
            onClick={() => setShowMyInfo(false)}
          >
            <div 
              className="bg-[#1a1a1a] border-2 border-[#d4a853] rounded-xl max-w-md w-full max-h-[85vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-[#d4a853]">我的信息</h2>
                  <button 
                    onClick={() => setShowMyInfo(false)}
                    className="w-10 h-10 rounded-full bg-[#2a2a2a] flex items-center justify-center text-[#aaaaaa] active:bg-[#d4a853] active:text-[#0a0a0a] transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between items-center p-4 bg-[#2a2a2a] rounded-lg">
                    <span className="text-[#aaaaaa]">身份</span>
                    <span className="text-[#f5f5f5] font-bold text-lg">{getRoleName(currentPlayer.role)}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-[#2a2a2a] rounded-lg">
                    <span className="text-[#aaaaaa]">阵营</span>
                    <span 
                      className="font-bold px-4 py-1 rounded-full"
                      style={{ 
                        color: getCampColor(currentPlayer.camp),
                        backgroundColor: `${getCampColor(currentPlayer.camp)}20`
                      }}
                    >
                      {currentPlayer.camp || '未知'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-[#2a2a2a] rounded-lg">
                    <span className="text-[#aaaaaa]">生命值</span>
                    <div className="flex items-center gap-3">
                      <div className="w-32 h-3 bg-[#0a0a0a] rounded-full overflow-hidden border border-[#444]">
                        <div 
                          className="h-full bg-[#c9302c] transition-all"
                          style={{ width: `${(currentPlayer.health / currentPlayer.maxHealth) * 100}%` }}
                        />
                      </div>
                      <span className="text-[#c9302c] font-bold w-12 text-right">{currentPlayer.health}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-[#2a2a2a] rounded-lg">
                    <span className="text-[#aaaaaa]">行动点</span>
                    <span className="text-[#d4a853] font-bold text-2xl">{currentPlayer.actionPoints}</span>
                  </div>
                </div>
                
                <div className="mb-6">
                  <h3 className="text-lg font-bold text-[#d4a853] mb-3 flex items-center gap-2">
                    <Lightbulb className="w-5 h-5" /> 技能说明
                  </h3>
                  <div className="p-4 rounded-lg bg-[#d4a853]/10 border border-[#d4a853]/30 text-[#f5f5f5] text-sm leading-relaxed">
                    {getRoleSkillDescription(currentPlayer.role)}
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-bold text-[#d4a853] mb-3 flex items-center gap-2">
                    <Package className="w-5 h-5" /> 我的道具
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {currentPlayer.items && currentPlayer.items.length > 0 ? (
                      currentPlayer.items.map((item, index) => (
                        <div 
                          key={index}
                          className="p-4 rounded-lg text-center text-[#f5f5f5] bg-[#d4a853]/10 border border-[#d4a853]/30"
                        >
                          {itemNames[item as ItemType] || item}
                        </div>
                      ))
                    ) : (
                      <div className="col-span-2 text-[#aaaaaa] text-center py-6 bg-[#2a2a2a] rounded-lg">
                        暂无道具
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 投票弹窗 */}
        {showVoteDialog && (
          <div 
            className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
            onClick={() => setShowVoteDialog(false)}
          >
            <div 
              className="bg-[#1a1a1a] border-2 border-[#c9302c] rounded-xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-[#333]">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-[#c9302c]">投凶</h2>
                  <button 
                    onClick={() => setShowVoteDialog(false)}
                    className="w-10 h-10 rounded-full bg-[#2a2a2a] flex items-center justify-center text-[#aaaaaa] active:bg-[#c9302c] active:text-white transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1">
                {!canVote(currentPlayer.role) ? (
                  <div className="text-center py-12">
                    <AlertCircle className="w-20 h-20 text-[#c9302c] mx-auto mb-4 opacity-50" />
                    <p className="text-[#aaaaaa] text-lg">你的身份无法参与投票</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-[#aaaaaa] text-sm mb-4">
                      请选择你怀疑的玩家
                    </p>
                    {players.filter(p => p.id !== currentPlayer.id && p.isAlive).map((player, index) => (
                      <button
                        key={player.id}
                        onClick={() => {
                          vote?.(currentPlayer.id, player.id);
                          setShowVoteDialog(false);
                          showAlert('投票成功', `已投票给玩家 ${index + 1}`, 'info');
                        }}
                        className="w-full flex items-center justify-between p-4 rounded-lg bg-[#2a2a2a] active:bg-[#c9302c]/30 border border-transparent active:border-[#c9302c]/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-[#d4a853]/20 flex items-center justify-center">
                            <User className="w-6 h-6 text-[#d4a853]" />
                          </div>
                          <span className="text-[#f5f5f5] font-medium text-lg">玩家 {index + 1}</span>
                        </div>
                        <CheckCircle className="w-6 h-6 text-[#444]" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

export default PlayerPanel;