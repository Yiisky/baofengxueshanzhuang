# 暴风雪山庄游戏系统 v2.0

支持10人实时对战的线下游戏辅助系统，采用WebSocket实现多设备同步。

## 📋 系统要求

- **主持人电脑**: Windows/Mac/Linux，安装Node.js
- **玩家设备**: 10台Pad或手机，支持现代浏览器
- **网络**: 所有设备在同一WiFi网络下

## 🚀 快速开始

### 1. 获取IP地址

在主持人电脑上运行：

```bash
# Windows
ipconfig
# 查看 "IPv4 地址"，例如：192.168.1.100

# Mac/Linux
ifconfig
# 查看 inet 地址
```

### 2. 安装依赖

```bash
# 进入项目目录
cd app

# 安装前端依赖
npm install

# 安装后端依赖
cd server
npm install
cd ..
```

### 3. 修改服务器地址

编辑 `src/store/websocketStore.ts`：

```typescript
// 修改为你的电脑IP地址
const SERVER_URL = 'ws://192.168.1.100:8080';
```

### 4. 启动服务器

```bash
# 新开一个终端窗口
cd server
node websocket-server.js

# 看到以下输出表示成功：
# 服务器地址: ws://192.168.1.100:8080
```

### 5. 启动前端

```bash
# 新开一个终端窗口
cd app
npm run dev

# 看到以下输出表示成功：
# Local: http://localhost:5173/
# Network: http://192.168.1.100:5173/
```

### 6. 开始游戏

1. **主持人**: 访问 `http://192.168.1.100:5173`
2. 选择"我是主持人"，输入名称
3. 系统生成4位房间码
4. **玩家**: 在Pad上访问同一地址
5. 输入房间码和玩家名称加入
6. 主持人设置玩家身份
7. 点击"开始游戏"

## 📁 项目结构

```
app/
├── src/
│   ├── sections/           # 游戏界面
│   │   ├── Lobby.tsx       # 大厅
│   │   ├── HostPanel.tsx   # 主持人界面
│   │   ├── PlayerPanel.tsx # 玩家界面
│   │   └── GameEnd.tsx     # 游戏结束
│   │
│   ├── store/              # 状态管理
│   │   └── websocketStore.ts
│   │
│   ├── hooks/              # WebSocket Hook
│   │   └── useWebSocket.ts
│   │
│   ├── data/               # 游戏数据
│   │   ├── locations.ts    # 地图数据
│   │   └── roles.ts        # 角色数据
│   │
│   └── App.tsx             # 主应用
│
├── server/                 # WebSocket服务器
│   └── websocket-server.js
│
└── package.json
```

## 🎮 游戏流程

1. **创建房间**: 主持人创建，生成房间码
2. **玩家加入**: 10名玩家输入房间码加入
3. **设置身份**: 主持人分配角色（凶手、侦探等）
4. **开始游戏**: 共5轮，每轮3个阶段

### 游戏阶段

- **自由阶段**: 玩家交流、交易道具
- **行动阶段**: 规划8步行动、投凶
- **结算阶段**: 计算伤害、公示信息

## 🔧 自定义配置

### 修改服务器端口

**文件**: `server/websocket-server.js`

```javascript
const PORT = 8080;  // 修改为你想要的端口
```

### 修改主题色

**文件**: `src/App.css`

```css
--gold: #d4a853;      /* 主色调 */
--killer: #c9302c;    /* 凶手阵营 */
--detective: #5bc0de; /* 侦探阵营 */
```

### 修改角色图标

**文件**: `src/data/roles.ts`

```typescript
export function getRoleIcon(role: Role): string {
  switch (role) {
    case 'killer':
      return '/images/roles/killer.png';  // 改为图片路径
  }
}
```

## 📖 详细文档

- [架构设计](ARCHITECTURE.md) - 系统架构和协议设计
- [自定义指南](CUSTOMIZATION.md) - 图片替换、主题修改

## ⚠️ 常见问题

### Q: 无法连接到服务器？

A: 检查以下几点：
1. 服务器是否已启动
2. 防火墙是否开放了8080端口
3. 所有设备是否在同一WiFi
4. IP地址是否正确

### Q: 玩家无法加入房间？

A: 检查房间码是否正确，游戏是否已开始。

### Q: 如何修改游戏规则？

A: 修改 `server/websocket-server.js` 中的游戏逻辑。

## 📄 许可证

MIT License
