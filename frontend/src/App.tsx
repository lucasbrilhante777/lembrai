import { Route, Routes } from "react-router";
import { AgendaPage } from "./features/agenda/AgendaPage.tsx";
import { LoginPage } from "./features/auth/LoginPage.tsx";
import { RegisterPage } from "./features/auth/RegisterPage.tsx";
import { RequireAuth } from "./features/auth/RequireAuth.tsx";
import { BookingPage } from "./features/booking/BookingPage.tsx";
import { CancelPage } from "./features/cancel/CancelPage.tsx";
import { PanelLayout } from "./features/panel/PanelLayout.tsx";
import { ProfessionalsPage } from "./features/professionals/ProfessionalsPage.tsx";
import { ServicesPage } from "./features/services/ServicesPage.tsx";
import { HomePage } from "./pages/HomePage.tsx";
import { NotFoundPage } from "./pages/NotFoundPage.tsx";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />

      {/* Páginas públicas do cliente final */}
      <Route path="/agenda/:slug" element={<BookingPage />} />
      <Route path="/cancelar/:token" element={<CancelPage />} />

      {/* Dono do negócio */}
      <Route path="/entrar" element={<LoginPage />} />
      <Route path="/cadastro" element={<RegisterPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/painel" element={<PanelLayout />}>
          <Route index element={<AgendaPage />} />
          <Route path="servicos" element={<ServicesPage />} />
          <Route path="profissionais" element={<ProfessionalsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
