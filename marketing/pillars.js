// PROWORLD content database — pillar seed, watchlist seed and standing reminders. The live copies live in the
// page memory (pw-state: pillars, watchlist, reminders) and are edited from the dashboard; this file only seeds a fresh page.
window.PW_PILLARS = [
 {id:"hp", name:"Tennis · High Performance", share:24, color:"lime", owners:["Nico","Eric","Mauri","Quinnton"], prodKeys:["tennis"], archiveKeys:["hp","high perf","high-perf"],
  why:"The proof that the method produces players. HP content sets the standard the whole brand is judged by — intensity, detail, repetition — and it is what serious families look at first.",
  audience:"Parents of 12–18s already in competitive tennis, and the players themselves.",
  formats:["30–60s on-court Reel with one coaching cue","Slow-mo breakdown with text overlay","Talking head 45–75s","BTS of a real session, no narration"],
  angles:["Patterns of play — first three shots, serve +1, change of direction","Footwork — split step timing, recovery step, adjustment steps","Serve — rhythm before power, second-serve practice, toss","Return — position, taking the second serve early","Practice intensity — what an HP block actually looks like","Tactical decisions — when to attack, when to neutralize","Weapon building — one shot, one month","Match play from 30-30 and other pressure formats","Player progress — before/after over 30–90 days","Tournament results from the HP roster (facts, not claims)"],
  watch:"Pro practice-court footage, top junior academies' training reels, ATP/WTA coaching breakdowns.", notes:""},
 {id:"dev", name:"Tennis · Development U12 / U10 / U8", share:18, color:"mint", owners:["Kam","Robby","Coach ET"], prodKeys:["tennis"], archiveKeys:["dev","u12","u10","u8","development"],
  why:"The biggest enrollment funnel. Parents of 5–12 year-olds are deciding where their child starts; warm, expert, age-appropriate content wins them long before a trial lesson.",
  audience:"Parents of 5–12s (first-time tennis parents especially), local families in Delray / Boca / Boynton.",
  formats:["Reel of a drill with kids on court","Carousel for parents — what development looks like at this age","Talking head from a coach, direct to parents","Group energy clips for Stories"],
  angles:["What U8 / U10 / U12 development actually looks like at ProWorld","The ball-color progression (red–orange–green) explained for parents","Fundamentals by age — grip, swing path, split step, rally tolerance","Making practice fun and keeping attention at 6–8","Why we delay scoring at U8 and what we do instead","The U10 → U12 transition","How parents can support without pressure","Multi-sport play and athletic foundations","First-day-at-ProWorld stories","Tryout / enrollment moments for each age group"],
  watch:"Play-based coaching accounts, ITF Tennis Play & Stay material, parent-education creators.", notes:""},
 {id:"tips", name:"Tennis · Tips, Drills & Tournament Prep", share:11, color:"cyan", owners:["Nico","Eric","Mauri","Tonio"], prodKeys:["tournament"], archiveKeys:["tip","drill","tournament prep"],
  why:"Shareable, saveable, searchable. Tips travel beyond our followers and bring in players who then discover the academy. Tournament-prep content speaks to every competing family.",
  audience:"Juniors and adult players anywhere, competitive families before events.",
  formats:["60s single-drill Reel","Common mistake + fix side-by-side","Checklist carousel (bag, week-before, match morning)","Quick tactical whiteboard clip"],
  angles:["Drill of the week — one drill, one cue, one camera angle","Common mistake and the fix","The week before a tournament — load, logistics, mindset","Match-day morning routine","Scouting the opponent in the warm-up","Between-match recovery at a tournament","The 5-minute post-match debrief","Playing the big point — 30-30, break point, serving it out","What to pack — the match bag","Surface adjustments — clay vs hard"],
  watch:"Top tennis tip creators on Instagram/TikTok; note which hooks and lengths earn saves.", notes:""},
 {id:"mental", name:"Mental Performance", share:8, color:"orchid", owners:["Tonio"], prodKeys:["mental"], archiveKeys:["mental"],
  why:"Our most distinctive voice. Tonio's Rituals of Flow / SPORTmind framework is content few academies can match, and the archive shows mental posts outperform.",
  audience:"Competitive juniors and their parents, adult players, coaches.",
  formats:["Talking head 45–75s, direct to lens","On-court demo of a ritual with a player","5-slide framework carousel","Quote card for Stories"],
  angles:["Routine vs ritual","Pressure is content, not a problem","State before strategy","Between-points reset — breath, body, focus","Self-talk inside the ritual","Closing out — the 5-3 trap","Processing a loss the inside-out way","Body language as a state regulator","Pre-match ritual built from intention","Parents and the mental game — what to say after a match"],
  watch:"Sport psychology accounts, pro player interviews on routines, Tonio's own toniofernandez.com material.", notes:"Every Tonio piece ends with 'More at toniofernandez.com'."},
 {id:"tour", name:"On Tour with Flo", share:4, color:"cyan", owners:["Flo"], prodKeys:["tour"], archiveKeys:["tour","itf","on tour"],
  why:"Travel content is the most aspirational thing we publish: ProWorld players competing at ITF events abroad. It shows the pathway is real and it is cheap to produce — phone clips from the road.",
  audience:"Competitive families considering the pathway, players, the wider tennis community.",
  formats:["10–30s phone clips: arrival, venue, warm-up, result","60s player interview — three questions","Talking head from the hotel or court-side","Story sequences through a match day"],
  angles:["Arrival and venue tour","Player warm-up at court level","Match-day timeline with timestamps","Result clip the moment a player wins","Three questions with a player on tour","Why ITF events matter for development","Surface and climate adjustments","The hard moments — honest road content","Tournament food and recovery on the road","Why I take juniors abroad — Flo"],
  watch:"ITF Juniors, Tennis Europe and pro-tour travel content.", notes:"Flo's items are 'Daily' when a result happens — post results the same day."},
 {id:"soccer", name:"Soccer", share:10, color:"mint", owners:["Lukas"], prodKeys:["soccer"], archiveKeys:["soccer"],
  why:"The second sport in the system and a separate enrollment funnel, with its own parent audience. Soccer content also demonstrates the multi-sport athletic foundation.",
  audience:"Parents of 5–14 soccer players in the area, families already in tennis with siblings.",
  formats:["Drill Reel on the field","Talking head from Lukas","Session BTS / photo dump","Player spotlight"],
  angles:["First touch and ball mastery","Transitions — defense to attack","Decision-making — dribble vs pass","Soccer warm-up at ProWorld","The footwork crossover with tennis","What a complete young soccer player looks like","Birthday parties and community events on the pitch","Program start dates and tryouts"],
  watch:"Youth soccer coaching creators, academy accounts in South Florida.", notes:""},
 {id:"parents", name:"Parents Corner", share:8, color:"orchid", owners:["Production"], prodKeys:["parents"], archiveKeys:["parent"],
  why:"The parent is the second customer. Content that helps parents be better sports parents builds trust and is the most shared category in youth sport.",
  audience:"Every parent of a junior athlete — ours and the ones considering us.",
  formats:["5-slide carousel of practical guidance","Reel: what to say after a match — captions over court footage","Talking head from a coach when one is assigned","Parent testimonial"],
  angles:["How to talk to your child after a loss","Supporting vs pressuring","Sideline coaching and what to do instead","Choosing an academy — the questions to ask","The long view — a ten-year build","What investing in junior sport really means","The first conversation about goals","Match-day logistics for families","Confidence building at home","Parent testimonials and family stories"],
  watch:"Sports-parenting authors and creators, youth-sport psychology accounts.", notes:"Say what ProWorld does; no comparisons with other academies. Production-owned for now (Antonio and Lorenzo are off the filming roster)."},
 {id:"culture", name:"Culture, Community & Events", share:9, color:"lime", owners:["Production"], prodKeys:["culture","recap"], archiveKeys:["culture","community","vibes","event","hotelplanner","shootout"],
  why:"The brand's presence. Academy Vibes stories, the weekend HotelPlanner tournaments, families, coaches and players together — this is what makes people feel the place before they visit.",
  audience:"Local community, current families, adult players, partners.",
  formats:["Daily Academy Vibes story (2–3 iPhone clips)","Players in Action weekly recap Reel","Facility and golden-hour photo carousels","Coach roster / meet-the-team","Event recaps and collabs"],
  angles:["Academy Vibes — daily life on court","Players in Action — weekly results recap","Weekend tournaments at ProWorld (HotelPlanner / UTR)","Facility walk-throughs and B-roll","Meet the team","Family and community moments","Adult clinics, events and the club vibe","Mic'd-up coach / POV rally","Visiting pros and notable guests","Milestones — birthdays, anniversaries, firsts"],
  watch:"Club and lifestyle brands (Alo-style presence), local Delray/Boca community accounts.", notes:"Tournaments on site are for older players — don't claim every player competes where they train. Production-owned: vibes, recaps, photo carousels."},
 {id:"fitness", name:"Fitness & Recovery", share:4, color:"cyan", owners:["Tara"], prodKeys:["fitness"], archiveKeys:["fit","recover","nutrition","hydration"],
  why:"Athletic fitness is one of the four pillars of the method and Tara's content is practical and saveable — hydration, fueling, mobility, sleep.",
  audience:"Juniors and parents, adult players.",
  formats:["Batch Reel — 3–5 movements in one video","Talking head on one rule","Carousel — foods, tests, routines","Demo with a player in the fitness room"],
  angles:["Fueling for match day","Hydration rules","Mobility — hip, shoulder, ankle, thoracic","Strength without bulk for tennis","Sleep for athletes","The third-set fade and how to close it","Recovery between matches","Warm-up vs stretching","Fitness tests you can do at home","What 'athletic tennis player' means"],
  watch:"Sports science and S&C accounts, tennis-specific fitness coaches.", notes:""},
 {id:"promo", name:"Programs & Promos", share:4, color:"orchid", owners:["Production"], prodKeys:["promo"], archiveKeys:["promo","program","camp","enroll","trial"],
  why:"Conversion. Camps, trial weeks, open houses and program starts need clear, branded, dated posts — and the rule is every third post in a push references registration.",
  audience:"Families ready to act.",
  formats:["Branded static with dates and CTA","5-slide what's-included carousel","Countdown and last-call graphics","Story sequence of a camp day"],
  angles:["Thanksgiving Camp (Nov 23–27)","Holiday / Winter camp","Spring camp","Summer Camp","Trial week","Open house","Program start dates and tryouts","Early-bird and limited-spots moments","Parent FAQ before enrolling","The system explained — one method, all day, across areas"],
  watch:"Seasonal timing: camps sell 4–6 weeks out.", notes:"Academics are not offered yet — leave them out of promos. Production-owned: carousels and statics, no coach on camera needed."}
];

// Accounts the engine reviews every Monday (editable on the Content Database tab)
window.PW_WATCHLIST = [
 {
  "handle": "axistennis",
  "name": "AXIS Tennis Academy",
  "type": "competitor",
  "where": "Delray Beach / Boynton Beach",
  "why": "Closest direct rival — clay in Delray, hard courts in Boynton. Watch programs, camps and how they talk to the same families.",
  "addedAt": "2026-10-04",
  "by": "engine"
 },
 {
  "handle": "everttennisacademy",
  "name": "Evert Tennis Academy",
  "type": "competitor",
  "where": "Boca Raton",
  "why": "The big Boca name. Watch how they use player results and the pathway story to build trust.",
  "addedAt": "2026-10-04",
  "by": "engine"
 },
 {
  "handle": "rickmaccitennis",
  "name": "Rick Macci Tennis Academy",
  "type": "competitor",
  "where": "Boca Raton",
  "why": "Coach-led brand: a famous coach's personality and young-player clips turned into reach and inquiries.",
  "addedAt": "2026-10-04",
  "by": "engine"
 },
 {
  "handle": "delraybeachtennis",
  "name": "Delray Beach Tennis Center",
  "type": "competitor",
  "where": "Delray Beach",
  "why": "Owns local community mindshare (Delray Beach Open, clinics, events) in our own backyard.",
  "addedAt": "2026-10-04",
  "by": "engine"
 },
 {
  "handle": "tennispreserve",
  "name": "Tennis Preserve at Ironhorse",
  "type": "competitor",
  "where": "West Palm Beach",
  "why": "Tiered junior ladder plus mental coaching, fitness and boarding — close to our pillars. Watch how they explain the pathway.",
  "addedAt": "2026-10-04",
  "by": "engine"
 },
 {
  "handle": "wpbja",
  "name": "West Palm Beach Junior Academy",
  "type": "competitor",
  "where": "West Palm Beach",
  "why": "Dedicated junior academy account — benchmark for local posting cadence, player features and results.",
  "addedAt": "2026-10-04",
  "by": "engine"
 },
 {
  "handle": "savianotennis",
  "name": "Saviano High Performance Tennis",
  "type": "competitor",
  "where": "Davie",
  "why": "Leads with proof points (coaching ratio, placements) — an example of turning facts into repeatable content.",
  "addedAt": "2026-10-04",
  "by": "engine"
 },
 {
  "handle": "_flatennis",
  "name": "Fort Lauderdale Academy of Tennis",
  "type": "competitor",
  "where": "Fort Lauderdale",
  "why": "Packages after-school levels clearly for Broward families. Handle may also appear as _f.l.a.t — confirm.",
  "addedAt": "2026-10-04",
  "by": "engine"
 },
 {
  "handle": "extremetennisacademy",
  "name": "Extreme Tennis Academy",
  "type": "competitor",
  "where": "Aventura / Miami",
  "why": "Miami-Dade high-performance program competing for elite South Florida juniors.",
  "addedAt": "2026-10-04",
  "by": "engine"
 },
 {
  "handle": "imgacademy",
  "name": "IMG Academy",
  "type": "competitor",
  "where": "Bradenton",
  "why": "The benchmark Florida multi-sport academy families compare everyone against — polished athlete stories and campus content.",
  "addedAt": "2026-10-04",
  "by": "engine"
 },
 {
  "handle": "saddlebrookresort",
  "name": "Saddlebrook (Tennis Academy)",
  "type": "competitor",
  "where": "Wesley Chapel",
  "why": "Resort-and-academy brand marketing junior tennis to travelling families; watch camp promotions.",
  "addedAt": "2026-10-04",
  "by": "engine"
 },
 {
  "handle": "emilio_sanchez_academy_fl",
  "name": "Emilio Sanchez Academy",
  "type": "competitor",
  "where": "Naples",
  "why": "Full-time academy lifestyle presented from a 38-court campus.",
  "addedAt": "2026-10-04",
  "by": "engine"
 },
 {
  "handle": "mouratoglouacademy",
  "name": "Mouratoglou Academy",
  "type": "competitor",
  "where": "Biot (France) · US centers",
  "why": "The reference premium academy brand — training, player stories and one consistent look. Confirm the handle on first review.",
  "addedAt": "2026-10-04",
  "by": "engine"
 },
 {
  "handle": "mouratogloutenniscenters",
  "name": "Mouratoglou Tennis Centers",
  "type": "competitor",
  "where": "global · Florida site",
  "why": "Network brand account: how one academy brand shows up across many locations.",
  "addedAt": "2026-10-04",
  "by": "engine"
 },
 {
  "handle": "bocaunitedfc",
  "name": "Boca United FC",
  "type": "competitor",
  "where": "Boca Raton",
  "why": "Youth soccer club with rec, travel and pre-academy pathways — same families we want for soccer. Watch registration and tryout posts.",
  "addedAt": "2026-10-04",
  "by": "engine"
 },
 {
  "handle": "southfloridafa",
  "name": "South Florida Football Academy",
  "type": "competitor",
  "where": "Palm Beach County",
  "why": "Academy-style soccer program — benchmark for how a pathway to pro is presented to parents.",
  "addedAt": "2026-10-04",
  "by": "engine"
 },
 {
  "handle": "patrickmouratoglou",
  "name": "Patrick Mouratoglou",
  "type": "inspiration",
  "where": "global",
  "why": "A founder's voice carrying an academy brand: coaching insight, tour commentary, academy updates.",
  "addedAt": "2026-10-04",
  "by": "engine"
 },
 {
  "handle": "rafanadalacademy",
  "name": "Rafa Nadal Academy",
  "type": "inspiration",
  "where": "Manacor, Spain",
  "why": "Gold-standard academy content blending training, education and a story — a template for presenting our four pillars.",
  "addedAt": "2026-10-04",
  "by": "engine"
 },
 {
  "handle": "gtgtennisacademy",
  "name": "Good to Great Tennis Academy",
  "type": "inspiration",
  "where": "Stockholm · Raleigh",
  "why": "Clean pro-pathway brand and coach-led training content; premium positioning without noise.",
  "addedAt": "2026-10-04",
  "by": "engine"
 },
 {
  "handle": "essentialtennis",
  "name": "Essential Tennis",
  "type": "inspiration",
  "where": "global",
  "why": "Short technique and strategy lessons that fix one thing at a time — the model for our coach-tip Reels.",
  "addedAt": "2026-10-04",
  "by": "engine"
 },
 {
  "handle": "toptennistraining",
  "name": "Top Tennis Training",
  "type": "inspiration",
  "where": "global",
  "why": "Drill-driven clips with clear cues — turning everyday practice footage into saveable Reels.",
  "addedAt": "2026-10-04",
  "by": "engine"
 },
 {
  "handle": "coshannessy",
  "name": "Craig O'Shannessy · Brain Game",
  "type": "inspiration",
  "where": "global",
  "why": "Data-driven match and strategy breakdowns — inspiration for storytelling around individual player assessments.",
  "addedAt": "2026-10-04",
  "by": "engine"
 },
 {
  "handle": "yannauzoux",
  "name": "Yann Auzoux",
  "type": "inspiration",
  "where": "Washington DC area",
  "why": "A coach mentoring tennis parents and players — the model for parent-education content in a coach's voice.",
  "addedAt": "2026-10-04",
  "by": "engine"
 },
 {
  "handle": "briancainpeak",
  "name": "Brian Cain Peak Performance",
  "type": "inspiration",
  "where": "USA",
  "why": "Mental-performance coach turning routines and mindset cues into short shareable clips — reference for Tonio's pillar.",
  "addedAt": "2026-10-04",
  "by": "engine"
 },
 {
  "handle": "cindrakamphoff",
  "name": "Dr. Cindra Kamphoff",
  "type": "inspiration",
  "where": "USA",
  "why": "Sport psychologist translating confidence and resilience into routines athletes and parents can use.",
  "addedAt": "2026-10-04",
  "by": "engine"
 },
 {
  "handle": "positivecoachus",
  "name": "Positive Coaching Alliance",
  "type": "inspiration",
  "where": "USA",
  "why": "Simple shareable frameworks for coaches, parents and athletes — a model for parent-education posts.",
  "addedAt": "2026-10-04",
  "by": "engine"
 },
 {
  "handle": "ctgprojecthq",
  "name": "Changing The Game Project",
  "type": "inspiration",
  "where": "USA",
  "why": "Parent-and-coach education brand — trust-building content aimed at families.",
  "addedAt": "2026-10-04",
  "by": "engine"
 },
 {
  "handle": "coervercoaching",
  "name": "Coerver Coaching",
  "type": "inspiration",
  "where": "global",
  "why": "A soccer methodology shown in short demo clips (Ball Mastery Pyramid) — template for Lukas's soccer content.",
  "addedAt": "2026-10-04",
  "by": "engine"
 },
 {
  "handle": "sportyandrich",
  "name": "Sporty & Rich",
  "type": "inspiration",
  "where": "global",
  "why": "Tennis-club lifestyle brand with a distinctive, consistent aesthetic — reference for premium look and photography.",
  "addedAt": "2026-10-04",
  "by": "engine"
 }
];

// Standing to-dos around the engine (Workflow tab)
window.PW_REMINDERS = [
 {
  "id": "rm_slack",
  "text": "Automate the briefs — Sunday-night Slack post to the coaches channel + Friday reminder to whoever hasn't delivered",
  "note": "Decided Oct 4: run it by hand first, automate once the rhythm holds. Ask Claude to switch it on and name the channel (#tennis-core?).",
  "status": "open",
  "at": "2026-10-04"
 },
 {
  "id": "rm_network",
  "text": "Allow graph.facebook.com and instagram.com in Claude's network settings",
  "note": "claude.ai → Settings → Organization settings → Capabilities → Code execution → Network access. Needed before any Claude run can call Meta's API.",
  "status": "open",
  "at": "2026-10-04"
 },
 {
  "id": "rm_api",
  "text": "Connect the Instagram API (Meta Business app + System User token)",
  "note": "@proworldacademy as a Business account linked to a Facebook Page → developers.facebook.com Business app → Instagram API → System User token (instagram_basic, instagram_manage_insights, pages_read_engagement, business_management). Save the token in a private Drive file 'PROWORLD IG token'. Alternative: the Metricool connector.",
  "status": "open",
  "at": "2026-10-04"
 },
 {
  "id": "rm_share",
  "text": "Share settings: anyone with the link on both pages; invite Manu by email as editor",
  "note": "Command Center and the PROWORLD Dashboard — Share menu on each page. Link viewers are read-only; editors can save.",
  "status": "open",
  "at": "2026-10-04"
 },
 {
  "id": "rm_photog",
  "text": "Photographer — add the name and shoot day on the Workflow tab (Edit team)",
  "note": "The shot list is addressed to whoever is set there.",
  "status": "open",
  "at": "2026-10-04"
 },
 {
  "id": "rm_camp",
  "text": "Thanksgiving Camp — confirm registration link, price and the date registration opens",
  "note": "The promo items (tg1–tg6) need the link and the price before they go out.",
  "status": "open",
  "at": "2026-10-04"
 }
];
