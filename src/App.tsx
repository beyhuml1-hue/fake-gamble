import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AgeGate } from "./components/AgeGate";
import { AppShell } from "./components/AppShell";
import { LuckHotkey } from "./components/LuckHotkey";
import { Lobby } from "./pages/Lobby";
import { Play } from "./pages/Play";
import { Stats } from "./pages/Stats";
import { WalletProvider } from "./state/wallet";

export default function App() {
  return (
    <AgeGate>
      <LuckHotkey />
      <WalletProvider email="phone">
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<Lobby />} />
              <Route path="stats" element={<Stats />} />
              <Route path="game/:id" element={<Play />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </WalletProvider>
    </AgeGate>
  );
}
