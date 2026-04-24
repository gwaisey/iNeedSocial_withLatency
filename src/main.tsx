import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import { AppErrorBoundary } from "./components/app-error-boundary"
import "./index.css"
import { installGlobalRuntimeMonitoring } from "./utils/runtime-monitoring"

installGlobalRuntimeMonitoring()

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
)
