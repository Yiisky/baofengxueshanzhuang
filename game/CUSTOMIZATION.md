# 暴风雪山庄游戏系统 - 自定义指南

## 🎨 图片替换指南

### 1. 角色图标替换

**文件位置**: `src/data/roles.ts`

**修改方法**:
```typescript
// 找到 getRoleIcon 函数
export function getRoleIcon(role: Role): string {
  switch (role) {
    case 'killer':
      // 从 emoji 改为图片路径
      // return '🔪';
      return '/images/roles/killer.png';
    case 'accomplice':
      return '/images/roles/accomplice.png';
    // ... 其他角色
  }
}
```

**图片存放位置**: `public/images/roles/`

**推荐图片尺寸**: 64x64 像素

---

### 2. 地图背景替换

**文件位置**: `src/sections/HostPanel.tsx` 和 `src/sections/PlayerPanel.tsx`

**修改方法**:
在地图组件的 Card 中添加背景样式：
```tsx
<Card 
  className="bg-[#1a1a1a] border-[#d4a853]"
  style={{
    backgroundImage: 'url(/images/map/background.png)',
    backgroundSize: 'cover',
    backgroundPosition: 'center'
  }}
>
```

**图片存放位置**: `public/images/map/`

**推荐图片尺寸**: 1920x1080 像素

---

### 3. 主题色修改

**文件位置**: `src/App.css`

**主要颜色变量**:
```css
:root {
  /* 背景色 */
  --bg-primary: #0a0a0a;    /* 主背景 */
  --bg-secondary: #1a1a1a;  /* 卡片背景 */
  --bg-tertiary: #2a2a2a;   /* 输入框背景 */
  
  /* 主题色 */
  --gold: #d4a853;          /* 金色（主色调） */
  --gold-dark: #c49a4b;     /* 金色（悬停） */
  
  /* 阵营色 */
  --killer: #c9302c;        /* 凶手阵营 - 红色 */
  --detective: #5bc0de;     /* 侦探阵营 - 蓝色 */
  
  /* 状态色 */
  --success: #2ca02c;       /* 成功 - 绿色 */
  --error: #c9302c;         /* 错误 - 红色 */
  --warning: #d4a853;       /* 警告 - 金色 */
}
```

**修改示例**:
```css
/* 修改金色为紫色 */
--gold: #9b59b6;
--gold-dark: #8e44ad;
```

---

### 4. 字体修改

**文件位置**: `index.html`

**添加字体链接**:
```html
<head>
  <!-- 添加 Google Fonts -->
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700&display=swap" rel="stylesheet">
</head>
```

**在 Tailwind 配置中修改**:
```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        serif: ['Noto Serif SC', 'serif'],
        sans: ['Noto Sans SC', 'sans-serif'],
      },
    },
  },
}
```

---

### 5. 添加音效

**文件位置**: `src/hooks/useSound.ts` (新建)

```typescript
export function useSound() {
  const playSound = (soundName: string) => {
    const audio = new Audio(`/sounds/${soundName}.mp3`);
    audio.play();
  };
  
  return { playSound };
}
```

**使用示例**:
```tsx
const { playSound } = useSound();

<Button onClick={() => playSound('click')}>
  点击播放音效
</Button>
```

**音效存放位置**: `public/sounds/`

---

## 🔧 常用修改点

### 修改游戏轮数

**文件位置**: `src/store/websocketStore.ts`

搜索 `round >= 5`，修改为需要的轮数。

### 修改初始生命值

**文件位置**: `src/store/websocketStore.ts`

搜索 `health: 3`，修改为需要的数值。

### 修改初始行动点

**文件位置**: `src/store/websocketStore.ts`

搜索 `actionPoints: 8`，修改为需要的数值。

### 修改房间码长度

**文件位置**: `server/websocket-server.js`

搜索 `ROOM_CODE_LENGTH = 4`，修改为需要的位数。

---

## 📁 文件结构说明

```
app/
├── public/                    # 静态资源（可直接访问）
│   ├── images/               # 图片
│   │   ├── roles/           # 角色图标
│   │   ├── map/             # 地图背景
│   │   └── ui/              # UI元素
│   ├── sounds/              # 音效
│   └── fonts/               # 字体
│
├── src/
│   ├── sections/            # 页面区块（主要修改处）
│   │   ├── Lobby.tsx        # 大厅界面
│   │   ├── HostPanel.tsx    # 主持人界面
│   │   ├── PlayerPanel.tsx  # 玩家界面
│   │   └── GameEnd.tsx      # 游戏结束界面
│   │
│   ├── store/               # 状态管理
│   │   ├── websocketStore.ts # 游戏状态（一般不改）
│   │   └── gameStore.ts      # 本地状态（备用）
│   │
│   ├── hooks/               # 自定义Hooks
│   │   ├── useWebSocket.ts  # WebSocket连接
│   │   └── useSound.ts      # 音效（可选）
│   │
│   ├── data/                # 静态数据
│   │   ├── locations.ts     # 地图数据
│   │   └── roles.ts         # 角色数据（可改图标）
│   │
│   ├── types/               # 类型定义
│   │   └── game.ts          # 游戏类型
│   │
│   ├── App.tsx              # 主应用
│   ├── App.css              # 全局样式（可改主题色）
│   └── main.tsx             # 入口文件
│
├── server/                  # 后端服务器
│   ├── websocket-server.js  # WebSocket服务器
│   └── package.json         # 后端依赖
│
├── package.json             # 前端依赖
├── vite.config.ts           # Vite配置
├── tailwind.config.js       # Tailwind配置
└── index.html               # HTML模板
```

---

## 🚀 部署步骤

### 1. 安装依赖

```bash
# 前端依赖
cd app
npm install

# 后端依赖
cd server
npm install
```

### 2. 修改服务器地址

**文件**: `src/store/websocketStore.ts`

```typescript
// 修改为你的电脑IP地址
const SERVER_URL = 'ws://192.168.1.100:8080';
```

### 3. 启动服务器

```bash
cd server
node websocket-server.js
```

### 4. 启动前端

```bash
cd app
npm run dev
```

### 5. 访问游戏

- 主持人电脑: http://192.168.1.100:5173
- 玩家Pad: http://192.168.1.100:5173

---

## 💡 常见问题

### Q: 如何修改游戏角色？

A: 修改 `src/data/roles.ts` 中的 `roleConfigs` 数组。

### Q: 如何添加新地点？

A: 修改 `src/data/locations.ts` 中的 `locations` 数组。

### Q: 如何修改游戏规则？

A: 修改 `server/websocket-server.js` 中的游戏逻辑。

### Q: 如何添加新道具？

A: 
1. 在 `src/types/game.ts` 中添加新道具类型
2. 在 `src/data/locations.ts` 中添加获取地点
3. 在 UI 中添加道具图标

### Q: 如何修改UI布局？

A: 修改 `src/sections/` 目录下的组件文件。

---

## 📞 技术支持

如有问题，请检查：
1. 所有设备是否在同一WiFi网络
2. 防火墙是否开放了8080端口
3. 服务器IP地址是否正确
