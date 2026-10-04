# Rewards UI mockups

Four high-fidelity desktop design references for the use cases in [CHALLENGE.md](../CHALLENGE.md). Generated with the built-in imagegen tool; fictional sample data and imagery. These are design artifacts, not the running frontend.

| Screen | Challenge use case | Main behavior |
| --- | --- | --- |
| [Points overview](01-points-overview.png) | Retrieve current points balance | Prominent balance, entry to rewards, latest redemption |
| [Rewards catalog](02-rewards-catalog.png) | List available rewards | Reward descriptions and costs, redeem buttons, explicit points shortfall |
| [Redeem reward](03-redeem-reward.png) | Redeem a reward | Confirm cost and resulting balance; separate success-state preview |
| [Redemption history](04-redemption-history.png) | Retrieve redemption history | Reward, points spent, and timestamp, newest first |

## Flow and implementation notes

Overview → Rewards → Confirm redemption → Success → History. Navigation also provides direct access to Overview, Rewards, and History. The success strip in the redemption mockup illustrates the subsequent state; show it after the request succeeds, replacing the confirmation form.

Use the server's current balance and reward price. Disable repeated submissions while redemption is pending, then refresh balance and history after success. The server must reject insufficient points even if the client previously showed a reward as affordable. Keep the form usable after an API failure and show the server's error without deducting points locally.

Additional implementation states: loading, retryable fetch errors, no available rewards, empty history, missing reward, and a stale balance that becomes insufficient at confirmation. Present concise inline messages. Do not make a success announcement before the API succeeds.

For smaller screens, stack the balance and latest-redemption cards, collapse the reward grid to one column, stack confirmation details beneath the reward, and present history rows as compact cards. Maintain visible focus, semantic buttons, keyboard navigation, and announced status messages. Product photos are illustrative and optional for the challenge.

Palette: warm ivory surfaces, aubergine text, plum actions, peach accents, and muted green success feedback. Keep consistent navigation and readable point amounts throughout.

Exact generation prompts are recorded in [prompts.md](prompts.md).
