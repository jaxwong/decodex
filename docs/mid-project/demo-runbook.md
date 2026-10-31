# Midpoint demo runbook

This is a text-first demo. Do not start or present Live voice: the authorized G4 run failed
audible output even though captions and the server-owned revision changed.

## 1. Preflight

From the repository root:

```bash
make api-sync
make api-test
make frontend-build
make e2e
```

All commands must exit `0`. These checks make no provider calls. Keep the committed
`eval/SCORECARD.md` available for the final measured-results frame; only A should regenerate the
scorecard when an underlying artifact or implementation binding changes.

Confirm that `.env` contains the three documented server-only variables. Never put the OpenAI key
in a `VITE_*` variable, browser field, recording, terminal history or committed file.

## 2. Start the local product

Terminal 1:

```bash
set -a; . ./.env; set +a
make api-dev
```

Terminal 2:

```bash
npm run dev --workspace shopee-compare -- --host 127.0.0.1
```

Terminal 3:

```bash
npm run dev --workspace minimal-host -- --port 5174 --host 127.0.0.1
```

Open:

- Host A: `http://127.0.0.1:5173/#/Cart`
- Host B: `http://127.0.0.1:5174/`
- API health: `http://127.0.0.1:8000/api/health`

Real comparison creation and text-agent turns may spend provider credits. Agree on the recording
run before clicking them; never repeat a failed paid turn as an automatic repair.

## 3. Prepare the recording

- Use a fresh browser session and 125–150% zoom so evidence text is readable.
- Close unrelated tabs, notifications and developer consoles.
- Frame the shared Luna widget rather than the legacy browser AI settings.
- Use Host A as the primary product and Host B only for the portability beat.
- If model latency is edited out, do not present the edited video as a latency measurement.
- Capture a clean fallback take using the deterministic browser flow, but label any test-double
  footage explicitly; do not present it as a live provider run.

## 4. Judge-facing 90-second script

| Time | Visible action | Narration |
|---|---|---|
| 0–10 s | Show the three exact power-bank variants. | “Marketplace comparison breaks because sibling variants, inconsistent units and dozens of reviews force buyers to keep the decision in their head.” |
| 10–25 s | Open Luna, select the 100W, 65W and 87W synthetic SKUs, and create the comparison. | “Luna builds one exact-variant evidence graph. Every supported fact keeps its source; missing and conflicting fields stay visible.” |
| 25–38 s | Open one seller source, listing C's warranty conflict and one heat-review excerpt. | “It does not guess through missing weight or overwrite a 12-versus-24-month conflict. Review claims remain literal excerpts from the analysed sample.” |
| 38–55 s | Type `Under S$80, at least 65W; prioritize portability.` Show the revision/recommendation change. | “The model translates intent into constrained tools. Server code validates the request and owns the ranking.” |
| 55–66 s | Type `Actually prioritize price.` Show the newer revision. | “A correction updates the same comparison without re-extracting or rewriting the evidence.” |
| 66–78 s | Set S$70, open listing C's **Seller view**, then open its warranty evidence. | “The buyer gets a defensible decision; the seller gets a fix list from the same evidence, with no extra model call. These counts cover this demo session.” |
| 78–84 s | Briefly show Host B. | “The same widget and API run inside a second, independently structured host.” |
| 84–90 s | Show the scorecard. | “We keep failed scenarios visible: grounded evidence is source-validated, while the current agent benchmark is honestly 10 out of 12.” |

## 5. Exact text turns

Use these fixed turns so the demo and benchmark vocabulary stay aligned:

```text
Under S$80, at least 65W; prioritize portability.
Actually prioritize price.
Set my maximum budget to S$70. Keep minimum power unset and use no ranking priorities.
```

Do not use the two known failed benchmark prompts (`review_query` and
`no_comparable_winner`) in the midpoint demo.

## 6. Failure policy

- If comparison creation fails, stop the take and preserve the visible error/log. Do not switch
  to legacy browser AI as a fallback.
- If a text turn fails after a mutation, refresh the comparison; do not resend the same intent
  automatically.
- If Host B is not ready in the recording session, show the saved deterministic portability
  evidence instead of implying shared live state.
- If any source drawer cannot open its cited ID, do not use that take.
- Never switch to voice to rescue a text failure.

## 7. Capture checklist

- [ ] Exact variant labels.
- [ ] One supported seller source.
- [ ] Missing weight.
- [ ] Both warranty-conflict sources.
- [ ] One literal review excerpt and review ID.
- [ ] Revision before and after the first preference turn.
- [ ] Newer revision after correction.
- [ ] Listing C seller report with the demo-session banner.
- [ ] Host B portability frame.
- [ ] A4 scorecard frame.
- [ ] One visible error/fallback state for the written submission.

Run the final text journey twice. Record the commit, commands, outcome and chosen take. A public
URL may be added only after the single-origin deployment and public smoke checks actually pass.
