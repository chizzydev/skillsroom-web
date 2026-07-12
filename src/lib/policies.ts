import type { Metadata } from "next";

export type PolicySection = {
  title: string;
  body: string;
  bullets?: string[];
};

export type PolicyEntry = {
  slug: string;
  path: string;
  eyebrow: string;
  title: string;
  description: string;
  summary: string;
  updatedAt: string;
  sections: PolicySection[];
};

const updatedAt = "June 2, 2026";

export const policyEntries: PolicyEntry[] = [
  {
    slug: "terms",
    path: "/terms",
    eyebrow: "Legal",
    title: "Terms of Service",
    description: "The operating terms for using Skillsroom, entering competitions, and accepting moderated settlement outcomes.",
    summary: "Who can use Skillsroom, how competitions operate, and what platform decisions control settlement, suspension, and access.",
    updatedAt,
    sections: [
      {
        title: "Platform scope",
        body: "Skillsroom is a competitive gaming platform for skill-based rooms, tournaments, moderation review, and controlled settlement. It is not designed as a chance-based betting, casino, or prediction-market product.",
        bullets: [
          "Every match or tournament must have a defined game, ruleset, format, and result flow.",
          "Money movement, payout queues, and refunds follow the visible wallet and review workflow.",
          "Some reviews may be handled manually where evidence, payment, or player support needs a closer look."
        ]
      },
      {
        title: "Account and access duties",
        body: "Users must provide truthful account information, use only accounts they control, and keep login credentials secure.",
        bullets: [
          "Impersonation, account sharing, fake identities, and misleading payment details are prohibited.",
          "A player may be asked to verify identity, game ownership, or funding history before access continues.",
          "Operators may suspend or restrict access where risk, abuse, or unresolved verification issues exist."
        ]
      },
      {
        title: "Competition participation",
        body: "Entering a room or tournament means the player accepts the posted format, game mode, timing, evidence requirements, and review rules.",
        bullets: [
          "Players are responsible for arriving on time, using the right game account, and complying with the event instructions.",
          "Failure to check in, submit evidence, or follow the rules may lead to voids, forfeits, refunds, disqualification, or restrictions.",
          "Tournament hosts can manage event flow only within the permissions granted by Skillsroom."
        ]
      },
      {
        title: "Settlement and commissions",
        body: "Prize reservations, payout queues, refunds, and commissions are governed by the product ledger and moderator decisions, not by player expectation alone.",
        bullets: [
          "A winner is not finally entitled to payout until the result is approved and the settlement state reaches the correct stage.",
          "Skillsroom may hold, void, refund, or reverse a settlement where fraud, reporting conflict, payment failure, or policy breach exists.",
          "Platform commissions, when configured, are deducted according to the published room or tournament setup."
        ]
      },
      {
        title: "Suspension, termination, and limits",
        body: "Skillsroom may pause activity, remove content, or restrict access where abuse, fraud, rule-breaking, or operational integrity requires it.",
        bullets: [
          "Operator decisions are guided by the evidence trail, ledger state, moderation history, and policy set.",
          "Access may also be limited by age, location, payment availability, or platform rules.",
          "Support can explain account restrictions where the platform is able to share details."
        ]
      }
    ]
  },
  {
    slug: "rules",
    path: "/rules",
    eyebrow: "Competition",
    title: "Competition Rules Policy",
    description: "The baseline operating rules for rooms, tournaments, reporting windows, evidence expectations, and admin decisions.",
    summary: "How official rules are defined, how players are expected to play and report, and how moderators resolve competition outcomes.",
    updatedAt,
    sections: [
      {
        title: "Official rule sources",
        body: "Every room or tournament must name the applicable game, format, map or mode details where relevant, scoring model, and any event-specific restrictions before play starts.",
        bullets: [
          "Tournament pages, room setup, and attached rulesets are the official source of truth for that competition.",
          "Where event rules conflict with core platform fairness rules, the platform rule wins.",
          "Custom creator or sponsor events cannot override integrity, payment, or evidence policy."
        ]
      },
      {
        title: "Check-in and readiness",
        body: "Players and teams must confirm readiness through the required room join, check-in, or roster process.",
        bullets: [
          "Late arrival can produce a no-show, forfeit, replacement, or bracket advancement decision.",
          "Using the wrong roster, wrong game account, or unapproved substitute can invalidate a result.",
          "Tournament hosts and operators may set round-ready windows to keep brackets moving."
        ]
      },
      {
        title: "Match reporting",
        body: "Reported scores must match the actual played result and be supported where required by screenshots, video, or both.",
        bullets: [
          "Do not report until the match is complete unless the match ended through a valid forfeit or no-show.",
          "Players should retain raw evidence until the review window and any appeal window have expired.",
          "False reporting is treated as a serious trust violation."
        ]
      },
      {
        title: "Operator review",
        body: "Skillsroom operators may confirm, reject, void, or otherwise resolve results based on the evidence trail, timestamps, participation state, and applicable event rules.",
        bullets: [
          "Tournament result reviews may also issue no-show, forfeit, or disqualification outcomes.",
          "Bracket advancement or standings updates follow the approved review outcome.",
          "Operator rulings are recorded in the audit trail and may be final where the evidence standard is met."
        ]
      }
    ]
  },
  {
    slug: "prizes",
    path: "/prizes",
    eyebrow: "Prizes",
    title: "Prize Policy",
    description: "How prize pools are funded, described, reserved, queued, reduced, or withheld across rooms and tournaments.",
    summary: "What counts as a prize commitment, how prize sources work, and when a prize can be delayed, reduced, or cancelled.",
    updatedAt,
    sections: [
      {
        title: "Prize sources",
        body: "Prize pools can come from participant entries, sponsor contributions, platform bonuses, or approved manual adjustments.",
        bullets: [
          "The event page should clearly state whether the competition is free, paid, sponsored, or hybrid.",
          "A sponsor promise is not treated as settled money until it has reached the approved platform workflow.",
          "Prize structure may be winner-take-all, split, fixed-placement, or another published format."
        ]
      },
      {
        title: "Published prize language",
        body: "Skillsroom should only describe prize states with language supported by the ledger and moderation flow.",
        bullets: [
          "Reserved means the platform has recorded the obligation but has not completed payout.",
          "Queued means the payout or refund is awaiting manual or provider-side execution.",
          "Paid or completed language is used only when the platform has confirmed the payout state."
        ]
      },
      {
        title: "When prizes can change",
        body: "A listed prize can be delayed, reduced, cancelled, or redistributed where the competition is voided, underfunded, fraudulent, or materially non-compliant.",
        bullets: [
          "Examples include sponsor non-performance, payment failure, collusion, bracket invalidation, or disqualification.",
          "If a prize structure changes after registration opens, the platform should notify affected players clearly.",
          "Skillsroom may also hold a prize while ownership, identity, or bank details are reviewed."
        ]
      },
      {
        title: "Player responsibilities",
        body: "Winners may need to provide payout-ready information, confirm identity, and comply with support requests before any prize leaves the queue.",
        bullets: [
          "Incorrect bank details can delay or fail a payout.",
          "Tax reporting obligations, where applicable, remain the responsibility of the recipient unless local law says otherwise.",
          "Attempting to route payouts through another person without approval may trigger review or restriction."
        ]
      }
    ]
  },
  {
    slug: "refunds",
    path: "/refunds",
    eyebrow: "Refunds",
    title: "Refund Policy",
    description: "When entry money can be returned, partially returned, held, or denied across rooms and tournaments.",
    summary: "How cancellations, voids, duplicate funding, payment failures, and misconduct affect refunds.",
    updatedAt,
    sections: [
      {
        title: "Refund-eligible cases",
        body: "Refunds may be available where a room or tournament does not validly proceed, where payment was duplicated, or where the platform voids the competition outcome.",
        bullets: [
          "A match cancelled before valid play can qualify for a full refund.",
          "Duplicate or excess funding can be corrected after review.",
          "Event cancellation by the platform or an approved sponsor failure can trigger a refund process."
        ]
      },
      {
        title: "Cases that may not qualify",
        body: "Refunds are not automatic where a player loses fairly, breaches rules, abandons play, or causes the failure that led to the issue.",
        bullets: [
          "No-show, account misuse, cheating, or evidence tampering can lead to denial of refund.",
          "A player who enters the wrong room or ignores a clear event rule may not be entitled to reversal.",
          "Administrative effort alone does not guarantee a refund if the underlying competition was valid."
        ]
      },
      {
        title: "Refund workflow",
        body: "Approved refunds move through the platform ledger before any actual outbound transfer occurs.",
        bullets: [
          "Refunds may be reserved, queued, completed, failed, or cancelled depending on the current payment process.",
          "Manual review may request room code, transfer proof, timestamps, and the reason for reversal.",
          "Refund timing can vary based on provider, banking, and fraud review."
        ]
      },
      {
        title: "Platform discretion",
        body: "Skillsroom may combine refunds with other actions such as voiding a result, reversing a settlement, or restricting an account.",
        bullets: [
          "Where fraud is suspected, a refund may be delayed until review completes.",
          "Where only part of a pool is impacted, the platform may issue partial refunds instead of a full event reversal.",
          "All refund decisions should be auditable."
        ]
      }
    ]
  },
  {
    slug: "disputes",
    path: "/disputes",
    eyebrow: "Disputes",
    title: "Dispute Policy",
    description: "The rules for challenging scores, no-shows, forfeits, evidence, roster issues, and settlement outcomes.",
    summary: "What can be disputed, how quickly it must be raised, what evidence is required, and what decisions admins can make.",
    updatedAt,
    sections: [
      {
        title: "When to dispute",
        body: "A dispute should be raised promptly when a reported result is wrong, incomplete, misleading, or unsupported.",
        bullets: [
          "Do not wait until payout has progressed if the issue is already known.",
          "Tournament disputes should normally be raised within the round review window.",
          "Late disputes may be rejected where bracket or payout dependence makes reversal unsafe."
        ]
      },
      {
        title: "Evidence standard",
        body: "A dispute should explain what happened and attach the best available evidence, not just a conclusion.",
        bullets: [
          "Useful evidence includes lobby screenshots, end-of-match screens, recordings, room chat, and timeline notes.",
          "Edited, cropped, or inconsistent evidence may carry less weight or trigger deeper review.",
          "Refusing to provide requested evidence may weaken a claim."
        ]
      },
      {
        title: "Review outcomes",
        body: "After review, Skillsroom may confirm the score, reject the claim, void the match, assign a forfeit, mark a no-show, disqualify an entrant, or issue a refund-related action.",
        bullets: [
          "Tournament rulings can affect standings, bracket advancement, and prize eligibility.",
          "Match rulings can affect room settlement, trust signals, and future access.",
          "Operators may also escalate a dispute into a moderation investigation."
        ]
      },
      {
        title: "Finality and escalation",
        body: "Some outcomes may be final once the platform has enough evidence and downstream actions would be unsafe to unwind.",
        bullets: [
          "A reopened case normally requires material new evidence, not just disagreement.",
          "Emergency holds may still be placed where fraud or serious trust concerns appear after a decision.",
          "Support may explain what information is still needed when a case cannot be reopened."
        ]
      }
    ]
  },
  {
    slug: "conduct",
    path: "/conduct",
    eyebrow: "Conduct",
    title: "Prohibited Conduct Policy",
    description: "The behavior rules that keep Skillsroom fair, respectful, and useful for players, hosts, and communities.",
    summary: "What users, teams, creators, and sponsors may not do on the platform.",
    updatedAt,
    sections: [
      {
        title: "Fraud and manipulation",
        body: "Cheating, collusion, fake evidence, account farming, and funding manipulation are prohibited.",
        bullets: [
          "Do not stage fake matches, fake tournaments, or coordinated loser/winner swaps.",
          "Do not submit fabricated screenshots, edited recordings, or stolen payment proof.",
          "Do not exploit platform bugs or workflow gaps for financial or ranking advantage."
        ]
      },
      {
        title: "Account misuse",
        body: "Users may not evade moderation, share accounts, impersonate others, or use unapproved substitute players or rosters.",
        bullets: [
          "Smurfing or reputation laundering through alternate accounts may be treated as abuse.",
          "Players must not hand a live room or tournament slot to another person without approval.",
          "Fake creator, sponsor, or operator identity is a serious violation."
        ]
      },
      {
        title: "Harassment and abuse",
        body: "Threats, hate speech, extortion, doxxing, or targeted harassment toward players, staff, or creators are not allowed.",
        bullets: [
          "Pressure tactics around payout, dispute review, or public shaming can also trigger enforcement.",
          "Support and review channels must not be spammed with abusive or deceptive submissions.",
          "Skillsroom may remove posts, messages, or profile content that hurts the community experience."
        ]
      },
      {
        title: "Consequences",
        body: "Violations can lead to warnings, holds, disqualification, loss of prize eligibility, refund denial, suspension, or permanent removal.",
        bullets: [
          "Enforcement may also include ledger holds and evidence retention.",
          "Severe cases may be escalated to payment, support, or appropriate external review where necessary.",
          "The platform may pause activity while a serious issue is being reviewed."
        ]
      }
    ]
  },
  {
    slug: "eligibility",
    path: "/eligibility",
    eyebrow: "Eligibility",
    title: "Age and Eligibility",
    description: "The age, location, account, and payout-readiness rules for entering Skillsroom competitions.",
    summary: "Who can participate, who can win prizes, and what checks may be required before a player or host is allowed to compete.",
    updatedAt,
    sections: [
      {
        title: "Age rule",
        body: "Skillsroom rooms, tournaments, and prize-bearing activity are intended for players who meet the required age for their location and event type.",
        bullets: [
          "Players may be asked to confirm age before entering paid or prize-bearing events.",
          "Accounts believed to belong to minors may be suspended or restricted pending review.",
          "Any youth program would need its own rules, consent flow, and event limits."
        ]
      },
      {
        title: "Location and access",
        body: "Participation may be limited by country, state, campus, community, event rules, or payment availability.",
        bullets: [
          "A competition may be open only to specified regions or communities.",
          "The platform may block or limit access where rules, provider requirements, or fraud risk requires it.",
          "Creators and sponsors cannot bypass geo or age restrictions through custom event wording."
        ]
      },
      {
        title: "Identity and payout readiness",
        body: "A winner may need to verify identity, bank details, and account ownership before remaining prize-eligible.",
        bullets: [
          "False age claims or false banking details can invalidate eligibility.",
          "Repeated evasion of verification checks can lead to suspension.",
          "Skillsroom may hold prize processing until the necessary checks are complete."
        ]
      }
    ]
  },
  {
    slug: "privacy",
    path: "/privacy",
    eyebrow: "Privacy",
    title: "Privacy Policy",
    description: "How Skillsroom collects, uses, stores, reviews, and limits access to account, payment, evidence, and moderation data.",
    summary: "What data is collected, why it is used, who can access it, how long it may be retained, and what rights users can request.",
    updatedAt,
    sections: [
      {
        title: "Data we collect",
        body: "Skillsroom may collect account details, profile data, linked auth identity, game handles, room and tournament activity, funding proof, evidence, moderation records, device/session logs, and support submissions.",
        bullets: [
          "Community pages show only the profile, event, and winner details meant for public viewing.",
          "Evidence, operator notes, legal-hold records, and certain settlement details stay access-controlled.",
          "We may also collect technical logs needed for fraud detection and product security."
        ]
      },
      {
        title: "Why we use it",
        body: "Data is used to run competitions, review evidence, manage trust, resolve disputes, prevent fraud, support users, and comply with operational requirements.",
        bullets: [
          "We do not need private evidence to become public just because a result becomes public.",
          "Payment and identity data may be used to verify ownership, prevent abuse, and reconcile issues.",
          "Moderation history can influence future trust or review decisions."
        ]
      },
      {
        title: "Sharing and access",
        body: "Data access should be role-scoped and limited to what the viewer needs for the product or support flow.",
        bullets: [
          "Operators can access more than ordinary players because review and safety work requires it.",
          "Third-party providers should receive only the data necessary for auth, storage, communications, or payments.",
          "We should not sell user personal data as part of the platform model."
        ]
      },
      {
        title: "Retention and rights",
        body: "Some data can be deleted quickly, but evidence, payout, moderation, and audit records may need longer retention or legal hold.",
        bullets: [
          "Retention schedules follow the platform evidence, payout, support, and account-review workflow.",
          "Users can request correction or support review of inaccurate information where appropriate.",
          "Privacy practices may be updated as Skillsroom expands to new regions or providers."
        ]
      }
    ]
  },
  {
    slug: "compliance",
    path: "/compliance",
    eyebrow: "Skill Gaming",
    title: "Skill Gaming Notes",
    description: "How Skillsroom keeps competitions focused on skill, clear rules, evidence-backed results, and reviewed settlement.",
    summary: "The platform position on skill-based rooms and tournaments, payouts, age limits, and provider requirements.",
    updatedAt,
    sections: [
      {
        title: "Current product position",
        body: "Skillsroom is being designed as a skill-based competitive gaming platform with defined rules, evidence-backed result review, and controlled settlement. It is not intended to offer chance-based betting, casino games, or speculative outcome markets.",
        bullets: [
          "Every competition should have a skill-based format, clear entrant structure, and moderator review path.",
          "Skillsroom does not frame competition as gambling, easy money, or random-win betting.",
          "No random chance mechanic should determine whether a player wins a room or tournament."
        ]
      },
      {
        title: "Payments and payouts",
        body: "Skillsroom describes money states according to the actual wallet, ledger, review, and payout workflow.",
        bullets: [
          "Manual or assisted review may be used where it keeps the process clear and auditable.",
          "Reserved and queued payout language may be used only when backed by real ledger states.",
          "Completed payout totals should reflect confirmed platform records."
        ]
      },
      {
        title: "Operating controls",
        body: "Skillsroom depends on clear rules, provider requirements, account checks, and operational controls staying aligned.",
        bullets: [
          "Rules, privacy, refunds, disputes, and regional requirements should remain clear as the platform grows.",
          "Payment providers and banking partners should understand the skill-based competition flow.",
          "Identity, fraud review, age controls, and region limits should match law and provider requirements."
        ]
      },
      {
        title: "Regional limits",
        body: "Skill-gaming rules can differ by location, provider, and event type, so Skillsroom may limit some formats in some places.",
        bullets: [
          "If a location requires stricter rules, the stricter rule controls.",
          "If a format needs approval in a market, Skillsroom should not offer that format there without approval.",
          "Expansion into new countries should include region-specific review."
        ]
      }
    ]
  },
  {
    slug: "trust",
    path: "/trust",
    eyebrow: "Trust Layer",
    title: "Trust and Safety",
    description: "How evidence, moderation, holds, reputation, and controlled settlement keep Skillsroom fair and reviewable.",
    summary: "The trust model behind rooms, tournaments, evidence review, moderation, and payout control.",
    updatedAt,
    sections: [
      {
        title: "Evidence-first review",
        body: "The trust system depends on evidence trails, state transitions, moderation notes, and audit records rather than blind payout automation.",
        bullets: [
          "Rooms and tournaments should be reviewable from check-in to settlement.",
          "Evidence visibility should remain role-scoped and logged.",
          "Disputes and enforcement actions should preserve auditability."
        ]
      },
      {
        title: "Risk controls",
        body: "Skillsroom may use moderation status, account maturity, funding anomalies, device patterns, and dispute history as risk signals.",
        bullets: [
          "High-risk accounts may face holds, slower review, or competition restrictions.",
          "Repeated abuse can affect trust, prize access, or platform eligibility.",
          "Operators should document why restrictive actions were taken."
        ]
      },
      {
        title: "Reputation and fairness",
        body: "Public and internal reputation should be based on real outcomes such as completed matches, no-shows, upheld disputes, and verified participation.",
        bullets: [
          "Trust is meant to reduce future abuse, not to produce fake hype metrics.",
          "Community visibility should not expose private evidence, account checks, or internal review notes.",
          "A player can improve trust through consistent, policy-compliant participation."
        ]
      }
    ]
  },
  {
    slug: "support",
    path: "/support",
    eyebrow: "Support",
    title: "Support Policy",
    description: "What players, creators, and hosts should send when asking for help with rooms, tournaments, funding, disputes, or account restrictions.",
    summary: "How to get help fast without breaking the evidence trail or delaying review unnecessarily.",
    updatedAt,
    sections: [
      {
        title: "General support expectation",
        body: "Support requests should be specific, factual, and tied to the relevant room, tournament, or account record.",
        bullets: [
          "Include the room code or tournament name whenever possible.",
          "State what happened, when it happened, and what outcome you are requesting.",
          "Do not delete or overwrite supporting evidence while the case is active."
        ]
      },
      {
        title: "Funding and payout help",
        body: "Payment-related support should include enough detail to trace the ledger and bank action safely.",
        bullets: [
          "Useful details include amount, sender account name, date, destination, screenshot, and any transaction reference.",
          "Do not post sensitive banking information publicly.",
          "Where provider verification is pending, support may only confirm queue state, not guaranteed completion timing."
        ]
      },
      {
        title: "Competition and dispute help",
        body: "For score or conduct issues, support needs the event context and the strongest available evidence, not just a claim.",
        bullets: [
          "Share screenshots, recordings, chat logs, and roster details where relevant.",
          "Tournament rounds should be identified clearly to avoid bracket confusion.",
          "Abusive support behavior can become a moderation issue."
        ]
      }
    ]
  }
];

export const policyMap = Object.fromEntries(policyEntries.map((entry) => [entry.slug, entry])) as Record<string, PolicyEntry>;

export function getPolicy(slug: string) {
  const policy = policyMap[slug];
  if (!policy) throw new Error(`Unknown policy slug: ${slug}`);
  return policy;
}

export function relatedPolicies(slug: string) {
  return policyEntries.filter((entry) => entry.slug !== slug);
}

export function policyMetadata(policy: PolicyEntry): Metadata {
  return {
    title: `${policy.title} | Skillsroom`,
    description: policy.description
  };
}
