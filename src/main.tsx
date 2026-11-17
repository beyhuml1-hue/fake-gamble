import { StrictMode } from "react";

import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./arcade.css";
import "./game-screens.css";
import "./donutflip.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
