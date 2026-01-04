import { useState, useEffect, useRef } from 'react';
import { Circle, Sparkles, Pause, Play, Square, X, Pencil, Trash2 } from 'lucide-react';
import { RecordingSession, RecordedStep } from '../../lib/types';
import { StepIcon } from '../shared/StepIcon';
import { getStepDescription } from './utils';

export function RecordingPanel({ 
  session, 
  onStart, 
  onStop, 
  onPause,
  onResume,
  onDeleteStep, 
  onUpdateStep,
  onClear,
  onUseRecording,
  onAddAiStep
}: { 
  session: RecordingSession | null;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onDeleteStep: (stepId: string) => void;
  onUpdateStep: (stepId: string, updates: Partial<RecordedStep>) => void;
  onClear: () => void;
  onUseRecording: () => void;
  onAddAiStep: (instruction: string) => void;
}) {
  const isRecording = session?.status === 'recording';
  const isPaused = session?.status === 'paused';
  const hasSteps = session && session.steps.length > 0;
  const stepsEndRef = useRef<HTMLDivElement>(null);
  const [showAiInput, setShowAiInput] = useState(false);
  const [aiInstruction, setAiInstruction] = useState('');
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  useEffect(() => {
    if (hasSteps) {
      stepsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [session?.steps.length]);

  const handleAddAiStep = () => {
    if (aiInstruction.trim()) {
      onAddAiStep(aiInstruction.trim());
      setAiInstruction('');
      setShowAiInput(false);
    }
  };

  const startEditing = (step: RecordedStep) => {
    if (step.type === 'ai_step') {
      setEditingStepId(step.id);
      setEditingValue(step.value || '');
    }
  };

  const saveEditing = () => {
    if (editingStepId && editingValue.trim()) {
      onUpdateStep(editingStepId, { value: editingValue.trim() });
    }
    setEditingStepId(null);
    setEditingValue('');
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : isPaused ? 'bg-yellow-500' : 'bg-slate-300'}`} />
          <span className="text-sm font-medium text-slate-700">
            {isRecording ? '录制中' : isPaused ? '已暂停' : '录制操作'}
          </span>
          {hasSteps && (
            <span className="text-xs text-slate-400">({session.steps.length} 步)</span>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          {(!session || session.status === 'stopped') ? (
            <button
              onClick={onStart}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 transition-colors"
            >
              <Circle size={10} className="fill-current" />
              开始
            </button>
          ) : (
            <>
              {isRecording ? (
                <>
                  <button
                    onClick={() => setShowAiInput(!showAiInput)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 ${showAiInput ? 'bg-purple-600' : 'bg-purple-500'} text-white text-xs rounded-lg hover:bg-purple-600 transition-colors`}
                    title="添加 AI 步骤"
                  >
                    <Sparkles size={12} />
                    AI Step
                  </button>
                <button
                  onClick={onPause}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-yellow-500 text-white text-xs rounded-lg hover:bg-yellow-600 transition-colors"
                >
                  <Pause size={12} />
                  暂停
                </button>
                </>
              ) : (
                <button
                  onClick={onResume}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-green-500 text-white text-xs rounded-lg hover:bg-green-600 transition-colors"
                >
                  <Play size={12} />
                  继续
                </button>
              )}
              <button
                onClick={onStop}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-600 text-white text-xs rounded-lg hover:bg-slate-700 transition-colors"
              >
                <Square size={10} className="fill-current" />
                停止
              </button>
            </>
          )}
        </div>
      </div>

      {showAiInput && isRecording && (
        <div className="px-4 py-3 bg-purple-50 border-b border-purple-100 flex gap-2">
          <input
            autoFocus
            type="text"
            value={aiInstruction}
            onChange={(e) => setAiInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                handleAddAiStep();
              }
            }}
            placeholder="描述 AI 需要执行的操作..."
            className="flex-1 text-xs border border-purple-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
          <button
            onClick={handleAddAiStep}
            disabled={!aiInstruction.trim()}
            className="px-3 py-1.5 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            添加
          </button>
          <button
            onClick={() => setShowAiInput(false)}
            className="p-1.5 text-slate-400 hover:text-slate-600"
          >
            <X size={14} />
          </button>
        </div>
      )}
      
      {hasSteps && (
        <>
          <div className="max-h-48 overflow-y-auto">
            {session.steps.map((step, idx) => (
              <div
                key={step.id}
                className="flex items-start gap-2 px-4 py-2 border-b border-slate-50 last:border-0 hover:bg-slate-50 group"
              >
                <span className="text-xs text-slate-400 w-4 shrink-0 pt-0.5">{idx + 1}</span>
                <div className="shrink-0 pt-0.5"><StepIcon type={step.type} /></div>
                
                {editingStepId === step.id ? (
                  <div className="flex-1 flex gap-1">
                    <input
                      autoFocus
                      className="flex-1 text-xs border border-purple-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-purple-400"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onBlur={saveEditing}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                          saveEditing();
                        } else if (e.key === 'Escape') {
                          setEditingStepId(null);
                        }
                      }}
                    />
                  </div>
                ) : (
                  <span 
                    className={`flex-1 text-xs text-slate-600 break-all ${step.type === 'ai_step' ? 'cursor-pointer hover:text-purple-600' : ''}`}
                    onClick={() => startEditing(step)}
                    title={step.type === 'ai_step' ? '点击编辑' : undefined}
                  >
                  {getStepDescription(step)}
                </span>
                )}
                
                <div className="flex items-center gap-0.5 shrink-0">
                  {step.type === 'ai_step' && (
                    <button
                      onClick={() => startEditing(step)}
                      className="p-1 text-slate-400 hover:text-purple-600 transition-colors"
                      title="编辑指令"
                    >
                      <Pencil size={12} />
                    </button>
                  )}
                <button
                  onClick={() => onDeleteStep(step.id)}
                    className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <X size={12} />
                </button>
                </div>
              </div>
            ))}
            <div ref={stepsEndRef} />
          </div>
          
          <div className="px-4 py-2 border-t border-slate-100 flex justify-between items-center bg-slate-50">
            <button
              onClick={onClear}
              className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1"
            >
              <Trash2 size={12} />
              清空
            </button>
            <button
              onClick={onUseRecording}
              className="flex items-center gap-1 px-3 py-1.5 bg-purple-500 text-white text-xs rounded-lg hover:bg-purple-600 transition-colors"
            >
              <Sparkles size={12} />
              用于生成
            </button>
          </div>
        </>
      )}
      
      {!hasSteps && !isRecording && (
        <div className="px-4 py-6 text-center text-xs text-slate-400">
          点击"开始"录制你的操作流程
        </div>
      )}
    </div>
  );
}

