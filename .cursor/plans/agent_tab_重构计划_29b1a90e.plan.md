---
name: Agent Tab 重构计划
overview: 将 Side Panel 重构为 Tabs 视图（Agent + Scripts），使用 Vercel AI SDK 构建基于 tool calling 的 Agent 服务，实现用户描述到自动化执行的完整流程。
todos:
  - id: install-deps
    content: 安装 Vercel AI SDK 依赖 (ai, @ai-sdk/openai)
    status: completed
  - id: update-storage
    content: 更新 Script 接口，增加 steps 字段
    status: completed
  - id: create-agent
    content: 创建 agent.ts，实现 Agent 核心和三个 Tools
    status: completed
    dependencies:
      - install-deps
  - id: create-tabs
    content: 创建 Tabs 组件
    status: completed
  - id: create-agent-tab
    content: 创建 AgentTab 组件（输入框 + 执行面板 + 步骤预览）
    status: completed
    dependencies:
      - create-agent
      - create-tabs
  - id: refactor-sidepanel
    content: 重构 App.tsx，整合 Tabs 视图
    status: completed
    dependencies:
      - create-agent-tab
---

# Side Panel Agent 模式重构

## 架构概览

```mermaid
flowchart LR
    subgraph UI [Side Panel]
        Tabs[Tabs 组件]
        AgentTab[Agent Tab]
        ScriptsTab[Scripts Tab]
    end
    
    subgraph AgentService [Agent 服务层]
        AgentCore[Agent Core]
        Tool1[generate_steps Tool]
        Tool2[generate_script Tool]  
        Tool3[run_workflow Tool]
    end
    
    subgraph Backend [Background]
        Workflow[Workflow Engine]
        Storage[Chrome Storage]
    end
    
    Tabs --> AgentTab
    Tabs --> ScriptsTab
    AgentTab --> AgentCore
    AgentCore --> Tool1
    AgentCore --> Tool2
    AgentCore --> Tool3
    Tool2 -.-> |复用| ai.ts
    Tool3 --> Workflow
    ScriptsTab --> Storage
```



## 1. 安装依赖

```bash
npm install ai @ai-sdk/openai
```

Vercel AI SDK 通过 OpenAI-compatible provider 支持 OpenRouter。

## 2. 创建 Agent 服务层

新建 [`src/lib/agent.ts`](src/lib/agent.ts)，包含：

- **Agent 核心**：基于 Vercel AI SDK 的 `generateText` with tools
- **三个 Tools**：
- `generate_steps`: 用户描述 → steps record（只含 `navigate` 和 `ai_step` 类型）
- `generate_script`: steps → 可执行 JavaScript 脚本（复用现有 `ai.ts` 的 prompt 和逻辑）
- `run_workflow`: 调用 background 的 workflow 引擎执行

## 3. 更新数据结构

修改 [`src/lib/storage.ts`](src/lib/storage.ts)：

```typescript
export interface Script {
  // ... 现有字段
  steps?: RecordedStep[];  // 新增：存放 agent 生成的 steps
}
```



## 4. Side Panel UI 重构

修改 [`src/sidepanel/App.tsx`](src/sidepanel/App.tsx)：

- 顶层添加 **Tabs 组件**（Agent | Scripts）
- **Agent Tab**（新增）：
- 简洁输入框（用户描述任务）
- 执行状态面板（可展开，显示当前 tool 调用、steps 生成进度）
- 步骤预览（nav/ai_step 列表）
- 执行按钮
- **Scripts Tab**：
- 保留现有脚本列表视图和编辑器视图
- 可复用 `RecordingPanel`、`SettingsPanel` 等组件

## 5. Agent 执行流程

```mermaid
sequenceDiagram
    participant User
    participant AgentTab
    participant AgentCore
    participant Tool_Steps as generate_steps
    participant Tool_Script as generate_script
    participant Tool_Run as run_workflow
    participant Background
    
    User->>AgentTab: 输入任务描述
    AgentTab->>AgentCore: 调用 agent
    AgentCore->>Tool_Steps: 解析描述生成 steps
    Tool_Steps-->>AgentTab: 返回 steps（可预览）
    AgentCore->>Tool_Script: steps 转脚本
    Tool_Script-->>AgentTab: 返回脚本代码
    AgentCore->>Tool_Run: 执行脚本
    Tool_Run->>Background: START_WORKFLOW
    Background-->>AgentTab: 执行状态更新
```



## 6. 关键文件变更

| 文件 | 变更 ||------|------|| [`src/lib/agent.ts`](src/lib/agent.ts) | **新建** - Agent 核心 + Tools 定义 || [`src/lib/storage.ts`](src/lib/storage.ts) | Script 接口增加 steps 字段 || [`src/sidepanel/App.tsx`](src/sidepanel/App.tsx) | 重构为 Tabs 视图，抽取组件 || [`src/components/Tabs.tsx`](src/components/Tabs.tsx) | **新建** - Tabs 组件 || [`src/components/AgentTab.tsx`](src/components/AgentTab.tsx) | **新建** - Agent 交互界面 || [`package.json`](package.json) | 添加 `ai`, `@ai-sdk/openai` 依赖 |