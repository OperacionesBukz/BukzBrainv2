import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

sessionStorage.removeItem("chunk-reload");

createRoot(document.getElementById("root")!).render(<App />);
