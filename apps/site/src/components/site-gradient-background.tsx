type SiteGradientBackgroundProps = {
  className?: string;
};

export function SiteGradientBackground({ className }: SiteGradientBackgroundProps) {
  return (
    <div
      className={className}
      style={{ backgroundColor: "var(--background)", width: "100%", height: "100%" }}
    />
  );
}
