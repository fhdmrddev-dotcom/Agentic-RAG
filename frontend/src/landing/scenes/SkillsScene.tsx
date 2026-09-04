import { MODEL_PROVIDERS } from "../facts"
import "./scenes.css"

export function SkillsScene() {
  return (
    <div className="scene sc-sk" aria-label="Interactive skills storyboard showing prompt capture, SKILL.md card, cross-provider eval scoreboards, and version stepper">
      <div className="sfloor" aria-hidden="true" />

      {/* Prompt message */}
      <div
        className="el mini k-msg"
        style={{
          left: 28,
          top: 24,
          padding: "10px 14px",
          borderRadius: "14px 14px 4px 14px",
          background: "linear-gradient(135deg, hsl(239 84% 67%), hsl(258 90% 66%))",
          border: 0,
          color: "#fff",
          lineHeight: 1.4,
        }}
      >
        Save what you just did as a skill: “board-deck”.
      </div>

      {/* Structured SKILL.md Card */}
      <div
        className="el mini k-card font-mono"
        style={{
          left: 28,
          top: 92,
          width: 250,
          padding: 12,
          fontSize: 11,
          lineHeight: 1.6,
          color: "hsl(220 16% 65%)",
        }}
      >
        <div style={{ color: "hsl(239 100% 82%)", marginBottom: 4 }}>SKILL.md</div>
        <div><span style={{ color: "hsl(226 60% 97%)" }}>name:</span> board-deck</div>
        <div><span style={{ color: "hsl(226 60% 97%)" }}>description:</span> 12-slide board pack in house style</div>
        <div><span style={{ color: "hsl(226 60% 97%)" }}>files:</span> template.pptx · palette.json</div>
        <div><span style={{ color: "hsl(226 60% 97%)" }}>triggers:</span> “board deck”, “board pack”</div>
      </div>

      {/* Cross-Provider Eval Bars */}
      <div
        className="el k-evals"
        style={{
          left: 320,
          top: 84,
          width: 230,
        }}
      >
        <div
          className="font-mono"
          style={{
            fontSize: 10,
            letterSpacing: ".08em",
            color: "hsl(220 16% 65%)",
            marginBottom: 8,
          }}
        >
          EVALS · {MODEL_PROVIDERS.length} CASES · INDEPENDENT JUDGE
        </div>
        <div className="kbars">
          <div className="kb">
            <i className="k-b1" style={{ "--h": "92%" } as Record<string, string>} />
            <span>Anthropic</span>
            <em>8/8</em>
          </div>
          <div className="kb">
            <i className="k-b2" style={{ "--h": "80%", "--d": ".15s" } as Record<string, string>} />
            <span>OpenAI</span>
            <em>7/8</em>
          </div>
          <div className="kb">
            <i className="k-b3" style={{ "--h": "74%", "--d": ".3s" } as Record<string, string>} />
            <span>Google</span>
            <em>6/8</em>
          </div>
          <div className="kb">
            <i className="k-b4" style={{ "--h": "68%", "--d": ".45s" } as Record<string, string>} />
            <span>DeepSeek</span>
            <em>6/8</em>
          </div>
          <div className="kb">
            <i className="k-b5" style={{ "--h": "55%", "--d": ".6s" } as Record<string, string>} />
            <span>Local</span>
            <em>5/8</em>
          </div>
        </div>
      </div>

      {/* Version Stepper */}
      <div
        className="el k-vers"
        style={{
          right: 40,
          top: 70,
          width: 150,
          height: 130,
        }}
      >
        <div className="mini kv k-v1">
          <span className="font-mono">v1</span>
          <span className="dim">draft</span>
        </div>
        <div className="mini kv k-v2">
          <span className="font-mono">v2</span>
          <span className="dim">evals 7/8</span>
        </div>
        <div className="mini kv k-v3">
          <span className="font-mono">v3</span>
          <span
            className="tag"
            style={{
              background: "hsl(142 71% 45% / .15)",
              color: "hsl(142 71% 55%)",
            }}
          >
            published · org
          </span>
        </div>
      </div>

      <div className="el scap">
        Teach it once → it writes the procedure → evals across providers → versioned and published to the org
      </div>
    </div>
  )
}
