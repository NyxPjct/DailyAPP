import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initializeMobile } from "./mobile/platform";
import "./styles.css";

initializeMobile();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
