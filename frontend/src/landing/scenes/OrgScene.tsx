import "./scenes.css"

export function OrgScene() {
  return (
    <div className="scene sc-org" aria-label="Interactive organization storyboard demonstrating member roles, SSO enforcement, and shared knowledge spaces">
      <div className="sfloor" aria-hidden="true" />

      {/* Dashed organization ring */}
      <div
        className="el o-ring"
        style={{
          left: "50%",
          top: "50%",
          width: 240,
          height: 240,
          margin: "-120px 0 0 -120px",
          borderRadius: 9999,
          border: "1px dashed hsl(239 100% 82% / .35)",
        }}
      />

      {/* Member avatars */}
      <div className="el oa o-a1" style={{ "--ax": "-110px", "--ay": "0px" } as Record<string, string>}>AK</div>
      <div className="el oa o-a2" style={{ "--ax": "-55px", "--ay": "-95px" } as Record<string, string>}>MR</div>
      <div className="el oa o-a3" style={{ "--ax": "55px", "--ay": "-95px" } as Record<string, string>}>JD</div>
      <div className="el oa o-a4" style={{ "--ax": "110px", "--ay": "0px" } as Record<string, string>}>SP</div>
      <div className="el oa o-a5" style={{ "--ax": "55px", "--ay": "95px" } as Record<string, string>}>LN</div>
      <div className="el oa o-a6" style={{ "--ax": "-55px", "--ay": "95px" } as Record<string, string>}>TO</div>

      {/* Central SSO Shield */}
      <div
        className="el o-sso"
        style={{
          left: "50%",
          top: "50%",
          width: 64,
          height: 72,
          margin: "-40px 0 0 -32px",
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="hsl(239 100% 82%)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ width: 64, height: 72 }}
          aria-hidden="true"
        >
          <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
          <rect className="o-lockb" x="9" y="11" width="6" height="5" rx="1" />
          <path className="o-shackle" d="M10 11V9.5a2 2 0 0 1 4 0V11" />
        </svg>
      </div>

      {/* Role Badges Card */}
      <div
        className="el mini o-tags"
        style={{
          right: 24,
          top: 24,
          padding: "10px 12px",
          fontSize: 11,
          lineHeight: 1.8,
        }}
      >
        <div>
          <span
            className="tag"
            style={{
              background: "hsl(239 100% 82% / .15)",
              color: "hsl(239 100% 82%)",
            }}
          >
            owner
          </span>{" "}
          AK
        </div>
        <div>
          <span className="tag" style={{ background: "hsl(220 25% 14%)" }}>
            admin
          </span>{" "}
          MR · SP
        </div>
        <div>
          <span className="tag" style={{ background: "hsl(220 25% 14%)" }}>
            member
          </span>{" "}
          JD · LN · TO
        </div>
      </div>

      {/* SSO Enforced Card */}
      <div
        className="el mini o-ssolabel"
        style={{
          left: 24,
          bottom: 60,
          padding: "10px 12px",
          display: "flex",
          gap: 10,
          alignItems: "center",
        }}
      >
        <span className="ck">✓</span>
        <span>
          SSO enforced for <span className="font-mono">[yourcompany].com</span>
        </span>
      </div>

      {/* Shared Scopes Card */}
      <div
        className="el mini o-share"
        style={{
          right: 24,
          bottom: 60,
          padding: "10px 12px",
          fontSize: 11,
        }}
      >
        <span className="font-mono text-muted-foreground">SHARED</span> Policies / · Templates / · skill: board-deck
      </div>

      <div className="el scap">
        Invite → assign roles → enforce SSO → share one folder and one skill org-wide, isolated by database policy
      </div>
    </div>
  )
}
