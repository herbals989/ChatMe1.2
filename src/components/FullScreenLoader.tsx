export default function FullScreenLoader() {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(135deg, var(--primary-600) 0%, var(--primary-800) 100%)",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div className="chatme-logo" style={{ marginBottom: 24 }}>
          ChatMe
        </div>
        <div className="typing-dots" style={{ justifyContent: "center" }}>
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}
