interface ProgressBarProps {
  value: number;
}

const ProgressBar = ({ value }: ProgressBarProps) => {
  return (
    <div className="w-full bg-border rounded-full h-3 overflow-hidden">
      <div
        className="bg-primary h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
};

export default ProgressBar;
