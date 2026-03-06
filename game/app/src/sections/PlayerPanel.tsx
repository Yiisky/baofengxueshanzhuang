// src/sections/PlayerPanel.tsx
import { useEffect, useMemo } from 'react';
import { FragmentMap } from '@/components/FragmentMap';
import { 
  ErrorBoundary, 
  WaitingLobby, 
  ActionButtons,
  ConfirmDialog,
  AlertDialog,
  DoubleMoveDialog,
  MyInfoDialog,
  VoteDialog,
  ItemsDialog,
  SkillDialog,
  VideoBackground
} from '@/components/player';
import { usePlayerPanel } from '@/hooks/usePlayerPanel';
import { roomFragments } from '@/data/roomFragments';
import { isGarden } from '@/utils/movementRules';

// 本地定义 isKiller（或者从 usePlayerPanel 导出）
function isKiller(role?: string): boolean {
  return role === 'killer' || role === 'murderer';
}

// 获取玩家编号 - 关键修复：优先使用服务器返回的 number 字段
function getPlayerNumber(playerId: string, players: any[]): number {
  if (!Array.isArray(players) || players.length === 0) return 0;
  if (!playerId) return 0;
  
  // 首先尝试从 players 数组中找到对应的玩家，使用其 number 字段
  const player = players.find(p => p.id === playerId);
  if (player) {
    // 优先使用服务器返回的 number 字段
    if (player.number && player.number > 0) {
      return player.number;
    }
    // 其次从 name 中提取
    if (player.name) {
      const match = player.name.match(/(\d+)号玩家/);
      if (match) return parseInt(match[1], 10);
    }
  }
  
  // 如果找不到，返回0（让调用方处理）
  return 0;
}

export function PlayerPanel() {
  const {
    // 数据
    players,
    phase,
    round,
    fireLocations,
    currentPlayer,

    // UI状态
    showMyInfo,
    setShowMyInfo,
    showVoteDialog,
    setShowVoteDialog,
    showItemsDialog,
    setShowItemsDialog,
    showSkillDialog,
    setShowSkillDialog,
    initialSetupOpen,
    setInitialSetupOpen,
    moveConfirmOpen,
    setMoveConfirmOpen,
    endActionConfirmOpen,
    setEndActionConfirmOpen,
    alertOpen,
    setAlertOpen,
    alertConfig,
    doubleMoveDialogOpen,
    
    // ===== 新增：身份确认弹窗 =====
    roleRevealOpen,
    setRoleRevealOpen,
    roleRevealInfo,

    // 移动状态
    pendingMoveTarget,
    pendingMoveCost,
    pendingHealthCost,
    pendingUseRope,
    pendingDoubleMove,
    pendingDoubleMoveOptions,
    firstMoveTarget,

    // 显示信息
    currentRoomName,
    currentRoomDesc,

    // 方法
    showAlert,
    handleRoomClick,
    confirmMove,
    executeDoubleMove,
    cancelDoubleMove,
    handleStay,
    doEndAction,
    vote,
  } = usePlayerPanel();

  // 关键修复：添加调试日志
  useEffect(() => {
    console.log('[PlayerPanel] 玩家列表更新:', players?.length, players?.map((p: any) => ({ 
      name: p.name, 
      id: p.id?.slice(0,6),
      number: p.number 
    })));
  }, [players]);

  // 获取当前玩家编号 - 关键修复：多重保障确保正确
  const playerNumber = useMemo(() => {
    // 第一优先级：currentPlayer 中的 number 字段
    const currentPlayerNumber = (currentPlayer as any).number;
    if (currentPlayerNumber && currentPlayerNumber > 0 && currentPlayerNumber <= 10) {
      console.log('[PlayerPanel] 使用 currentPlayer.number:', currentPlayerNumber);
      return currentPlayerNumber;
    }
    
    // 第二优先级：从 currentPlayer.name 中提取
    if (currentPlayer.name) {
      const match = currentPlayer.name.match(/(\d+)号玩家/);
      if (match) {
        const num = parseInt(match[1], 10);
        console.log('[PlayerPanel] 从 currentPlayer.name 提取 number:', num);
        return num;
      }
    }
    
    // 第三优先级：通过 players 数组查找
    if (currentPlayer.id && players.length > 0) {
      const foundPlayer = players.find(p => p.id === currentPlayer.id);
      if (foundPlayer) {
        if ((foundPlayer as any).number && (foundPlayer as any).number > 0) {
          console.log('[PlayerPanel] 从 players 数组获取 number:', (foundPlayer as any).number);
          return (foundPlayer as any).number;
        }
        if (foundPlayer.name) {
          const match = foundPlayer.name.match(/(\d+)号玩家/);
          if (match) {
            const num = parseInt(match[1], 10);
            console.log('[PlayerPanel] 从 players[].name 提取 number:', num);
            return num;
          }
        }
      }
    }
    
    // 最后尝试从 localStorage 获取
    const storedNumber = localStorage.getItem('myPlayerNumber');
    if (storedNumber) {
      const num = parseInt(storedNumber, 10);
      if (num > 0) {
        console.log('[PlayerPanel] 从 localStorage 获取 number:', num);
        return num;
      }
    }
    
    console.warn('[PlayerPanel] 无法确定玩家编号');
    return 0;
  }, [currentPlayer.id, currentPlayer.name, (currentPlayer as any).number, players]);

  // 等待大厅阶段 - 关键修复：严格检查 phase 值
  const isInLobby = phase === 'lobby' || phase === 'config';
  
  console.log('[PlayerPanel] 当前阶段:', phase, '是否在大厅:', isInLobby, '玩家数:', players?.length, '我的编号:', playerNumber);
  
  if (isInLobby) {
    return <WaitingLobby players={players} currentPlayer={currentPlayer} />;
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen text-[#f5f5f5] overflow-hidden relative select-none flex flex-col">
        {/* 雪花视频背景 - 最底层 */}
        <VideoBackground videoPath="/images/Snow.mp4" />

        <style>{`
          @keyframes pulse-available {
            0%, 100% { border-color: rgba(212, 168, 83, 0.5); box-shadow: 0 0 10px rgba(212, 168, 83, 0.2); }
            50% { border-color: rgba(212, 168, 83, 1); box-shadow: 0 0 25px rgba(212, 168, 83, 0.5); }
          }
        `}</style>

        {/* 顶部Header - 提高z-index确保在视频之上 */}
        <header className="flex-none z-50 bg-gradient-to-b from-black/90 to-transparent p-4 flex justify-between items-center relative">
          <div>
            <h1 className="text-[#d4a853] text-xl font-bold drop-shadow-lg">
              暴风雪山庄 · {playerNumber || (currentPlayer as any).number || '?'}号玩家
            </h1>            
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
            <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-[rgba(212,168,83,0.4)] bg-[rgba(0,0,0,0.6)]">
              <span className="text-[#aaaaaa] text-sm">行动点</span>
              <span className="text-[#d4a853] font-bold text-xl">{currentPlayer.actionPoints}</span>
            </div>
          </div>
        </header>

        {/* 主内容区域 - 地图 - 修复：移除黑色底图，让视频透过来 */}
        <main className="flex-1 w-full relative flex items-center justify-center overflow-hidden z-10">
          <div 
            className="relative w-full h-full max-w-4xl mx-auto"
            style={{ aspectRatio: '2160/2580' }}
          >
            {/* Action Map 图片 - 直接放在视频之上 */}
            <img 
              src="/images/Action Map.png"
              alt="行动地图"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              style={{ zIndex: 1 }}
              draggable={false}
            />

            {/* 房间点击区域 */}
            <div 
              className="absolute inset-0"
              style={{ zIndex: 10 }}
            >
              <FragmentMap
                currentPlayer={currentPlayer}
                players={players}
                fireLocations={fireLocations}
                onRoomClick={handleRoomClick}
              />
            </div>

            {/* Room Name Map 图片 */}
            <img 
              src="/images/Room Name Map.png"
              alt="房间名称地图"
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              style={{ zIndex: 20 }}
              draggable={false}
            />
          </div>
        </main>

        {/* 底部区域 - 提高z-index */}
        <div className="flex-none bg-gradient-to-t from-black/95 via-black/80 to-transparent p-4 pt-6 relative z-10">
          <div className="text-center mb-4">
            <h2 className="text-xl font-bold text-[#d4a853] mb-1">{currentRoomName}</h2>
            <p className="text-[#aaaaaa] text-sm mb-2">{currentRoomDesc}</p>
            <div className="text-xs text-[#666] space-y-1">
              <p>相邻房间移动消耗1点 | 花园之间移动消耗2点（滑雪套装减为1点）| 停留消耗1点</p>
              <p>客房A/B、起居室A/B开始可双移动 | 阳台可跳楼（绳索可免伤害）| 花园可用绳索爬回阳台</p>
              <p>特殊：大厅→东花园2点，东花园→大厅1点 | 北花园→地下室1点，地下室→北花园2点 | 南花园→案发现场1点，案发现场→南花园2点</p>
            </div>
          </div>

          <div className="max-w-4xl mx-auto">
            <ActionButtons
              currentPlayer={currentPlayer}
              phase={phase}
              round={round}
              onShowMyInfo={() => setShowMyInfo(true)}
              onShowItems={() => setShowItemsDialog(true)}
              onShowVote={() => setShowVoteDialog(true)}
              onShowSkill={() => setShowSkillDialog(true)}
              onStay={handleStay}
              showAlert={showAlert}
            />
          </div>
        </div>

        {/* ========== 弹窗组件 ========== */}

        {/* 身份确认弹窗 - 第一轮显示给所有玩家（已包含帮凶信息显示） */}
        <ConfirmDialog
          isOpen={roleRevealOpen}
          title="身份确认"
          message={
            <div className="space-y-4 text-center">
              <p className="text-[#d4a853] font-bold text-2xl">
                你是：{roleRevealInfo.roleName}
              </p>
              <p className="text-[#aaaaaa]">
                {roleRevealInfo.roleDescription}
              </p>

              {/* 帮凶额外显示同伴信息 */}
              {roleRevealInfo.isAccomplice && (
                <div className="mt-4 p-4 bg-[rgba(201,48,44,0.1)] border border-[#c9302c] rounded-lg">
                  <p className="text-[#c9302c] font-bold mb-2">
                    本局共有 {roleRevealInfo.totalAccomplices} 位帮凶：
                  </p>
                  <div className="space-y-2">
                    {roleRevealInfo.accomplices?.map((accomplice) => (
                      <div 
                        key={accomplice.number}
                        className={`p-2 rounded ${
                          accomplice.isMe 
                            ? 'bg-[rgba(212,168,83,0.3)] text-[#d4a853]' 
                            : 'text-[#f5f5f5]'
                        }`}
                      >
                        <span className="font-bold">{accomplice.number}号玩家</span>
                        {accomplice.isMe && <span className="text-sm ml-2">（你）</span>}
                        {!accomplice.isMe && <span className="text-sm ml-2 text-[#aaaaaa]">（同伴）</span>}
                      </div>
                    ))}
                  </div>
                  <p className="text-[#aaaaaa] text-sm mt-3">
                    请与同伴配合，保护凶手不被发现
                  </p>
                </div>
              )}
            </div>
          }
          confirmText="确认"
          cancelText=""
          onConfirm={() => setRoleRevealOpen(false)}
          onCancel={() => setRoleRevealOpen(false)}
          type="info"
          singleButton={true}
        />

        {/* 初始位置选择 */}
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
                <p className="text-[#4CAF50]">你可以选择任意房间作为起点（消耗1点行动点）</p>
              )}
            </div>
          }
          confirmText="确定"
          cancelText=""
          onConfirm={() => setInitialSetupOpen(false)}
          onCancel={() => setInitialSetupOpen(false)}
          type="info"
          singleButton={true}
        />

        {/* 移动确认 - 确保显示与实际消耗一致 */}
        <ConfirmDialog
          isOpen={moveConfirmOpen}
          title="确认移动"
          message={
            <div>
              <p>是否移动到 <span className="text-[#d4a853] font-bold">
                {roomFragments.find(r => r.id === pendingMoveTarget)?.name}
              </span>？</p>

              {/* 显示实际消耗的行动点 */}
              {pendingMoveCost !== undefined && pendingMoveCost >= 0 && (
                <p className="mt-2 text-[#aaaaaa]">
                  消耗行动点：<span className="text-[#d4a853] font-bold text-lg">{pendingMoveCost}</span>

                  {/* 显示生命值消耗 */}
                  {pendingHealthCost > 0 && (
                    <span>，生命值：<span className="text-[#c9302c] font-bold">-{pendingHealthCost}</span></span>
                  )}

                  {/* 绳索相关提示 */}
                  {pendingUseRope && pendingHealthCost === 0 && pendingMoveCost > 0 && (
                    <span className="text-[#4CAF50]">（使用绳索免除伤害）</span>
                  )}
                  {pendingUseRope && pendingMoveCost === 0 && (
                    <span className="text-[#4CAF50]">（使用绳索，不消耗行动点）</span>
                  )}

                  {/* 滑雪套装提示 */}
                  {!pendingUseRope && currentPlayer.items?.includes('ski') && isGarden(pendingMoveTarget) && !isGarden(currentPlayer.currentLocation) && (
                    <span className="text-[#4CAF50]">（滑雪套装减免）</span>
                  )}

                  {/* 花园之间移动提示 */}
                  {!pendingUseRope && isGarden(pendingMoveTarget) && isGarden(currentPlayer.currentLocation) && (
                    <span className="text-[#4CAF50]">
                      {currentPlayer.items?.includes('ski') ? '（滑雪套装减免为1点）' : '（花园之间移动2点）'}
                    </span>
                  )}
                </p>
              )}

              {/* 特殊移动提示 */}
              {pendingMoveCost === 0 && !pendingUseRope && (
                <p className="mt-2 text-[#4CAF50]">
                  设置成功，继续行动吧。
                </p>
              )}

              {/* 双移动提示 */}
              {pendingDoubleMove && (
                <p className="mt-2 text-[#d4a853]">可进行双移动</p>
              )}
            </div>
          }
          confirmText="确认移动"
          cancelText="取消"
          onConfirm={confirmMove}
          onCancel={() => setMoveConfirmOpen(false)}
          type="info"
        />

        {/* 双移动选择 */}
        <DoubleMoveDialog
          isOpen={doubleMoveDialogOpen}
          firstMoveTarget={firstMoveTarget}
          options={pendingDoubleMoveOptions}
          onSelect={executeDoubleMove}
          onCancel={cancelDoubleMove}
        />

        {/* 提前结束行动确认 */}
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

        {/* 通用提示 */}
        <AlertDialog
          isOpen={alertOpen}
          title={alertConfig.title}
          message={alertConfig.message}
          onConfirm={() => setAlertOpen(false)}
          type={alertConfig.type}
        />

        {/* 我的信息 */}
        <MyInfoDialog
          isOpen={showMyInfo}
          player={currentPlayer}
          onClose={() => setShowMyInfo(false)}
        />

        {/* 技能 */}
        <SkillDialog
          isOpen={showSkillDialog}
          player={currentPlayer}
          players={players}
          round={round}
          phase={phase}
          onClose={() => setShowSkillDialog(false)}
        />

        {/* 道具 */}
        <ItemsDialog
          isOpen={showItemsDialog}
          player={currentPlayer}
          players={players}
          onClose={() => setShowItemsDialog(false)}
        />

        {/* 投票 */}
        <VoteDialog
          isOpen={showVoteDialog}
          players={players}
          currentPlayer={currentPlayer}
          round={round}
          onVote={(targetId) => {
            vote?.(currentPlayer.id, targetId);
            setShowVoteDialog(false);
            showAlert('投票成功', '已投票', 'info');
          }}
          onClose={() => setShowVoteDialog(false)}
        />
      </div>
    </ErrorBoundary>
  );
}

export default PlayerPanel;
