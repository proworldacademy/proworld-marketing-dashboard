// PROWORLD site — the one list of every page the team uses.
// Read by the Dashboard (index.html) and by the page strip (shared/menu.js). Edit here, nowhere else.
//
// status: here = part of this site · live = in daily use · proto = clickable prototype · plan = written plan
//         page = reference page · report = a dated report · archive = kept for the record
// needs:  passcode = the team passcode (this site) · google = Google sign-in + the portal's staff list
//         claude = a Claude account (page hosted on claude.ai) · none = open link
// section: tools = what we use every day · proto = prototypes & plans · library = playbooks, pages & reports
(function () {
  "use strict";
  const SITE = "https://proworldacademy.github.io/proworld-marketing-dashboard/";
  const PORTAL = "https://proworld-coach-portal.web.app";
  const PAGES = [
    // ── Tools — in daily use ──
    { id: "mkt", section: "tools", name: "Marketing Command Center", color: "", status: "here", needs: "passcode", menu: true, self: true, url: "marketing/", owner: "Marketing",
      desc: "The two-week plan, coach video briefs, the production list, the content banks, the Instagram archive, cadence, KPIs and the reports the Sunday and Monday runs post. The shared memory of everything we publish." },
    { id: "coach-portal", section: "tools", name: "Coach Portal · Player Assessments", color: "mint", status: "live", needs: "google", menu: true, url: PORTAL, owner: "Coaches · Directors",
      desc: "Every player's quarterly assessment (tennis, fitness, mental, summary), monthly reports, camp reports, videos, the journal and the follow-up checklist, with the branded PDF for parents. Coaches sign in with Google; an administrator approves them under Staff & access." },
    { id: "tryouts", section: "tools", name: "Try-outs", color: "mint", status: "live", needs: "google", menu: true, url: PORTAL + "/#/tryouts", owner: "Front desk · Coaches",
      desc: "Every try-out from the first call to the decision: date and time, the parent, what we saw, the group offered. Lives inside the Coach Portal, same sign-in." },
    { id: "coach-board", section: "tools", name: "Coach Board", color: "cyan", status: "live", needs: "claude", menu: true, url: "https://claude.ai/artifact/SDZwaHXrDmDPVvbPqMjK9g", owner: "Operations",
      desc: "Rosters by program, unassigned players, the cadence standard and the quarter commits — refreshed from the coach assignment sheet every weekday morning." },
    // ── Prototypes & plans ──
    { id: "be-owner", section: "proto", name: "Backend · Owner view", color: "cyan", status: "proto", needs: "claude", url: "https://claude.ai/artifact/KqbuRtaSV7tHhjyLkTKjQt#owner", owner: "Operations",
      desc: "The full backend we are building: front desk, enrollment, court control, attendance, players & billing, privates, books with revenue by class. Demo data only." },
    { id: "be-desk", section: "proto", name: "Backend · Front desk", color: "cyan", status: "proto", needs: "claude", url: "https://claude.ai/artifact/KqbuRtaSV7tHhjyLkTKjQt#desk", owner: "Front desk",
      desc: "Today's sessions, walk-ins, enrollment, court bookings, attendance reconciliation and billing exceptions." },
    { id: "be-coach", section: "proto", name: "Backend · Coach view", color: "cyan", status: "proto", needs: "claude", url: "https://claude.ai/artifact/KqbuRtaSV7tHhjyLkTKjQt#coach", owner: "Coaches",
      desc: "Attendance by court, private lessons that charge the family automatically, and court availability." },
    { id: "be-parent", section: "proto", name: "Player & family portal", color: "mint", status: "proto", needs: "claude", url: "https://claude.ai/artifact/KqbuRtaSV7tHhjyLkTKjQt#parent", owner: "Families",
      desc: "Pick a program and pay online, see enrollment and schedule, book a court. The family side of the backend." },
    { id: "pipeline", section: "proto", name: "Player Pipeline Playbook", color: "orchid", status: "plan", needs: "claude", url: "https://claude.ai/artifact/TbRZKmKCi4iW7uuzcEsMmm", owner: "Marketing · Leadership",
      desc: "Our own Meta ads, fast follow-up and trial offers for tennis and soccer: what we copy, what we already have, the four-week build, the offer, the targets and the next steps (Oct 9, 2026)." },
    { id: "player-system", section: "proto", name: "Player System · team briefing", color: "gray", status: "plan", needs: "claude", url: "https://claude.ai/artifact/1Wtg2PQjJjCEq2dpnN2ELi", owner: "Leadership",
      desc: "Sept 7, 2026: how a lead becomes a player — Pipedrive → Monday → the Motherboard sheet → JustCall → the AI layer → the directors — what is live and what is not yet." },
    { id: "ops", section: "proto", name: "Ops Autopilot · the plan", color: "gray", status: "plan", needs: "claude", url: "https://claude.ai/artifact/T7CtMUZvapgAEy19PNTmCM", owner: "Operations",
      desc: "Aug 23, 2026, living document: four phases to automate the attendance cross-check, renewals and the accounting prep, with who does what." },
    // ── Playbooks, pages & reports ──
    { id: "leads", section: "library", name: "How Leads Reach You", color: "orchid", status: "page", needs: "claude", url: "https://claude.ai/artifact/7XNXwDw6HN35fveM8wg46U", owner: "Front desk · Marketing",
      desc: "For the front desk: how the concierge handles website, text, WhatsApp and Instagram messages, when a lead is handed over, and the rule that a human reply stops the AI." },
    { id: "soccer", section: "library", name: "Soccer, Simplified", color: "", status: "page", needs: "claude", url: "https://claude.ai/artifact/AncGfsxixxDHd9HNURYCxq", owner: "Marketing · Families",
      desc: "The soccer clinic program page: ages 5–12, Tuesday / Thursday / Saturday, monthly prices, add-ons and the family FAQ." },
    { id: "ads-audit", section: "library", name: "Fall 2026 Ads Audit", color: "orchid", status: "report", needs: "claude", url: "https://claude.ai/artifact/KW6Mh1MqPgnXhYW8yrdZtQ", owner: "Marketing",
      desc: "Aug 24, 2026 — the Fall Program Meta campaign, Aug 11–23: spend, leads, cost per lead, tennis vs soccer, placements, who saw it, and the fixes." },
    { id: "inbox-audit", section: "library", name: "Instagram Inbox Audit", color: "orchid", status: "report", needs: "claude", url: "https://claude.ai/artifact/NrzJLKMpCNhs5z4hujFmf9", owner: "Marketing · Front desk",
      desc: "Sept 1, 2026 — 120 Instagram DM threads checked against Pipedrive: the unanswered enquiries, the families, and the lesson that no DM had become a lead." },
    { id: "attendance", section: "library", name: "Daily Attendance Check", color: "cyan", status: "report", needs: "claude", url: "https://claude.ai/artifact/2iYnUgSMLhVjituxaCG7vR", owner: "Front desk",
      desc: "Aug 28, 2026 — one day of the parallel run: the coaches' court lists matched against Play by Point, the conflicts and the unpaid balances. The method behind the backend's attendance page." },
    { id: "alo", section: "library", name: "The Alo Playbook", color: "gray", status: "report", needs: "claude", url: "https://claude.ai/artifact/F4fCTamXo8YDaVxN5yoKRq", owner: "Leadership",
      desc: "Aug 27, 2026 — strategy memo: how Alo built a lifestyle brand, and the case for a tennis lifestyle brand built from the academy." },
    { id: "cult", section: "library", name: "The Cult Engine", color: "gray", status: "report", needs: "claude", url: "https://claude.ai/artifact/LL7DZpZCDLvuCUz3j7fQ13", owner: "Leadership · Marketing",
      desc: "Aug 28, 2026 — community and social strategy 2026 → 2028: serialized academy content and the rooms the algorithm can't touch. Companion to the Alo Playbook and the Launch File." },
    { id: "launch", section: "library", name: "The Proworld Launch File", color: "gray", status: "report", needs: "claude", url: "https://claude.ai/artifact/Muzh9bettcCqRiC6rg1iaL", owner: "Leadership",
      desc: "Aug 27, 2026 — five exercises: the investor autopsy, the existing customer, a $0 launch sequence, the competitive blind-spot map and the path to first revenue." },
    { id: "tennis-tryout", section: "library", name: "Tennis Section Try-Out", color: "gray", status: "archive", needs: "claude", url: "https://claude.ai/artifact/JnjuiS8tor5znuT1TtKU32", owner: "Leadership",
      desc: "The five ways a coach could fill the Tennis part of the quarterly (A–E). Decided Oct 8, 2026: option C — the coach's words plus a level per stroke — is live in the Coach Portal." }
  ];
  const SECTIONS = [
    { id: "tools", label: "Tools — in daily use", color: "" },
    { id: "proto", label: "Prototypes & plans", color: "cyan" },
    { id: "library", label: "Playbooks, pages & reports", color: "orchid" }
  ];
  // Outside tools with their own logins — shown to everyone, not part of access control.
  const OUTSIDE = [
    { name: "proworldacademy.com", url: "https://proworldacademy.com" },
    { name: "Instagram", url: "https://www.instagram.com/proworldacademy/" },
    { name: "Monday", url: "https://monday.com" },
    { name: "Slack", url: "https://proworldteam.slack.com" },
    { name: "Pipedrive", url: "https://app.pipedrive.com" },
    { name: "Play by Point", url: "https://book.proworldtennis.net" },
    { name: "Metricool", url: "https://app.metricool.com" },
    { name: "Canva", url: "https://www.canva.com" },
    { name: "Webflow", url: "https://webflow.com/dashboard" },
    { name: "QuickBooks", url: "https://qbo.intuit.com" },
    { name: "Google Drive", url: "https://drive.google.com" }
  ];
  const all = PAGES.map((p) => p.id);
  const ROLES = {
    owner: { label: "Owner", pages: all },
    admin: { label: "Admin", pages: all },
    desk: { label: "Front desk", pages: ["be-desk", "tryouts", "coach-board", "attendance", "leads"] },
    coach: { label: "Coach", pages: ["coach-portal", "tryouts", "mkt", "coach-board", "be-coach"] },
    marketing: { label: "Marketing", pages: ["mkt", "leads", "soccer", "pipeline", "ads-audit", "inbox-audit", "cult", "alo", "launch"] },
    editor: { label: "Editor", pages: ["mkt"] },
    parent: { label: "Family", pages: ["be-parent", "soccer"] }
  };
  // Pages that existed when the access lists were first saved (Oct 13, 2026). Anything added since is granted to
  // each person by their role's defaults the first time the Dashboard loads — owners can still untick it.
  const KNOWN_AT_SEED = ["mkt", "be-owner", "be-desk", "be-coach", "be-parent", "coach-portal", "coach-board", "attendance", "player-system", "leads", "ops"];
  const STATUS_LABEL = { here: "On this site", live: "Live", proto: "Prototype", plan: "Plan", page: "Page", report: "Report", archive: "Archive" };
  const NEEDS_LABEL = { passcode: "Team passcode", google: "Google sign-in", claude: "Opens in Claude", none: "" };
  window.PW_PAGES = { SITE, PORTAL, PAGES, SECTIONS, OUTSIDE, ROLES, KNOWN_AT_SEED, STATUS_LABEL, NEEDS_LABEL };
})();
