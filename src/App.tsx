import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AgeGate } from "./components/AgeGate";
import { AppShell } from "./components/AppShell";
import { Lobby } from "./pages/Lobby";
import { Play } from "./pages/Play";
import { WalletProvider } from "./state/wallet";

export default function App() {
  return (
    <WalletProvider>
      <AgeGate>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<Lobby />} />
              <Route path="game/:id" element={<Play />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AgeGate>
    </WalletProvider>
  );
}
