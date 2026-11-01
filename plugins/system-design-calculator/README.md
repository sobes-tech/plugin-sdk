# System Design Calculator

A calculator in a docked, resizable meeting workspace panel for rough load, bandwidth, storage and cache estimates. The UI is available in English and Russian; calculations run locally without AI, network requests or access to meeting content.

Open the calculator from its overlay control to dock it beside the meeting content, then resize the panel as needed. It has four sections: **RPS**, **Network**, **Storage** and **Cache**. Change an assumption to recalculate immediately. **Reset** restores the defaults. There is no automatic persistence: closing the panel or switching workspace panels retains its current UI state within the meeting, but a new meeting, plugin execution revocation or app restart resets it.

The panel keeps the meeting overlay's transparent surface, with **RPS**, **Network**, **Storage** and **Cache** tabs in its header. Compact inputs use three columns when the panel is at least 360 px wide, and two columns in narrower panels; units stay alongside their labels. Reset and collapsed formulas share the footer.

## Units and formulas

- A day is **86,400 seconds**. DAU × requests per user per day gives daily requests. Average RPS divides that total by 86,400; peak RPS multiplies the average by the chosen peak factor.
- Payload fields use **KiB = 1,024 bytes**. Peak ingress and egress use peak RPS × their respective payload size, converted to **Mbit/s = 1,000,000 bits per second**. Daily traffic uses the average daily request total, not the peak factor.
- New records per day = daily requests × write share. Logical storage = new records per day × record size × retention days. Physical storage = logical storage × data copies × (1 + storage overhead / 100).
- Cache RAM per copy = hot keys × object size × (1 + cache overhead / 100). Total RAM multiplies this by cache copies. Peak origin reads = peak RPS × read share × (1 − cache hit share). Origin writes are unaffected by the cache hit rate.

**Copy counts include the primary:** one copy means no additional replica. Read share is 100% minus write share. Overhead is additional space relative to the base data and can exceed 100%. Request count per user and retention days may be fractional; DAU, hot keys and copy counts must be whole numbers. Zero users, payload sizes, keys or retention are supported.

Decimal dot and comma, properly grouped spaces and scientific notation are accepted (`1 000,5`, `1e6`). A comma always means a decimal separator; mixed dot/comma formats are rejected. Empty, malformed, nonfinite or out-of-range values do not silently become zero. Arithmetic overflow hides the affected result. Displayed results use up to four significant digits.

## Assumptions and limits

This is arithmetic for discussing a design, not capacity planning based on a benchmark. It assumes a uniform average day with an explicit peak factor and a constant read/write mix. Every write is treated as a new retained event; updates in place, deletions, TTL distribution, compression, deduplication and network protocol overhead are not modeled. Hot-key count and cache hit rate are independent user assumptions. There are no CPU, node-count, latency or hardware recommendations.

The plugin requests only `overlay.render` for its interface. It does not access the clipboard, meeting transcripts or credentials, send messages, start recording or invoke models. Nothing is saved to the host's storage or filesystem.

## Build and check

From the SDK repository:

```sh
bun plugins/system-design-calculator/build.ts
bun test --isolate plugins/system-design-calculator/model.test.ts
```

Install `plugins/bundles/system-design-calculator.json` in the desktop app. Its `overlay.workspace` control starts in the toolbar and can be positioned or hidden in the Meeting Panel editor; moving the control still opens the docked panel. System capture protection remains controlled by the host application.
