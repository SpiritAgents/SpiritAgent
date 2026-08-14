type SiteGradientBackgroundProps = {
  className?: string;
};

export function SiteGradientBackground({ className }: SiteGradientBackgroundProps) {
  return (
    <div
      className={className}
      style={{ backgroundColor: "#000000", width: "100%", height: "100%" }}
    />
  );
}
