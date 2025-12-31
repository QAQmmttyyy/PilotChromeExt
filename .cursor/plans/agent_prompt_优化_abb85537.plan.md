---
name: Agent Prompt 优化
overview: 在 agent.ts 的两个 prompt 中添加单页模式约束和跨页面数据传递 API 说明，让 AI 能正确划分步骤和传递数据。
todos:
  - id: update-steps-prompt
    content: 更新 STEPS_SYSTEM_PROMPT 添加单页约束规则和示例
    status: completed
  - id: update-script-prompt
    content: 更新 SCRIPT_SYSTEM_PROMPT 添加跨步骤数据传递 API 说明
    status: completed
    dependencies:
      - update-steps-prompt
---

# Agent Prompt 优化计划

## 核心改动文件

[src/lib/agent.ts](src/lib/agent.ts)---

## 改动点 1：STEPS_SYSTEM_PROMPT（第48-76行）

**问题**：AI 不知道 page-agent 只能在单页内操作，可能生成会触发中途导航的步骤。**修改内容**：在"重要规则"部分添加单页约束：

```javascript
## 重要规则
1. 每个 ai_step 应该是一个原子操作（单一动作）
2. **单页约束**：page-agent 只能操作当前页面，一个 ai_step 执行中不能触发页面导航
                - 如果某操作会导致页面跳转（如点击链接），应作为当前页面的最后一个步骤
                - 按页面边界划分步骤：同一页面的操作放在一起，跳转后的操作作为新步骤
3. 如果用户未指定起始 URL，根据任务推断合理的起始页面
4. 操作指令要清晰、具体，包含目标元素的描述
5. 不要返回任何解释，只返回 JSON 数组
```

**优化示例**（修正现有示例的问题）：

```json
用户：打开百度搜索 "AI"，然后点击第一个结果，获取页面标题

输出：
[
  { "type": "navigate", "url": "https://www.baidu.com" },
  { "type": "ai_step", "value": "在搜索框中输入 'AI'" },
  { "type": "ai_step", "value": "点击搜索按钮" },
  { "type": "ai_step", "value": "点击第一个搜索结果链接" },
  { "type": "ai_step", "value": "获取当前页面的标题" }
]
```

说明：点击链接后页面跳转，"获取页面标题"是新页面的操作，作为独立步骤。---

## 改动点 2：SCRIPT_SYSTEM_PROMPT（第79-153行）

**问题**：AI 不知道如何在步骤间传递数据。**关键发现**：`pageAgent.execute()` 返回 `Promise<ExecutionResult>`：

```typescript
interface ExecutionResult {
    success: boolean;
    data: string;       // ← 提取的数据在这里
    history: AgentHistory[];
}
```

**修改内容**：在输出契约中添加数据传递 API：

```javascript
7. **跨步骤数据传递**：
            - `pageAgent.execute()` 返回 `{ success, data, history }`，`data` 是提取的数据（字符串）
            - 传递数据给下一步：`window.Pilot.workflow.next({ key: value })`
            - 读取上一步传递的数据：`window.PilotData.key`
   
   **示例：提取数据并传递**
   \`\`\`
   const result = await window.pageAgent.execute("获取页面标题");
   window.Pilot.workflow.next({ pageTitle: result.data });
   \`\`\`
   
   **示例：使用上一步的数据**
   \`\`\`
   // 将数据作为上下文 block 拼接到指令中，pageAgent 内部 AI 会理解
   const title = window.PilotData?.pageTitle || '';
   await window.pageAgent.execute(\`在搜索框中输入上一步获取的标题\n\n[数据]\n标题: \${title}\`);
   window.Pilot.workflow.next();
   \`\`\`
```

---

## 预期效果