import React from "react";

// Deliberately has zero imports from App.tsx — if a render error came from
// a bug in App.tsx's own module-level code, importing anything from it
// here would risk failing to load at all. This is the last line of
// defense, so it has to be able to stand on its own.
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Mindscape crashed:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          height: "100%", padding: 32, textAlign: "center", backgroundColor: "#f3f2f2",
          fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 700, color: "#201e1d" }}>Something went wrong</div>
        <div style={{ fontSize: 14, color: "#5c5754", marginTop: 10, lineHeight: 1.6, maxWidth: 320 }}>
          Mindscape hit an unexpected error. Your data is saved on this device and hasn't been lost — reloading should fix it.
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            marginTop: 22, padding: "12px 24px", border: 0, borderRadius: 8, cursor: "pointer",
            backgroundColor: "#ec3013", color: "#fff", fontSize: 14, fontWeight: 700,
          }}
        >
          Reload
        </button>
      </div>
    );
  }
}
