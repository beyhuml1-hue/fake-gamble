import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AgeGate } from "./components/AgeGate";
import { AuthProvider } from "./components/AuthProvider";
import { AppShell } from "./components/AppShell";
import { LuckHotkey } from "./components/LuckHotkey";
import { Lobby } from "./pages/Lobby";
import { Play } from "./pages/Play";
import { Admin } from "./pages/Admin";
import { Community } from "./pages/Community";
import { HighlightPage } from "./components/Highlights";
import { Stats } from "./pages/Stats";
import { WalletProvider } from "./state/wallet";

export default function App() {
  return (
    <AgeGate>
      <LuckHotkey />
      <AuthProvider>
        {(walletIdentity, adjustment) => (
          <WalletProvider key={walletIdentity} email={walletIdentity} adjustment={adjustment}>
            <BrowserRouter>
              <Routes>
                <Route element={<AppShell />}>
                  <Route index element={<Lobby />} />
                  <Route path="admin" element={<Admin />} />
                  <Route path="chat" element={<Community />} />
                  <Route path="highlight" element={<HighlightPage />} />
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
