# Skill Rooms Community + Virality Blueprint

Last updated: 2026-06-02

Community + Virality is the next product track after the tournament engine. The goal is to make Skill Rooms feel alive, trusted, and shareable without reopening tournament architecture or making money claims before Kora/payment-provider approval.

## Product Goal

Skill Rooms should become the place Nigerian gamers talk about when they want:

- fair 1v1 rooms
- visible winners
- credible tournament results
- creator-hosted competitions
- public leaderboards
- clan/team identity
- shareable proof of skill
- transparent competition history

This track should make the platform feel public and culturally present, but still disciplined. It should not turn Skill Rooms into a noisy social feed, a betting site, or a fake hype dashboard.

## Public Surfaces

### Public Share Cards

Share cards should exist for:

- tournament detail pages
- winner/result pages
- leaderboard ranks
- clan/team profiles
- creator-hosted tournaments
- completed match/tournament highlights

Cards should be WhatsApp, X/Twitter, Facebook, Instagram story, and link-preview friendly.

Rules:

- show real game, player/team, rank, result, and tournament context
- avoid internal admin language
- do not show private evidence
- do not show disputed or unapproved results as final
- do not show payout-completed claims until payment automation or manual payout confirmation is reliable

### Tournament Highlights

Highlight pages should summarize approved results:

- champion
- finalist/top placements
- format
- game
- bracket/standing summary
- notable match results
- creator/sponsor attribution
- share actions

Highlights should only publish from completed or operator-approved tournament states.

### Winner Pages

Winner pages should show:

- player/team identity
- game
- event won
- route to victory
- verified result status
- share card
- related leaderboard movement

Payment wording must be conservative before Kora:

- allowed: `Prize reserved`, `Prize queued`, `Winner crowned`
- not allowed until verified: `Paid out`, `Withdrawn`, `Cash received`

### Public Leaderboards

Leaderboards should support:

- game filter
- city filter
- state/region filter
- campus/community filter when profile data supports it
- player/team mode
- time window: weekly, monthly, season, all-time

Ranking inputs:

- completed matches
- approved tournament placements
- wins/losses
- points
- no-show/dispute penalties
- reputation and trust safeguards

### Clan/Team Profiles

Clan/team pages should support:

- public profile
- logo/avatar
- captain and members
- games played
- record
- tournament history
- invite/apply flow
- moderation status

Do not expose private user contact details.

### Referral System

Referral should start with non-money rewards until payment/compliance direction is confirmed.

Allowed early rewards:

- profile badge
- waitlist priority
- tournament invite eligibility
- creator-hosting eligibility
- cosmetic/community recognition

Risk controls:

- one account per user policy
- duplicate account detection
- referral abuse flags
- reward hold until invited user completes meaningful action

### Community Announcements

Announcements should support:

- platform announcements
- tournament announcements
- creator/host updates
- sponsor notes
- maintenance/incidents
- winner/highlight posts

Admin/host permissions must control publishing.

### Livestream/Embed Support

Tournament and match pages should support external livestream links:

- YouTube
- Twitch
- Facebook Live
- TikTok Live link
- Kick or generic HTTPS link if safe

Embeds must be optional and sanitized. If embed safety is uncertain, show an external link instead of iframe content.

## Social Proof Rules

Safe now:

- matches completed
- tournaments hosted
- winners crowned
- rooms created
- disputes resolved
- players registered
- clans created
- entries checked in

Use caution:

- `Prize reserved`
- `Payout queued`
- `Refund queued`

Do not publish until Kora/payment flow is approved and reconciled:

- `NGN X paid out`
- `NGN X withdrawn`
- `NGN X earned`
- `instant payout`
- `guaranteed cashout`

If manual payout is confirmed outside provider automation, the UI must distinguish it from automated verified payout metrics.

## Privacy + Moderation Rules

Public pages must not expose:

- bank details
- email addresses
- phone numbers
- private evidence
- admin notes
- unresolved disputes as final results
- hidden moderation flags
- exact risk-rule triggers

Public pages may show:

- username/display name
- public profile bio/avatar
- game handles if profile visibility allows it
- approved results
- public reputation/trust badges
- clan/team affiliation

Moderation must be able to:

- unpublish highlights
- hide player/team profiles
- suppress share cards
- remove announcements
- mark results under review
- suspend referral rewards

## Implementation Roadmap

| Phase | Name | Status | What It Means |
|---|---|---:|---|
| C1 | Public Community Blueprint | Done | Define public pages, share model, referral rules, safe social proof, moderation boundaries, and roadmap. |
| C2 | Public Leaderboards | Done | Public leaderboard page, game/city/campus filters, player ranking pages, campus profile field, and honest completed-match/tournament metrics. |
| C3 | Winner Pages + Highlights | Done | Public highlights board, tournament winner pages, match winner pages, approved-result summaries, and share-ready public links. |
| C4 | Public Share Cards | Done | OG metadata and generated share cards for public tournament highlights, winner pages, room-result pages, and leaderboard rank pages. |
| C5 | Clan/Team Profiles | Done | Team identity, captain self-service management, public clan pages, members, records, and future tournament-entry linkage. |
| C6 | Referral System | Done | Referral links/codes, signup attribution, progress-based non-money rewards, and referral status visibility in profile. |
| C7 | Community Announcements | Done | Admin/host announcements, tournament updates, winner posts, incident/maintenance notices, and public news surfaces. |
| C8 | Livestream/Embed Support | Done | Safe livestream links/embeds on tournaments and match pages with provider-aware rendering and access boundaries. |
| C9 | Social Proof Dashboard | Done | Honest public metrics for matches, tournaments, winners, queue/reservation value, and explicit locks on verified payout-completion claims before Kora. |
| C10 | Mobile + Viral QA | Done | WhatsApp/X-friendly sharing, mobile preview polish, stronger OG coverage, and no false money claims. |

## Quality Bar

- No fake activity numbers.
- No static preview data on real public pages.
- No private data leaks.
- No gambling/casino tone.
- No payout claims before Kora/payment confirmation.
- Mobile-first, especially for WhatsApp sharing.
- Every public result must trace back to approved match/tournament state.

## Track Status

The Community + Virality roadmap is complete through C10. Any new community growth feature should start as its own planned follow-up track.
