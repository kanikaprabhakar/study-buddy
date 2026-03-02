import { Check } from "lucide-react";

interface TaskItemProps {
  text: string;
  duration: string;
  completed?: boolean;
}

const TaskItem = ({ text, duration, completed = false }: TaskItemProps) => {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors duration-200">
      <button
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
          completed
            ? "bg-primary border-primary"
            : "border-sb-text-muted hover:border-primary"
        }`}
      >
        {completed && <Check className="w-3 h-3 text-primary-foreground" />}
      </button>
      <span
        className={`flex-1 text-sm font-medium ${
          completed
            ? "line-through text-muted-foreground"
            : "text-foreground"
        }`}
      >
        {text}
      </span>
      <span className="text-xs text-sb-text-muted">{duration}</span>
    </div>
  );
};

export default TaskItem;
