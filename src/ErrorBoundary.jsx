import { Component } from "react";
import { C } from "./theme";

// Catches render-time crashes in any child so a single broken component
// (e.g. a chart) can't blank the whole app. Offers a recovery reload.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("Folio crashed:", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        style={{
          minHeight: "100vh",
          background: C.bg,
          color: C.text,
          fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 360 }}>
          <div style={{ fontSize: "17px", fontWeight: 700, marginBottom: "8px" }}>Something went wrong</div>
          <div style={{ fontSize: "13px", color: C.sub, lineHeight: 1.6, marginBottom: "18px" }}>
            The app hit an unexpected error. Your saved data is safe — reloading usually fixes it.
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "11px 20px",
              borderRadius: "12px",
              border: "none",
              background: C.accent,
              color: "#fff",
              fontWeight: 700,
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            Reload Folio
          </button>
        </div>
      </div>
    );
  }
}
