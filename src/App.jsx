// src/App.jsx
import { Routes, Route } from "react-router-dom";
import PokerTable from "./components/PokerTable";
import SiteFooter from "./components/SiteFooter";
import { ContactPage, PrivacyPage, TermsPage } from "./components/LegalPages";

export default function App() {
  return (
    <div
      style={{
        backgroundColor: "#111",
        minHeight: "100vh",
        color: "white",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<PokerTable />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/contact" element={<ContactPage />} />
        </Routes>
      </div>
      <SiteFooter />
    </div>
  );
}
