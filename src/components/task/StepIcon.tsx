import { Navigation, Sparkles } from 'lucide-react';

interface StepIconProps {
  type: string;
}

export function StepIcon({ type }: StepIconProps) {
  if (type === 'navigate') {
    return <Navigation size={14} className="text-blue-500" />;
  }
  return <Sparkles size={14} className="text-purple-500" />;
}

