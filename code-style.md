# Code style

This guide owns naming and decomposition. The project's formatter owns layout and its linter owns diagnostics. A project
does not add another formatter or static-analysis dependency unless repeated defects show a rule the existing tools
cannot enforce.

Identifiers below use camelCase and an order-processing domain for illustration. Apply each rule in the casing and idiom
of the language at hand, with the project's own domain terms.

## Domain vocabulary

Each project keeps a vocabulary table that defines its core domain terms, either here or in a linked file.

| Term | Meaning |
| --- | --- |
| _term_ | _What it refers to, and what it does not._ |

Use the same term on both sides of a boundary. Do not reuse one term for two concepts, or give one concept two terms.
User-facing text may still use the user's own word for a concept when it differs from the code's term.

## Names

- Name boundary identifiers for their resource: `orderId`, `customerId`, `invoiceId`; never plain `id` when more than
  one identity exists in the operation.
- Name a value for its role in the current scope. Prefer `invoice`, `refund`, `pendingOrder` and `deletionCounts` to
  `row`, `item`, `current` and `result` in coordination code.
- `row`, `item`, `result`, `body`, `current` and similarly generic names are acceptable only in a short transformation
  where the type and role are immediately visible.
- Before validation or mapping, transport values are `request`, `response`, `requestBody` or `errorResponse`.
  Afterward, use the domain role they represent. Do not name a decoded object for its wire format (`json`, `payload`).
- Acronyms and initialisms are cased as words: `customerId`, `XmlParser`, `httpUrl`, not `customerID` or `XMLParser`.
- Abbreviate only when the short form is universal (`id`, `url`, `max`). Do not use abbreviations a reader outside the
  project would have to look up, and do not drop letters to save typing (`cust`, `ord`).
- A number that carries a unit names the unit (`timeoutMs`, `sizeBytes`, `priceCents`) unless its type already carries
  it. Prefer a typed duration or quantity where the language has one.
- A literal with domain meaning is a named constant (`maxRetryCount`, not a bare `3`). Literals whose meaning is plain at
  the use site, such as `0`, `1` or an empty string, stay inline.
- Booleans begin with `is`, `has`, `can`, `should`, `was` or `will`, except domain words whose boolean meaning is already
  explicit, such as `deleted`, `pending` and `archived`.
- A field holding an entity is named for the entity and its role (`orderToRetry`), not for the activity it takes part
  in (`retrying`), which reads as a flag; the flag is `isRetrying`.
- Functions are verbs (`calculateShippingCost`). A type is named for what it holds, not for the one mode or caller that
  first used it (`DraftOrder`, not `CheckoutPage`), and `Config` is for settings someone chose, not for the result of
  analysing input (`ImportAnalysis`, not `ImportConfig`).
- When a type keeps a private mutable value and exposes a read-only view of it, both share one name, distinguished only
  by the language's private-member convention (for example `_state` exposed as `state`). Name a captured copy
  `stateSnapshot`, not `current` or `now`.
- A type that implements a role defined by a framework or architecture names that role: controller, filter, worker,
  configuration, database, data-access object. Avoid `Manager`, `Utils`, `Helper`, `Support`, `Core` and `Data` as
  catch-all names.
- A subclass or wrapper of a library type is named for what it adds, not just for where it is used. A text field that
  adds input masking is `MaskedTextField`; `CheckoutTextField` says only where it appears.
- A caught expected boundary failure is `failure` or a qualified name such as `ioFailure`. Reserve panics, abort helpers
  and assertions for broken invariants.
- Short mathematical names such as `i`, `j`, `m` and `n` are appropriate inside a documented algorithm. Do not expand
  them when the formula is clearer with conventional notation.

## Files and modules

- A file has one primary owner and its filename names that owner or responsibility. Check the name against the file
  list alone: someone who sees only the list should be able to guess what the file contains, and should not expect to
  find something that is in another file.
- A file named for a type or component holds that type or component. A file of free functions shared by several owners
  is named for the responsibility they share (`InvoiceRendering`: templating, currency formatting and page breaks, used
  by both the invoice preview and the PDF export). It is not named for a thing it does not contain: `InvoicePage` would
  read as a screen.
- Lay out every screen the same way. If one screen's state holder and its view share a file, every screen's do; a single
  screen laid out differently is harder to navigate than a long file.
- A module or package name says what it owns. Do not introduce a generic layer solely to group unrelated shared code.
- One independently scheduled job lives in one file.
- A screen-level UI component owns state and side effects. Extract a child component when a toolbar, content region or
  overlay host has its own responsibility; do not extract every nested layout block.
- A large file is not itself a defect. Keep one coordinator when it owns ordering, locking or a cross-entity transaction.

## Control flow

- Keep the successful path left-aligned with early returns for expected terminal cases.
- Split a function when it performs sequential phases that can each be named from the domain. Do not split it to meet a
  line-count target.
- Declare a value in the narrowest scope that needs it, close to its first use. Do not keep mutable state in globals or
  singletons; pass a function what it needs.
- Avoid literal arguments whose meaning is invisible at the call site (`send(order, true)`). Use an enum, a named
  argument or a separate function (`sendWithReceipt(order)`).
- Prefer a named result type over a tuple or pair when both values survive beyond a short expression or protect an
  invariant.
- Validate at the boundary. Once a value is validated, pass the typed value rather than its raw serialized or transport
  form.
- One concern catches a failure. Lower layers raise with context; higher layers decide user wording, retry or refusal.
- A fallback changes behavior only after a typed expected failure. It is not an alternate normal strategy.

## Comments

- File and type comments state ownership, invariants and exclusions. A comment that names another file or type as an
  owner must match that code: a comment saying the checkout flow owns currency formatting, when formatting lives in the
  rendering file, sends readers to the wrong place. A rename or move searches for the old name in comments as well as
  in code.
- Comments explain why a constraint exists, not what the next line already says.
- If a comment is needed to explain what an identifier means, first rename the identifier.
- Public types and functions have a doc comment stating what they do, what they return and which expected failures they
  raise. Omit it only when the name and signature already say all of that.
- A TODO names an owner or links an issue (`TODO(#123): ...`). A TODO with neither is not committed.
- Every suppressed lint warning or exception to this guide carries a comment explaining why the rule does not apply.
- Commented-out code is deleted, not committed. Version control keeps the history.

## Replacements

A rename or move updates every production caller, test, document and generated contract in the same change. Delete the
old symbol or path; do not retain aliases, forwarding wrappers or parallel vocabulary.
