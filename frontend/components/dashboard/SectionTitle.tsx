import { type LucideIcon } from "lucide-react";

interface SectionTitleProps {
  icon?: LucideIcon;
  children: React.ReactNode;
}

const SectionTitle = ({ icon: Icon, children }: SectionTitleProps) => {
  return (
    <div className="flex items-center gap-4">
      {Icon && (
        <div className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-foreground font-serif">
        {children}
      </h3>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
};

export default SectionTitle;
