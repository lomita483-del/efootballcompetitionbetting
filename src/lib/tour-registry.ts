import type { TourStep } from "@/components/TourGuide";

/**
 * Site-wide guided tour registry.
 *
 * Every page (player pages AND the admin console) has an entry here so the
 * onboarding tour can be mounted once, globally, from the shared Layout.
 * `resolveTour(pathname)` maps the current URL to its tour definition.
 */
export type TourDefinition = { key: string; name: string; steps: TourStep[] };

const NAV: TourStep = {
  target: "[data-tour='top-navigation']",
  title: "Platform Navigation",
  description:
    "Top navigation — jump between Matches, Virtual games, Leaderboard, Wallet, Chat, Support and every other area of the platform from any page.",
  placement: "bottom",
};

const ADS: TourStep = {
  target: "[data-tour='page-ads']",
  title: "Promotions & Announcements",
  description:
    "Promotion strip — sponsored offers, seasonal bonuses and platform announcements appear here at the bottom of each page.",
  placement: "top",
};

/** Build a tour from a page description plus its own middle steps. */
function page(name: string, intro: string, steps: TourStep[]): Omit<TourDefinition, "key"> {
  return {
    name,
    steps: [
      NAV,
      { target: "main", title: `${name} Overview`, description: intro },
      ...steps,
      ADS,
    ],
  };
}

const TOURS: Record<string, Omit<TourDefinition, "key">> = {
  "/": page("Home", "Home page — your daily hub: featured fixtures, live matches, category listings, news, lottery results and the live mini-leaderboard.", [
    { target: ".ecb-match-list", title: "Match Categories", description: "Category boards — each competition category lists its upcoming fixtures with 1 (home win), X (draw) and 2 (away win) odds. Tap any odds button to add it to your bet slip." },
    { target: "[data-tour='home-uncategorized']", title: "Uncategorized Matches", description: "Uncategorized Matches — fixtures that have not been assigned to a competition category still appear here so nothing is hidden from you." },
    { target: "aside", title: "Live Side Rail", description: "Side rail — latest news, most recent lottery draw, the live mini-leaderboard and the grand-prize winners board, all refreshed in real time." },
  ]),
  "/matches": page("Matches", "The Arena — every active fixture on the platform, with search, category filtering, live status tabs and an inline bet slip.", [
    { target: "[data-tour='matches-promo']", title: "Match Promotions", description: "Promo banners — active match announcements and offers; use the slider controls when more than one banner is available." },
    { target: ".ecb-reference-hero", title: "Featured Competition", description: "Featured Competition — the next highlighted fixture with its kick-off time and a direct Bet Now shortcut to its full market list." },
    { target: ".ecb-reference-hero + section", title: "Top Competitors", description: "Top Competitors — the current leading teams; open the full leaderboard to inspect rankings and points." },
    { target: ".ecb-arena-search", title: "Search & Categories", description: "Search and category filter — find a fixture by team name or Match ID, or narrow the arena down to one competition category." },
    { target: ".ecb-filter-pills", title: "Status Filters", description: "Status filters — All shows every active fixture grouped by category, Live shows matches in progress and Ended shows completed match history." },
    { target: ".ecb-match-list", title: "Match List & Odds", description: "Match list — matches are grouped by category. Pick 1, X or 2 to stake on a home win, draw or away win, or open a match for its full markets including Correct Score." },
    { target: ".ecb-home-rail .ecb-rail-card:first-child", title: "Bet Slip", description: "Bet slip — review your picks, remove any you no longer want, check the combined odds and potential winnings, then place the bet." },
    { target: ".ecb-home-rail .ecb-rail-card:last-child", title: "Popular Markets", description: "Popular Markets — the most used betting types: Match Winner, Total Goals, Both Teams to Score and Correct Score." },
    { target: ".ecb-stats-strip", title: "Live Arena Statistics", description: "Live stats bar — live and upcoming match totals, the platform payout rate, support availability and your referral shortcut." },
  ]),
  "/matches/$matchId": page("Match Details", "Match page — full detail for one fixture: line-up, score or countdown, and every betting market that has been opened for it.", [
    { target: "#correct-score", title: "Correct Score Market", description: "Correct Score — predict the exact final scoreline. Filter by home win, draw or away win, search a specific score, then tap a tile to add it to your slip." },
  ]),
  "/dashboard": page("Dashboard", "Dashboard — your personal control room: profile, tier progress, balance, activity statistics and quick access to every account tool.", [
    { target: "[data-tour='dashboard-welcome']", title: "Account Summary", description: "Welcome panel — your avatar, membership tier, join date and the XP progress bar toward your next tier." },
    { target: "[data-tour='dashboard-balance']", title: "Balance & Active Stakes", description: "Balance panel — current token balance, active bets and total bets placed, plus the Add Funds shortcut." },
    { target: "[data-tour='dashboard-quick']", title: "Quick Access", description: "Quick access tiles — open your bet slips, profile, withdrawals, token transfers and token requests in one tap." },
    { target: "[data-tour='dashboard-transactions-link']", title: "Transaction Records", description: "Transaction Records — the complete history of token credits, debits, deposits, stakes, rewards and transfers." },
    { target: "[data-tour='dashboard-referrals-link']", title: "Referrals", description: "Invite Now — share your referral details and track the rewards earned when new competitors join through you." },
    { target: "[data-tour='dashboard-rewards-link']", title: "Rewards & Achievements", description: "Achievements — badges and milestones unlocked through matches, activity and platform challenges." },
    { target: "[data-tour='dashboard-support-link']", title: "Support Center", description: "Help Center — create and follow support tickets for account, payment, match or betting assistance." },
    { target: "[data-tour='dashboard-activity']", title: "Activity Overview", description: "Activity overview — compare active, won, lost and pending bets alongside your overall win rate." },
    { target: "[data-tour='dashboard-challenges']", title: "Challenges & Streaks", description: "Challenges — challenge progress, daily streak goals and rewards you can claim from your activity." },
    { target: "[data-tour='dashboard-wallet']", title: "Wallet", description: "Wallet overview — your main token balance with direct links to funding, withdrawal and full wallet history." },
    { target: "[data-tour='dashboard-recent']", title: "Recent Transactions", description: "Recent transactions — your five latest balance movements, including amount, reason and exact time." },
  ]),
  "/leaderboard": page("Leaderboard", "Leaderboard — official standings for Top Teams, Top Shooters and Top Scorers, plus season rewards and achievements.", [
    { target: "[data-tour='leaderboard-table']", title: "Standings Table", description: "Standings — ranking, played, wins, draws, losses and points for every competitor. Rankings update automatically as matches settle." },
    { target: "[data-tour='leaderboard-side']", title: "Stats, Rewards & Achievements", description: "Side panels — live leaderboard statistics, the current reward holders for the top three positions and recently unlocked achievements. Use View All Rewards for the full prize list." },
  ]),
  "/wagers": page("Wagers", "Wagers — head-to-head challenges against other players, with escrowed stakes, live status and dispute handling.", [
    { target: "main a[href*='wager'], main button", title: "Create or Join a Wager", description: "Start a new head-to-head wager or accept an open challenge; the stake is held safely until the result is confirmed." },
  ]),
  "/virtual": page("Virtual Games", "Virtual — instant and championship simulated fixtures that run around the clock, so there is always something to stake on.", []),
  "/arcade": page("Arcade", "Arcade — casino-style mini-games including the roulette wheel. Every round is settled instantly against your token balance.", []),
  "/lottery": page("Lottery", "Lottery — buy numbered tickets for the current draw and follow past results and payouts.", []),
  "/tournament": page("Tournaments", "Tournaments — bracket competitions with entry requirements, progress rounds and prize pools.", []),
  "/chat": page("Chat", "Chat — real-time community channels. Mention a player with @name (or @all) to notify them on their devices, and react to messages.", []),
  "/shop": page("Shop", "Shop — redeem tokens for platform items and perks; your balance is debited on redemption.", []),
  "/checkout": page("Buy Tokens", "Buy Tokens — top up your balance. Choose an amount, complete payment and your tokens are credited to your wallet.", []),
  "/withdraw": page("Withdraw", "Withdraw — request a payout from your token balance. Requests are reviewed by an admin before they are paid out.", []),
  "/transactions": page("Transactions", "Transactions — the complete audit trail of every credit and debit on your account, with the reason and exact time of each movement.", []),
  "/bet-history": page("Bet History", "Bet History — every ticket you have placed, with stake, selections, odds and outcome. Open a ticket for its full breakdown.", []),
  "/watchlist": page("Watchlist", "Watchlist — the fixtures you starred, so you can return to them quickly before kick-off.", []),
  "/referrals": page("Referrals", "Referrals — share your personal invite code, track who joined through you and claim the rewards each referral earns.", []),
  "/achievements": page("Achievements", "Achievements — badges and milestones unlocked through betting activity, streaks, challenges and platform events.", []),
  "/tasks": page("Tasks", "Tasks — complete listed objectives to earn tokens, XP and Lucky Wheel spin points.", []),
  "/quests": page("Quests", "Quests — tiered objectives with progressively larger rewards; progress carries over between sessions.", []),
  "/trivia": page("Trivia", "Trivia — answer timed questions correctly to earn rewards. Each question can only be answered once.", []),
  "/polls": page("Polls", "Polls — vote on community questions and see live results from other players.", []),
  "/surveys": page("Surveys", "Surveys — short feedback forms; completing one can reward tokens and helps shape the platform.", []),
  "/gangs": page("Clans", "Clans — browse clans, compare member counts and treasury totals, and see who represents each clan.", []),
  "/notifications": page("Notifications", "Notifications — bet results, admin messages, mentions and payouts, including any images attached to a push message.", []),
  "/profile": page("Profile", "Profile — update your display name, avatar, contact details and public identity used across the leaderboard and chat.", []),
  "/settings": page("Settings", "Settings — control notification preferences, theme, privacy and security options for your account.", []),
  "/support": page("Support", "Support — open a ticket for account, payment or match issues and follow the conversation with the moderation team.", []),
  "/faq": page("FAQ", "FAQ — answers to the most common questions about betting, tokens, withdrawals and account management.", []),
  "/about": page("About", "About — who runs the platform, how it operates and how to get in touch.", []),
  "/guides/how-it-works": page("How It Works", "How It Works — a step-by-step explanation of tokens, placing bets, settlement and withdrawals.", []),
  "/mcp-docs": page("Agent Integrations", "Agent Integrations — connect an AI assistant to your account and see exactly which tools it can use on your behalf.", []),
  "/admin": page("Admin Console", "Admin Console — the command center. The sidebar groups every management area; the panel on the right is the tool you selected.", [
    { target: "[data-tour='admin-hero']", title: "Console Header", description: "Console header — shows your role, lets you toggle the frosted-glass view, reload the console and broadcast a forced reload to every active browser." },
    { target: "[data-tour='admin-sidebar']", title: "Management Sidebar", description: "Sidebar — grouped by Overview, Users & Community, Betting & Battles, Wallet & Payments, Rewards & Games, Content, Notifications and Configuration. Red badges show items waiting for action." },
    { target: "[data-tour='admin-panel']", title: "Active Panel", description: "Active panel — the selected management tool loads here. Analytics is the default landing panel for both Super Admins and moderators." },
  ]),
  "/mod": page("Moderation Console", "Moderation Console — the moderator view of the admin tools: chat moderation, tickets, appeals, users and match oversight.", []),
  "/admin/mcp-audit": page("MCP Audit Log", "MCP Audit Log — a traceable record of every AI-assistant tool call, with the acting user, the tool used and the exact timestamp.", []),
  "/admin/members": page("Member Management", "Member Management — full detail for a single member: profile, financials, activity, security and moderation actions.", []),
};

export function resolveTour(pathname: string): TourDefinition | null {
  const clean = pathname.replace(/\/+$/, "") || "/";
  const direct = TOURS[clean];
  if (direct) return { key: clean, ...direct };
  if (/^\/matches\/[^/]+$/.test(clean)) return { key: "/matches/$matchId", ...TOURS["/matches/$matchId"] };
  if (/^\/virtual(\/|$)/.test(clean)) return { key: "/virtual", ...TOURS["/virtual"] };
  if (/^\/wagers(\/|$)/.test(clean)) return { key: "/wagers", ...TOURS["/wagers"] };
  if (/^\/admin\/members\//.test(clean)) return { key: "/admin/members", ...TOURS["/admin/members"] };
  if (/^\/ticket\//.test(clean)) return { key: "/bet-history", ...TOURS["/bet-history"] };
  return null;
}