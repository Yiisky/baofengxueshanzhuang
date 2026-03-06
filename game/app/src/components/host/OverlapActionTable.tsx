// src/components/host/OverlapActionTable.tsx
/**
 * 重叠行动线表格组件
 * 显示亮灯地点和荧光粉地点的重叠行动线
 * 修改：只公示被撒了荧光粉的玩家的行动线 或者 亮灯地点的重叠行动线
 * 规则：如果有重叠时间线，但该区域未亮灯则不进行公示；如果房间亮灯，但该房间无重叠时间线则不进行公示
 */

import React, { useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, Lightbulb, Sparkles, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Player } from '@/types/game';

interface OverlappingAction {
  step: number;
  locationId: string;
  locationName: string;
  playerIds: string[];
  playerNames: string[];
  isPowderLocation: boolean;
}

interface OverlapActionTableProps {
  players: Player[];
  lightLocations: string[];
  powderTarget: string | null;
  title?: string;
}

export function OverlapActionTable({ 
  players, 
  lightLocations, 
  powderTarget,
  title = "重叠行动线" 
}: OverlapActionTableProps) {
  
  // 计算重叠行动线
  const overlaps = useMemo(() => {
    const step1_4: OverlappingAction[] = [];
    const step5_8: OverlappingAction[] = [];

    // 获取荧光粉目标玩家的行动线地点
    const powderTargetPlayer = powderTarget ? players.find(p => p.id === powderTarget) : null;
    const powderLocationIds = powderTargetPlayer 
      ? [...new Set(powderTargetPlayer.actionLine?.map(s => s.locationId) || [])]
      : [];

    // 按步骤分组检查重叠（1-8步）
    for (let stepNum = 1; stepNum <= 8; stepNum++) {
      const stepOverlaps = new Map<string, string[]>(); // locationId -> playerIds

      players.forEach(p => {
        // 虚弱状态玩家不参与行动线重叠结算
        if (p.isWeakened || p.health === 0) return;
        
        const stepAtNum = p.actionLine?.find(s => s.step === stepNum);
        if (stepAtNum) {
          const locId = stepAtNum.locationId;
          if (!stepOverlaps.has(locId)) {
            stepOverlaps.set(locId, []);
          }
          stepOverlaps.get(locId)!.push(p.id);
        }
      });

      // 检查每个地点是否有重叠（2人及以上）
      stepOverlaps.forEach((playerIds, locId) => {
        if (playerIds.length >= 2) {
          // 关键修复：只公示以下两种情况：
          // 1. 亮灯地点的重叠行动线
          // 2. 荧光粉玩家行动线经过的地点的重叠行动线
          const isLightLocation = lightLocations.includes(locId);
          const isPowderLocation = powderLocationIds.includes(locId);
          
          // 如果该地点既不是亮灯地点也不是荧光粉地点，则不公示
          if (!isLightLocation && !isPowderLocation) return;

          const playerNames = playerIds.map(id => {
            const p = players.find(p => p.id === id);
            return p?.name || '未知';
          });

          const overlap: OverlappingAction = {
            step: stepNum,
            locationId: locId,
            locationName: getLocationName(locId),
            playerIds: playerIds,
            playerNames: playerNames,
            isPowderLocation: isPowderLocation
          };

          // 分类存储
          if (stepNum <= 4) {
            step1_4.push(overlap);
          } else {
            step5_8.push(overlap);
          }
        }
      });
    }

    return { step1_4, step5_8 };
  }, [players, lightLocations, powderTarget]);

  // 获取地点名称
  function getLocationName(locationId: string): string {
    const locationMap: Record<string, string> = {
      'attic_main': '阁楼大厅',
      'attic_therapy': '理疗室',
      'attic_balcony': '阁楼阳台',
      'second_storage': '储物室',
      'second_control': '中控室',
      'second_tool': '工具间',
      'second_corridor': '二楼走廊',
      'second_bedroom_b': 'B卧室',
      'second_bedroom_a': 'A卧室',
      'second_crime': '第二案发现场',
      'second_balcony_north': '北阳台',
      'second_balcony': '南阳台',
      'first_dining': '餐厅',
      'first_crime': '第一案发现场',
      'first_corridor': '一楼走廊',
      'first_living_b': 'B客厅',
      'first_living_a': 'A客厅',
      'first_cloakroom': '衣帽间',
      'first_hall': '一楼大厅',
      'first_garden_north': '北花园',
      'first_garden_east': '东花园',
      'first_garden_south': '南花园',
      'basement_north': '地下室北走廊',
      'basement_south': '地下室南走廊',
      'basement_storage': '杂物间',
    };
    return locationMap[locationId] || locationId;
  }

  // 渲染重叠列表
  const renderOverlapList = (overlaps: OverlappingAction[]) => {
    if (overlaps.length === 0) {
      return (
        <div className="text-center py-4 text-muted-foreground text-sm">
          <AlertCircle className="w-4 h-4 mx-auto mb-1" />
          无重叠行动线
        </div>
      );
    }

    return overlaps.map((overlap, index) => (
      <div 
        key={`${overlap.step}-${overlap.locationId}-${index}`}
        className={cn(
          "p-2 rounded-lg border mb-2",
          overlap.isPowderLocation 
            ? "bg-yellow-50 border-yellow-200" 
            : "bg-blue-50 border-blue-200"
        )}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              第{overlap.step}步
            </Badge>
            <span className="font-medium text-sm">{overlap.locationName}</span>
          </div>
          <div className="flex items-center gap-1">
            {overlap.isPowderLocation && (
              <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">
                <Sparkles className="w-3 h-3 mr-1" />
                荧光粉
              </Badge>
            )}
            {!overlap.isPowderLocation && lightLocations.includes(overlap.locationId) && (
              <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                <Lightbulb className="w-3 h-3 mr-1" />
                亮灯
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Users className="w-3 h-3" />
          <span>{overlap.playerNames.join('、')}</span>
        </div>
      </div>
    ));
  };

  const hasAnyOverlaps = overlaps.step1_4.length > 0 || overlaps.step5_8.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Users className="w-5 h-5" />
          {title}
        </h3>
        <div className="text-sm text-muted-foreground">
          {hasAnyOverlaps ? `${overlaps.step1_4.length + overlaps.step5_8.length} 处重叠` : '无重叠'}
        </div>
      </div>

      {/* 公示规则说明 */}
      <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
        <p className="flex items-center gap-1">
          <Lightbulb className="w-3 h-3" />
          只公示：亮灯地点的重叠行动线 或 荧光粉玩家行动线经过的地点
        </p>
      </div>

      {!hasAnyOverlaps ? (
        <div className="text-center py-8 text-muted-foreground">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>当前轮次没有需要公示的重叠行动线</p>
          <p className="text-xs mt-1">（亮灯地点或荧光粉地点无重叠）</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {/* 1-4步重叠 */}
          <div className="border rounded-lg p-3">
            <h4 className="font-medium text-sm mb-2 flex items-center gap-1">
              <Badge variant="outline" className="text-xs">1-4步</Badge>
              <span className="text-muted-foreground">({overlaps.step1_4.length})</span>
            </h4>
            <ScrollArea className="h-[200px]">
              {renderOverlapList(overlaps.step1_4)}
            </ScrollArea>
          </div>

          {/* 5-8步重叠 */}
          <div className="border rounded-lg p-3">
            <h4 className="font-medium text-sm mb-2 flex items-center gap-1">
              <Badge variant="outline" className="text-xs">5-8步</Badge>
              <span className="text-muted-foreground">({overlaps.step5_8.length})</span>
            </h4>
            <ScrollArea className="h-[200px]">
              {renderOverlapList(overlaps.step5_8)}
            </ScrollArea>
          </div>
        </div>
      )}

      {/* 图例 */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-yellow-50 border border-yellow-200" />
          <span>荧光粉地点</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-blue-50 border border-blue-200" />
          <span>亮灯地点</span>
        </div>
      </div>
    </div>
  );
}
