export default function ArbFooter({ variant = "default" }: { variant?: "default" | "light" }) {
  const color = variant === "light" ? "rgba(255,255,255,0.35)" : "var(--neutral-400)";
  return (
    <div
      style={{
        textAlign: "center",
        fontSize: "10px",
        fontWeight: 600,
        letterSpacing: "1.5px",
        color,
        padding: "12px 0",
        textTransform: "uppercase",
        userSelect: "none",
      }}
    >
      Powered by ARB Tech
    </div>
  );
}
