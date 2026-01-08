import { ArrowUp, Loader2 } from 'lucide-react';
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from '@/components/ui/prompt-input';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
}

export function ChatInput({ value, onChange, onSubmit, isLoading }: ChatInputProps) {
  return (
    <div className="p-3 border-t border-slate-200 bg-white">
      <PromptInput
        value={value}
        onValueChange={onChange}
        onSubmit={onSubmit}
        isLoading={isLoading}
        disabled={isLoading}
        className="bg-slate-50 border-slate-200"
      >
        <PromptInputTextarea
          placeholder="描述你想要自动化的操作..."
          className="text-sm min-h-[44px]"
        />
        <PromptInputActions className="justify-end px-2 pb-2">
          <PromptInputAction tooltip="发送消息 (Enter)">
            <button
              type="button"
              onClick={onSubmit}
              disabled={isLoading || !value.trim()}
              className="p-2 rounded-full bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ArrowUp size={16} />
              )}
            </button>
          </PromptInputAction>
        </PromptInputActions>
      </PromptInput>
    </div>
  );
}

