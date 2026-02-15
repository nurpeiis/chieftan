import { useState } from "react";
import { BriefingFeed } from "./components/BriefingFeed";
import { AnalyticsPanel } from "./components/AnalyticsPanel";
import { ApprovalGate } from "./components/ApprovalGate";
import { SkillMarketplace } from "./components/SkillMarketplace";
import { AuditLog } from "./components/AuditLog";
import "./App.css";

type Tab = "briefing" | "analytics" | "approvals" | "skills" | "audit";

function App() {
  const [activeTab, setActiveTab] = useState<Tab>("briefing");

  const tabs: Array<{ id: Tab; label: string; icon: string }> = [
    { id: "briefing", label: "Briefing", icon: "📋" },
    { id: "analytics", label: "Analytics", icon: "📊" },
    { id: "approvals", label: "Approvals", icon: "🔔" },
    { id: "skills", label: "Skills", icon: "📦" },
    { id: "audit", label: "Audit Log", icon: "📜" },
  ];

  return (
    <div className="app">
      <header className="header">
        <h1 className="logo">Chieftan</h1>
        <span className="tagline">Your AI Chief of Staff</span>
      </header>

      <nav className="nav">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`nav-tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      <main className="main">
        {activeTab === "briefing" && <BriefingFeed />}
        {activeTab === "analytics" && <AnalyticsPanel />}
        {activeTab === "approvals" && <ApprovalGate />}
        {activeTab === "skills" && <SkillMarketplace />}
        {activeTab === "audit" && <AuditLog />}
      </main>
    </div>
  );
}

export default App;
