# Luna midpoint submission package

This folder is the review-ready midpoint package for Luna at repository commit `18eb720`.
It turns the implementation evidence already in the repository into three submission assets:

- [project-writeup.md](project-writeup.md) — the judge-facing project narrative;
- [demo-runbook.md](demo-runbook.md) — a text-first recording and rehearsal script; and
- [measured-claims.md](measured-claims.md) — the exact claims the team may and may not make.

The implementation specification remains the source of truth. These files summarize the current
product; they do not redefine contracts, ownership or gates.

## Midpoint status

- G0–G3 are complete. The same packaged widget passes the buyer decision, correction and
  session-scoped seller-report flow in two independent hosts.
- G4 failed audible output. The authorized real run produced captions and revision `0 → 1`, but
  no spoken Luna response was heard. Voice is excluded from the midpoint demo.
- The current paid agent result is partial at 10/12 scenarios. Both failures remain disclosed.
- Host A still contains its legacy comparison/model path beside Luna. C owns its replacement.
- The single-image runtime and public deployment are not implemented.

## Submission blocker: inherited storefront licensing

The Shopee-style Host A shell and assets are derived from
`neoB23/Shopee_E-commerce-Clone`, whose inspected public repository has no declared license.
The implementation specification treats this as a submission/distribution blocker.

Before distributing the repository, a hosted build or a downloadable submission, the team must
do one of the following:

1. obtain written author permission plus organizer approval; or
2. replace the inherited shell/assets with an original compact storefront while keeping the
   existing Host A routes, adapter and Luna widget.

Do not remove the current attribution until that decision is documented.

## Before submission

- [ ] Confirm the organizer's exact midpoint fields, video duration and link requirements.
- [ ] Resolve the inherited-shell licensing decision.
- [ ] Have C replace or clearly isolate Host A's legacy comparison path.
- [ ] Run the text demo twice from a fresh session and save the outputs/screenshots.
- [ ] Use only claims permitted by [measured-claims.md](measured-claims.md).
- [ ] Keep voice out of the recorded demo.
- [ ] Add a public link only after a real deployment and public smoke test pass.
