import { useState, useEffect } from "react";
import { getSkills, type SkillManifest } from "../api";

export function SkillMarketplace() {
  const [skills, setSkills] = useState<SkillManifest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSkills()
      .then(setSkills)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="empty-state">Loading skills...</div>;
  if (error) return <div className="empty-state">Failed to load: {error}</div>;

  if (skills.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📦</div>
        <p>No skills installed yet.</p>
        <p style={{ marginTop: 8, fontSize: "0.85rem" }}>
          Use <code>chieftan skill install &lt;name&gt;</code> or install from
          Telegram with <code>/skills install &lt;name&gt;</code>
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="section-header">
        <span className="section-title">Installed Skills</span>
        <span className="section-count">{skills.length}</span>
      </div>

      {skills.map((skill) => (
        <div key={skill.name} className="card">
          <div className="skill-card">
            <div className="skill-info">
              <div className="card-title">{skill.name}</div>
              <div className="card-subtitle">v{skill.version}</div>
              <div className="card-body" style={{ marginTop: 4 }}>
                {skill.description}
              </div>
              <div className="skill-perms">
                {skill.permissions.length > 0 ? (
                  skill.permissions.map((p) => (
                    <span key={p} className="perm-badge">
                      {p}
                    </span>
                  ))
                ) : (
                  <span className="perm-badge">no permissions</span>
                )}
              </div>
              {skill.schedule && (
                <div
                  className="card-subtitle"
                  style={{ marginTop: 4 }}
                >
                  Schedule: {skill.schedule}
                </div>
              )}
            </div>
            <div>
              <button className="btn btn-danger">Uninstall</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
