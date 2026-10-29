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
// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA 
registerServiceWorker();