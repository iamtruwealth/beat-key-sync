import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { Buffer } from "buffer";

// Ensure Buffer is available in the browser for libs that expect Node's Buffer
if (!(window as any).Buffer) {
  (window as any).Buffer = Buffer;
}

createRoot(document.getElementById("root")!).render(<App />);
