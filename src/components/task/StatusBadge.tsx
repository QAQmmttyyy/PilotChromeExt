import React from 'react';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { AgentState } from '../../lib/agent';

interface StatusBadgeProps {
  status: AgentState['status'];
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config: Record<AgentState['status'], { label: string; color: string; icon?: React.ReactNode }> = {
    idle: { label: '就绪', color: 'bg-slate-100 text-slate-600' },
    thinking: { label: '思考中', color: 'bg-yellow-100 text-yellow-700', icon: <Loader2 size={12} className="animate-spin" /> },
    generating_steps: { label: '生成步骤', color: 'bg-blue-100 text-blue-700', icon: <Loader2 size={12} className="animate-spin" /> },
    generating_script: { label: '生成脚本', color: 'bg-purple-100 text-purple-700', icon: <Loader2 size={12} className="animate-spin" /> },
    running: { label: '执行中', color: 'bg-green-100 text-green-700', icon: <Loader2 size={12} className="animate-spin" /> },
    completed: { label: '完成', color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 size={12} /> },
    error: { label: '错误', color: 'bg-red-100 text-red-700', icon: <XCircle size={12} /> },
  };

  const { label, color, icon } = config[status];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {icon}
      {label}
    </span>
  );
}

