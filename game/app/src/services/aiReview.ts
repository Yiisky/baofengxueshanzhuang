/**
 * ============================================
 * AI复盘服务 - 使用KIMI API生成游戏复盘
 * ============================================
 * 
 * 【文件说明】
 * - 调用KIMI AI API生成游戏复盘
 * - 分析玩家操作、精彩时刻、胜负关键
 * 
 * 【如何修改】
 * - 修改API密钥：修改 KIMI_API_KEY 常量
 * - 修改复盘风格：修改 generateReviewPrompt 函数中的 prompt
 * ============================================
 */

import type { Player } from '@/types/game';

// ============================================================
// 【API配置】KIMI API密钥
// ============================================================
// 请替换为你的API密钥
const KIMI_API_KEY = 'sk-wQlmUP2Csm7PIYkMQvpsiiTGPtblobfIHwaPhrJSJY31IXEw';
const KIMI_API_URL = 'https://api.moonshot.cn/v1/chat/completions';
const KIMI_MODEL = 'moonshot-v1-8k';

/**
 * 生成复盘Prompt
 * @param players 玩家数据
 * @param winner 获胜阵营
 * @param round 游戏轮数
 */
function generateReviewPrompt(players: Player[], winner: 'killer' | 'detective', round: number): string {
  const killerCamp = players.filter(p => p.camp === 'killer');
  const detectiveCamp = players.filter(p => p.camp === 'detective');
  
  const playerDetails = players.map(p => ({
    name: p.name,
    role: p.role,
    camp: p.camp,
    isAlive: p.isAlive,
    score: p.score,
    health: p.health,
    maxHealth: p.maxHealth,
    totalVotesCorrect: p.totalVotesCorrect || 0,
    visitedLocations: p.visitedLocations || []
  }));

  return `请为一场"暴风雪山庄"线下推理游戏生成精彩的复盘分析。

## 游戏基本信息
- 游戏轮数: ${round}轮
- 获胜阵营: ${winner === 'killer' ? '凶手阵营' : '侦探阵营'}

## 玩家数据
${JSON.stringify(playerDetails, null, 2)}

## 阵营统计
- 凶手阵营: ${killerCamp.length}人，存活${killerCamp.filter(p => p.isAlive).length}人，总得分${killerCamp.reduce((sum, p) => sum + (p.isAlive ? p.score : 0), 0)}
- 侦探阵营: ${detectiveCamp.length}人，存活${detectiveCamp.filter(p => p.isAlive).length}人，总得分${detectiveCamp.reduce((sum, p) => sum + (p.isAlive ? p.score : 0), 0)}

## 请生成以下内容：

1. **游戏概述**（100字左右）
   - 简述游戏过程和最终结果

2. **精彩操作点评**（每个玩家1-2句话）
   - 分析每个玩家的亮点和不足
   - 特别表扬投凶正确的玩家

3. **胜负关键点分析**
   - 分析导致胜负的关键因素
   - 指出双方阵营的优劣势

4. **MVP评选**
   - 选出本局游戏的MVP（最有价值玩家）
   - 说明理由

5. **改进建议**
   - 给凶手阵营的建议
   - 给侦探阵营的建议

请用生动有趣的语言，像游戏解说一样撰写复盘。`;
}

/**
 * 调用KIMI API生成复盘
 * @param players 玩家数据
 * @param winner 获胜阵营
 * @param round 游戏轮数
 */
export async function generateAIReview(
  players: Player[], 
  winner: 'killer' | 'detective', 
  round: number
): Promise<string> {
  try {
    const prompt = generateReviewPrompt(players, winner, round);
    
    const response = await fetch(KIMI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KIMI_API_KEY}`
      },
      body: JSON.stringify({
        model: KIMI_MODEL,
        messages: [
          {
            role: 'system',
            content: '你是一位专业的桌游解说员，擅长分析推理游戏并为玩家生成精彩的复盘。你的语言生动有趣，善于发现玩家的精彩操作。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.8,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('KIMI API错误:', errorData);
      throw new Error(`API请求失败: ${response.status}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '生成复盘失败，请重试';
  } catch (error) {
    console.error('AI复盘生成失败:', error);
    return `生成复盘时出错: ${error instanceof Error ? error.message : '未知错误'}\n\n请检查API密钥是否正确，或稍后重试。`;
  }
}

/**
 * 生成简单的本地复盘（当API不可用时使用）
 * @param players 玩家数据
 * @param winner 获胜阵营
 * @param round 游戏轮数
 */
export function generateLocalReview(
  players: Player[], 
  winner: 'killer' | 'detective', 
  round: number
): string {
  const killerCamp = players.filter(p => p.camp === 'killer');
  const detectiveCamp = players.filter(p => p.camp === 'detective');
  
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const mvp = sortedPlayers[0];
  
  const correctVoters = players.filter(p => p.totalVotesCorrect && p.totalVotesCorrect > 0);
  
  let review = `## 🎮 暴风雪山庄 - 游戏复盘\n\n`;
  
  // 游戏概述
  review += `### 📋 游戏概述\n\n`;
  review += `经过${round}轮的激烈对抗，**${winner === 'killer' ? '凶手阵营' : '侦探阵营'}**最终获得了胜利！\n\n`;
  
  // 阵营统计
  review += `### 📊 阵营统计\n\n`;
  review += `- **凶手阵营**: ${killerCamp.length}人，存活${killerCamp.filter(p => p.isAlive).length}人\n`;
  review += `- **侦探阵营**: ${detectiveCamp.length}人，存活${detectiveCamp.filter(p => p.isAlive).length}人\n\n`;
  
  // MVP
  review += `### 👑 本局MVP\n\n`;
  review += `**${mvp.name}** 以 ${mvp.score} 分的高分获得MVP！\n\n`;
  
  // 精彩操作
  review += `### ⭐ 精彩操作\n\n`;
  
  if (correctVoters.length > 0) {
    review += `**投凶高手**: ${correctVoters.map(p => `${p.name}(${p.totalVotesCorrect}次正确)`).join('、')}\n\n`;
  }
  
  sortedPlayers.slice(0, 3).forEach((p, i) => {
    const titles = ['🥇 冠军', '🥈 亚军', '🥉 季军'];
    review += `${titles[i]} **${p.name}** - 得分: ${p.score}，${p.isAlive ? '存活' : '出局'}\n`;
  });
  
  review += `\n### 💡 胜负分析\n\n`;
  if (winner === 'killer') {
    review += `凶手阵营凭借出色的隐藏和配合，成功骗过了侦探们的眼睛。`;
  } else {
    review += `侦探阵营通过缜密的推理和精准的投凶，成功识破了凶手的伪装。`;
  }
  
  review += `\n\n---\n*注：此为本地生成的简化复盘。连接网络后可使用AI生成更详细的复盘分析。*`;
  
  return review;
}
