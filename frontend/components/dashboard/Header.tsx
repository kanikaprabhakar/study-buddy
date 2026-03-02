const Header = () => {
  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold text-sm">
            SB
          </div>
          <span className="font-semibold text-foreground text-lg tracking-tight font-serif">
            Study Buddy
          </span>
        </div>

        {/* Placeholder for user avatar */}
        <div className="w-9 h-9 rounded-full border-2 border-border bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
          U
        </div>
      </div>
    </header>
  );
};

export default Header;
