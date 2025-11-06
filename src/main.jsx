import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./css/GtoPanel.css";

// Router configured with base path for GitHub Pages deployment

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter basename="/poker-app">
      <App />
    </BrowserRouter>
  </React.StrictMode>
);