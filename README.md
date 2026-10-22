project name: DevMeter

Purpose: Teams use AI coding tools daily. Can’t see what it costs. Can’t control what leaks. Spend is invisible till the bill hits.DevMeter fixes that.

Four jobs

Track — every AI call logged. Spend by dev, model, project. Budgets + alerts.
Protect — local scan before send. Blocks secrets, PII, company data. Nothing leaks.
Enhance — rewrites rough prompts. Local language → clean, structured.
Optimize — suggests right model per task. Cheap for simple, strong for hard.

## Known gaps (TODO)

- **Auth tokens can't be revoked.** App JWTs live 30 days (`devmeter.jwt.ttl-minutes`) with no refresh or revocation, so a leaked token works until it expires. Fine for the MVP; before onboarding teams, add refresh tokens + revocation and shorten the TTL. See `JwtService`.
- **Cost is list price, not what you actually paid.** The backend prices every call at the provider's public list price. Calls on a free tier (e.g. Gemini's) really cost $0, and discounts (caching, batch) aren't applied, so the dashboard can show more than the real bill. Rates live in `PricingService`, each marked verified or `TODO verify rates`.
- **Anyone with a Google account can sign in.** Intentional for testers. To restrict to company domains later, check the `hd` claim in `OAuth2LoginSuccessHandler`.