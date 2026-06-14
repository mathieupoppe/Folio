import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);

// Register the PWA service worker in production builds only (avoids dev caching).
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
