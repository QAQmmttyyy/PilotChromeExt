import { ArrowUp, Loader2 } from "lucide-react";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from "@/components/ui/prompt-input";
import { Button } from "@/components/ui/button";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  isLoading,
}: ChatInputProps) {
  return (
    <div className="p-3">
      <PromptInput
        value={value}
        onValueChange={onChange}
        onSubmit={onSubmit}
        isLoading={isLoading}
      >
        <PromptInputTextarea
          id="chat-input-textarea"
          placeholder="描述你的任务..."
          className="text-sm min-h-[44px]"
        />
        <PromptInputActions className="justify-end px-2 pb-2">
          <PromptInputAction tooltip="发送消息 (Enter)">
            <Button
              variant="default"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={onSubmit}
            >
              {isLoading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <ArrowUp className="size-5" />
              )}
            </Button>
          </PromptInputAction>
        </PromptInputActions>
      </PromptInput>
    </div>
  );
}
