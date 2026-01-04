import { Mouse, Type, Navigation, Play, List, Key, Sparkles, Circle } from 'lucide-react';
import { RecordedStep } from '../../lib/types';

export function StepIcon({ type }: { type: RecordedStep['type'] }) {
  switch (type) {
    case 'click':
      return <Mouse size={12} className="text-blue-500" />;
    case 'input':
      return <Type size={12} className="text-green-500" />;
    case 'navigate':
      return <Navigation size={12} className="text-purple-500" />;
    case 'submit':
      return <Play size={12} className="text-orange-500" />;
    case 'select':
      return <List size={12} className="text-cyan-500" />;
    case 'keypress':
      return <Key size={12} className="text-pink-500" />;
    case 'ai_step':
      return <Sparkles size={12} className="text-purple-500" />;
    default:
      return <Circle size={12} className="text-slate-400" />;
  }
}

