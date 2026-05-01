import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { ErrorFallback } from "./components/common/ErrorFallback";
import { SentryErrorBoundary, initSentry } from "./lib/sentry";

initSentry();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SentryErrorBoundary fallback={<ErrorFallback />}>
      <App />
    </SentryErrorBoundary>
  </StrictMode>
);
