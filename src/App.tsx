import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AgeGate } from "./components/AgeGate";
import { AuthProvider } from "./components/AuthProvider";
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
      <AuthProvider>
        {(walletIdentity) => (
          <WalletProvider key={walletIdentity} email={walletIdentity}>
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
        )}
      </AuthProvider>
    </AgeGate>
  );
}
