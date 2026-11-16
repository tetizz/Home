# Krillion practice data

The practice game at `/krillion/` includes **1,085 question records and 1,475 listed answer names**, collected as of **November 16, 2026**. It imports only rows explicitly scored **100** and marked **Krillion**. Every listed top-score tie is preserved; the primary answer keeps the source order. Case, accents, dates, and individual source URLs remain intact. No aliases or calendar dates are inferred.

**249 question records** come from official public responses or saved official snapshots; **836** come from independent historical fan transcriptions. Historical names have not all been independently verified against the official game. Blank dates mean no calendar date was published.

Public sources are retained on each question:

- [Krillion](https://krillion.io/) — collected public solo reveals, recent daily reveals, and official saved snapshots.
- [Krillion.run archive](https://krillion.run/answers/archive/) — independent historical daily-answer transcriptions.
- [KrillionToday Daily #111](https://krilliontoday.com/answers/2026-11-03) — the explicitly dated November 3 historical transcription.

Coverage is partial. Inaccessible paid dives, uncollected questions, Puffer Party, and highest answers scoring below 100 are excluded. Scoring and accepted-answer lists may change. No separate reuse license was verified for the official or community sources. This practice game claims no affiliation with Krillion or ownership of source materials. Private reference documents and account information are not included in the public metadata.

## Rebuild

From the Home repository root, provide the collected merged JSON explicitly:

```sh
node scripts/import-krillion-data.mjs /path/to/merged-data.json
```

Paths containing spaces must be quoted. The script writes `krillion/data.js`, exporting `META` and `QUESTIONS`. It does not fetch game endpoints or require any browser credentials. Keep the source JSON outside the published game directory.

The current snapshot intentionally validates **1,085 unique mode/dive/round IDs**, **1,475 names**, complete tie lists, supported provenance, HTTPS sources, and the absence of email addresses and object-to-string corruption. A changed collection fails these snapshot assertions until its counts and provenance are reviewed and updated. It never silently truncates ties or invents an answer.
