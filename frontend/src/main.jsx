import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import InstallApp from "./components/InstallApp";
import { registerServiceWorker } from "./app/registerServiceWorker";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
    <InstallApp />
  </React.StrictMode>
);
registerServiceWorker();