import { Script } from '../../lib/storage';
import { RecordingSession, RecordedStep } from '../../lib/types';
import { ScriptHeader } from './ScriptHeader';
import { RecordingPanel } from './RecordingPanel';
import { AiChatPanel } from './AiChatPanel';
import { ChatMessage, AIModel } from '../../lib/ai';

interface ScriptEditorProps {
  script: Script;
  onUpdateScript: (updates: Partial<Script>) => void;
  onBack: () => void;
  onRun: () => void;
  onSave: () => void;
  onOpenSettings: () => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  codeUpdateStatus: 'idle' | 'updated';
  // Chat props
  chatHistory: ChatMessage[];
  showChat: boolean;
  setShowChat: (show: boolean) => void;
  isGenerating: boolean;
  streamingContent: string;
  onClearHistory: () => void;
  aiPrompt: string;
  setAiPrompt: (prompt: string) => void;
  onGenerate: () => void;
  currentModel: AIModel;
  recordingContext: string;
  onClearContext: () => void;
  // Recording props
  recordingSession: RecordingSession | null;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onPauseRecording: () => void;
  onResumeRecording: () => void;
  onDeleteStep: (stepId: string) => void;
  onUpdateStep: (stepId: string, updates: Partial<RecordedStep>) => void;
  onClearRecording: () => void;
  onUseRecording: () => void;
  onAddAiStep: (instruction: string) => void;
}

export function ScriptEditor({
  script,
  onUpdateScript,
  onBack,
  onRun,
  onSave,
  onOpenSettings,
  saveStatus,
  codeUpdateStatus,
  // Chat props
  chatHistory,
  showChat,
  setShowChat,
  isGenerating,
  streamingContent,
  onClearHistory,
  aiPrompt,
  setAiPrompt,
  onGenerate,
  currentModel,
  recordingContext,
  onClearContext,
  // Recording props
  recordingSession,
  onStartRecording,
  onStopRecording,
  onPauseRecording,
  onResumeRecording,
  onDeleteStep,
  onUpdateStep,
  onClearRecording,
  onUseRecording,
  onAddAiStep,
}: ScriptEditorProps) {
  return (
    <div className="h-full flex flex-col">
      <ScriptHeader
        script={script}
        onUpdateName={(name) => onUpdateScript({ name })}
        onBack={onBack}
        onRun={onRun}
        onSave={onSave}
        onOpenSettings={onOpenSettings}
        saveStatus={saveStatus}
      />

      <div className="flex-1 flex flex-col p-3 gap-3 overflow-y-auto">
        <div className="flex-1 border border-slate-200 rounded-xl overflow-hidden flex flex-col bg-white shadow-sm min-h-[200px]">
          <div className="bg-slate-50 px-4 py-2 text-xs text-slate-500 border-b border-slate-200 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="font-medium">代码编辑器</span>
              {codeUpdateStatus === 'updated' && (
                <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded animate-pulse">
                  ✓ 代码已更新
                </span>
              )}
            </div>
          </div>
          <textarea
            className="flex-1 w-full p-4 font-mono text-xs resize-none focus:outline-none leading-relaxed text-slate-700"
            value={script.code}
            onChange={e => onUpdateScript({ code: e.target.value })}
            spellCheck={false}
          />
        </div>

        <RecordingPanel
          session={recordingSession}
          onStart={onStartRecording}
          onStop={onStopRecording}
          onPause={onPauseRecording}
          onResume={onResumeRecording}
          onDeleteStep={onDeleteStep}
          onUpdateStep={onUpdateStep}
          onClear={onClearRecording}
          onUseRecording={onUseRecording}
          onAddAiStep={onAddAiStep}
        />

        <AiChatPanel
          chatHistory={chatHistory}
          showChat={showChat}
          setShowChat={setShowChat}
          isGenerating={isGenerating}
          streamingContent={streamingContent}
          onClearHistory={onClearHistory}
          aiPrompt={aiPrompt}
          setAiPrompt={setAiPrompt}
          onGenerate={onGenerate}
          currentModel={currentModel}
          recordingContext={recordingContext}
          onClearContext={onClearContext}
        />
      </div>
    </div>
  );
}

