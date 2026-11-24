import { StrictMode } from "react";

import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./arcade.css";
import "./game-screens.css";
import "./design-system.css";
import "./visual-fixes.css";
import "./game-polish.css";
import "./blockbet.css";
import "./blockbet-arcade-theme.css";
import "./account-screens.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
