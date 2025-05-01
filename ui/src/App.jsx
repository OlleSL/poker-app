import { Routes, Route } from "react-router-dom";
import PokerTable from "./components/PokerTable";
import GtoBreakdown from "./components/GtoBreakdown";

export default function App() {
  return (
    <div style={{ backgroundColor: "#111", minHeight: "100vh", color: "white" }}>
      <Routes>
        <Route path="/" element={<PokerTable />} />
        <Route path="/gto" element={<GtoBreakdown />} />
      </Routes>
    </div>
  );
}
