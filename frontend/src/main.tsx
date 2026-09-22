import React from "react";
import ReactDOM from "react-dom/client";
import { AuthProvider } from "./features/auth/AuthContext";
import { App } from "./app/App";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
);

// PWA: register the offline shell worker. No build plugin needed for phase 0.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline support is best-effort; the app still works online */
    });
  });
}
