# 暴风雪山庄游戏系统 - WebSocket架构方案

## 📋 系统架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                         局域网环境                                │
│                                                                  │
│  ┌─────────────┐         ┌─────────────┐         ┌───────────┐  │
│  │  主持人电脑  │◄───────►│ WebSocket   │◄───────►│  玩家Pad  │  │
│  │  (前端界面)  │         │  服务器     │         │ (10台)    │  │
│  └─────────────┘         └─────────────┘         └───────────┘  │
│         │                       │                       │        │
│         │                       │                       │        │
│    创建房间                 转发消息                 加入房间    │
│    控制流程                 同步状态                 执行操作    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 🏗️ 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 后端 | Node.js + ws | WebSocket服务器 |
| 前端 | React + 原生WebSocket | 游戏界面 |
| 通信 | JSON协议 | 消息格式 |
| 部署 | 局域网IP | 无需公网 |

## 📡 消息协议设计

### 1. 客户端 → 服务器

```javascript
// 创建房间
{ type: 'CREATE_ROOM', hostId: 'xxx', playerName: '主持人' }

// 加入房间
{ type: 'JOIN_ROOM', roomCode: 'ABCD', playerName: '玩家1' }

// 设置身份（仅主持人）
{ type: 'SET_ROLE', playerId: 'xxx', role: 'killer' }

// 开始游戏
{ type: 'START_GAME' }

// 玩家行动
{ type: 'PLAYER_ACTION', action: 'MOVE', locationId: 'xxx' }

// 投凶
{ type: 'VOTE', targetId: 'xxx' }

// 发起交易
{ type: 'CREATE_TRADE', toPlayerId: 'xxx', offerItem: 'bandage', requestItem: 'powder' }

// 响应交易
{ type: 'RESPOND_TRADE', tradeId: 'xxx', accept: true }

// 使用技能
{ type: 'USE_SKILL', targetId: 'xxx' }

// 进入下一阶段
{ type: 'NEXT_PHASE' }
```

### 2. 服务器 → 客户端

```javascript
// 房间创建成功
{ type: 'ROOM_CREATED', roomCode: 'ABCD', playerId: 'xxx' }

// 玩家加入
{ type: 'PLAYER_JOINED', player: { id, name, role } }

// 游戏状态更新（广播给所有人）
{ type: 'GAME_STATE', state: { round, phase, players, ... } }

// 错误消息
{ type: 'ERROR', message: 'xxx' }

// 系统通知
{ type: 'NOTIFICATION', message: 'xxx', type: 'info|success|warning' }
```

## 🔄 状态同步机制

### 1. 主机模式（Host-Authoritative）
- 只有主持人可以修改游戏核心状态
- 玩家只能发送请求，由主持人确认后执行
- 防止作弊，保证游戏公平

### 2. 状态广播
- 任何状态变更后，服务器广播给所有连接的客户端
- 客户端收到后更新本地状态，UI自动刷新

### 3. 断线重连
- 客户端断线后，重新连接并发送房间码
- 服务器返回当前完整游戏状态
- 玩家可以继续游戏

## 🌐 局域网部署

### 1. 获取电脑IP地址
```bash
# Windows
ipconfig
# 查看 "IPv4 地址"，例如：192.168.1.100

# Mac/Linux
ifconfig
# 查看 inet 地址
```

### 2. 启动服务器
```bash
# 在主持人电脑上运行
node server/websocket-server.js
# 服务器启动在 ws://192.168.1.100:8080
```

### 3. 所有设备连接
- 主持人电脑：访问 http://192.168.1.100:3000
- 玩家Pad：访问 http://192.168.1.100:3000
- 所有设备在同一WiFi下即可

## 📁 文件结构

```
app/
├── src/
│   ├── components/          # UI组件
│   │   └── ui/             # shadcn/ui组件（无需修改）
│   │
│   ├── sections/           # 页面区块（可修改）
│   │   ├── Lobby.tsx       # 大厅界面
│   │   ├── HostPanel.tsx   # 主持人界面
│   │   ├── PlayerPanel.tsx # 玩家界面
│   │   └── GameEnd.tsx     # 游戏结束界面
│   │
│   ├── store/              # 状态管理
│   │   ├── gameStore.ts    # 游戏状态（需修改）
│   │   └── websocketStore.ts # WebSocket连接（新增）
│   │
│   ├── hooks/              # 自定义Hooks
│   │   └── useWebSocket.ts # WebSocket Hook（新增）
│   │
│   ├── types/              # 类型定义
│   │   └── game.ts         # 游戏类型
│   │
│   ├── data/               # 静态数据
│   │   ├── locations.ts    # 地图数据
│   │   └── roles.ts        # 角色数据
│   │
│   ├── assets/             # 图片资源（可替换）
│   │   ├── images/         # 游戏图片
│   │   └── icons/          # 图标
│   │
│   ├── App.tsx             # 主应用
│   ├── App.css             # 全局样式
│   └── main.tsx            # 入口文件
│
├── server/                 # 后端服务器（新增）
│   ├── websocket-server.js # WebSocket服务器
│   └── package.json        # 后端依赖
│
├── public/                 # 静态资源
│   └── ...
│
├── package.json            # 前端依赖
├── vite.config.ts          # Vite配置
└── index.html              # HTML模板
```

## 🎨 图片替换指南

### 1. 角色图标替换
位置：`src/data/roles.ts` 中的 `getRoleIcon` 函数
```typescript
export function getRoleIcon(role: Role): string {
  switch (role) {
    case 'killer':
      return '🔪';  // ← 替换为图片路径，如 '/images/killer.png'
    // ...
  }
}
```

### 2. 地图背景替换
位置：`src/sections/HostPanel.tsx` 和 `PlayerPanel.tsx`
在地图组件中添加背景图片样式

### 3. UI主题色替换
位置：`src/App.css`
修改CSS变量中的颜色值

## 🔧 关键修改点标注

### 1. 添加WebSocket支持
**文件**: `src/hooks/useWebSocket.ts` (新建)
**作用**: 封装WebSocket连接逻辑
**修改频率**: 低（框架代码，一般不需要改）

### 2. 修改状态管理
**文件**: `src/store/websocketStore.ts` (新建)
**作用**: 将本地状态改为通过WebSocket同步
**修改频率**: 中（根据游戏规则调整）

### 3. 修改UI组件
**文件**: `src/sections/*.tsx`
**作用**: 游戏界面
**修改频率**: 高（可根据需求自定义）

### 4. 后端服务器
**文件**: `server/websocket-server.js` (新建)
**作用**: 处理所有客户端连接和消息转发
**修改频率**: 低（除非要改游戏规则）

## ⚠️ 注意事项

1. **防火墙设置**: 确保8080端口（WebSocket）和3000端口（HTTP）开放
2. **WiFi稳定性**: 建议使用稳定的局域网，避免游戏过程中断网
3. **浏览器兼容性**: 推荐使用Chrome/Safari最新版本
4. **数据安全**: 局域网内通信，数据不会外泄

## 🚀 启动步骤

1. 安装依赖: `npm install`
2. 启动WebSocket服务器: `node server/websocket-server.js`
3. 启动前端开发服务器: `npm run dev`
4. 所有设备访问主持人电脑的IP地址
