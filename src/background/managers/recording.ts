import { RecordingSession, RecordedStep, RecordingStepPayload } from '../../lib/types';

// ============== Recording Session Management ==============
let sessions: Record<string, RecordingSession> = {}; // scriptId -> RecordingSession
let activeScriptId: string | null = null;

// 从存储中恢复所有会话
let isRestoring = true;

// 初始化恢复
chrome.storage.local.get(['recordingSessions', 'activeScriptId']).then(res => {
  console.log('[Pilot BG] Restoring sessions from storage, raw data:', res);
  if (res.recordingSessions && typeof res.recordingSessions === 'object') {
    sessions = res.recordingSessions as Record<string, RecordingSession>;
    console.log('[Pilot BG] Sessions restored:', Object.keys(sessions));
    Object.entries(sessions).forEach(([id, session]) => {
      console.log(`[Pilot BG] Session ${id}: ${session.steps?.length || 0} steps`);
    });
  } else {
    console.log('[Pilot BG] No sessions found in storage');
  }
  if (res.activeScriptId && typeof res.activeScriptId === 'string') {
    activeScriptId = res.activeScriptId as string;
    console.log('[Pilot BG] Active script restored:', activeScriptId);
  }
  isRestoring = false;
});

export function getActiveScriptId() {
  return activeScriptId;
}

export function getSession(scriptId: string) {
  return sessions[scriptId];
}

export function getAllSessions() {
  return sessions;
}

export function getIsRestoring() {
  return isRestoring;
}

// 用于异步等待恢复完成（如果需要）
export async function ensureRestored() {
  if (!isRestoring) return;
  return new Promise<void>((resolve) => {
    const check = () => {
      if (!isRestoring) resolve();
      else setTimeout(check, 50);
    };
    check();
  });
}

function saveSessionsToStorage() {
  chrome.storage.local.set({ recordingSessions: sessions, activeScriptId }).then(() => {
    console.log('[Pilot BG] Sessions saved to storage:', Object.keys(sessions), 'activeScriptId:', activeScriptId);
  }).catch(err => {
    console.error('[Pilot BG] Failed to save sessions:', err);
  });
}

function createRecordingSession(tabId: number, url: string, scriptId: string): RecordingSession {
  const session: RecordingSession = {
    id: crypto.randomUUID(),
    scriptId,
    name: `Recording ${new Date().toLocaleString()}`,
    startUrl: url,
    startTime: Date.now(),
    steps: [],
    status: 'recording',
    tabId,
  };
  return session;
}

export function addStepToSession(payload: RecordingStepPayload) {
  if (!activeScriptId || !sessions[activeScriptId] || sessions[activeScriptId].status !== 'recording') return;

  const step: RecordedStep = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    ...payload,
  };

  sessions[activeScriptId].steps.push(step);
  console.log(`[Pilot Recording] Step added to script ${activeScriptId}:`, step.type);

  saveSessionsToStorage();
  notifySidePanelUpdate(activeScriptId);
}

export function addNavigationStep(tabId: number, url: string, title: string) {
  if (!activeScriptId || !sessions[activeScriptId] || sessions[activeScriptId].status !== 'recording') return;
  if (sessions[activeScriptId].tabId !== tabId) return;

  const session = sessions[activeScriptId];
  // 避免重复记录相同 URL
  const lastStep = session.steps[session.steps.length - 1];
  if (lastStep?.type === 'navigate' && lastStep.url === url) return;

  const step: RecordedStep = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    type: 'navigate',
    url,
    pageTitle: title,
  };

  session.steps.push(step);
  console.log(`[Pilot Recording] Navigation step added to script ${activeScriptId}:`, url);

  saveSessionsToStorage();
  notifySidePanelUpdate(activeScriptId);
}

export function notifySidePanelUpdate(scriptId: string) {
  chrome.runtime.sendMessage({
    type: 'RECORDING_SESSION_UPDATE',
    payload: sessions[scriptId],
    scriptId
  }).catch(() => { });
}

export async function startRecording(tabId: number, scriptId: string) {
  const tab = await chrome.tabs.get(tabId);

  activeScriptId = scriptId;
  sessions[scriptId] = createRecordingSession(tabId, tab.url || '', scriptId);

  // 添加初始导航步骤
  addNavigationStep(tabId, tab.url || '', tab.title || '');

  // 通知 Content Script 开始录制
  await chrome.tabs.sendMessage(tabId, {
    type: 'RECORDING_CONTROL',
    action: 'start',
  });

  console.log(`[Pilot Recording] Started for script ${scriptId} in tab ${tabId}`);
  saveSessionsToStorage();
  notifySidePanelUpdate(scriptId);
}

export async function stopRecording() {
  if (!activeScriptId || !sessions[activeScriptId]) return;

  const session = sessions[activeScriptId];
  const tabId = session.tabId;
  session.status = 'stopped';

  // 通知 Content Script 停止录制
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'RECORDING_CONTROL',
      action: 'stop',
    });
  } catch (e) {
    console.warn('[Pilot Recording] Could not notify content script:', e);
  }

  console.log(`[Pilot Recording] Stopped for script ${activeScriptId}. Total steps: ${session.steps.length}`);
  saveSessionsToStorage();
  notifySidePanelUpdate(activeScriptId);
  activeScriptId = null; // 停止后不再是活跃录制状态
  saveSessionsToStorage();
}

export async function pauseRecording() {
  if (!activeScriptId || !sessions[activeScriptId]) return;

  const session = sessions[activeScriptId];
  session.status = 'paused';

  try {
    await chrome.tabs.sendMessage(session.tabId, {
      type: 'RECORDING_CONTROL',
      action: 'pause',
    });
  } catch (e) {
    console.warn('[Pilot Recording] Could not notify content script:', e);
  }

  console.log(`[Pilot Recording] Paused for script ${activeScriptId}`);
  saveSessionsToStorage();
  notifySidePanelUpdate(activeScriptId);
}

export async function resumeRecording() {
  if (!activeScriptId || !sessions[activeScriptId]) return;

  const session = sessions[activeScriptId];
  session.status = 'recording';

  try {
    await chrome.tabs.sendMessage(session.tabId, {
      type: 'RECORDING_CONTROL',
      action: 'start',
    });
  } catch (e) {
    console.warn('[Pilot Recording] Could not notify content script:', e);
  }

  console.log(`[Pilot Recording] Resumed for script ${activeScriptId}`);
  saveSessionsToStorage();
  notifySidePanelUpdate(activeScriptId);
}

export function deleteStep(scriptId: string, stepId: string) {
  if (!sessions[scriptId]) return;

  sessions[scriptId].steps = sessions[scriptId].steps.filter(s => s.id !== stepId);
  console.log(`[Pilot Recording] Step deleted from script ${scriptId}: ${stepId}`);
  saveSessionsToStorage();
  notifySidePanelUpdate(scriptId);
}

export function updateStep(scriptId: string, stepId: string, updates: Partial<RecordedStep>) {
  if (!sessions[scriptId]) return;

  const stepIdx = sessions[scriptId].steps.findIndex(s => s.id === stepId);
  if (stepIdx === -1) return;

  sessions[scriptId].steps[stepIdx] = {
    ...sessions[scriptId].steps[stepIdx],
    ...updates,
    timestamp: Date.now(), // 更新时间戳
  };

  console.log(`[Pilot Recording] Step updated in script ${scriptId}: ${stepId}`);
  saveSessionsToStorage();
  notifySidePanelUpdate(scriptId);
}

export function addAiStep(scriptId: string, instruction: string) {
  if (!sessions[scriptId] || sessions[scriptId].status !== 'recording') return;

  const step: RecordedStep = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    type: 'ai_step',
    url: '', // 会在生成脚本时处理，或者根据当前活跃 Tab 填充
    pageTitle: 'AI Step',
    value: instruction
  };

  // 尽量填充当前 URL
  chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => {
    if (tabs[0]) {
      step.url = tabs[0].url || '';
      step.pageTitle = tabs[0].title || 'AI Step';
    }
    sessions[scriptId].steps.push(step);
    saveSessionsToStorage();
    notifySidePanelUpdate(scriptId);
  });
}

export function clearRecording(scriptId: string) {
  if (activeScriptId === scriptId) {
    stopRecording();
  }
  delete sessions[scriptId];
  console.log(`[Pilot Recording] Cleared for script ${scriptId}`);
  saveSessionsToStorage();
  // 注意：不需要调用 notifySidePanelUpdate，因为会话已被删除
}

// 检查是否在录制状态，如果新标签页有 openerTabId 且等于当前录制的标签页
export function handleTabCreatedForRecording(tab: chrome.tabs.Tab) {
  if (activeScriptId && sessions[activeScriptId]?.status === 'recording') {
    const session = sessions[activeScriptId];
    // 如果新标签页有 openerTabId 且等于当前录制的标签页
    if (tab.openerTabId === session.tabId) {
      console.log(`[Pilot Recording] Following recording to new tab: ${tab.id}`);
      session.tabId = tab.id!;
      notifySidePanelUpdate(activeScriptId);
    }
  }
}

