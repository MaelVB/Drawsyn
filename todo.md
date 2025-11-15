# TODO

- [x] Review current item activation flow for "Jour de fête" in `apps/web/components/InventoryBar.tsx` and related stores.
- [x] Implement selection overlay with cancel button above inventory bar when the item is activated.
- [x] Trigger confetti animations (top rain + side bursts) when a target player is selected, ensuring reuse of existing notification system.
- [x] Wire up state management and cleanup so overlay hides and item usage flow completes correctly, including notification dispatch.
- [x] Make party-time confetti trigger on the targeted player via server-driven events.
- [x] Implement CRT item effect with canvas overlay and lifecycle management.
