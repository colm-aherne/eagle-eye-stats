# Secure AI Insights

Both AI endpoints are currently open to anyone who finds the deployed URL, logged 

in or not — suggestCourses and scanScorecard (in src/lib/suggest-courses.functions.ts 

and src/lib/scan-scorecard.functions.ts) call Gemini through the AI gateway with no 

auth check, so there's no rate limit and the scan endpoint only checks image size on 

the client (trivially bypassed). Please lock both down to signed-in users only:

1. In suggest-courses.functions.ts and scan-scorecard.functions.ts, add the existing 

   requireSupabaseAuth middleware (src/integrations/supabase/auth-middleware.ts) to 

   both createServerFn builders, e.g. .middleware([requireSupabaseAuth]). It isn't 

   applied anywhere in the codebase yet, so also update every client call site for 

   suggestCourses and scanScorecard to attach the current session's access token the 

   same way requireSupabaseAuth expects to receive it — follow whatever convention 

   you already generated in auth-middleware.ts rather than inventing a new one.

2. Find every place in the UI that lets a user trigger course suggestions or 

   scorecard scanning (new round flow, scan button, etc). If there's no signed-in 

   session, don't attempt the call — show a short "Sign in to use this" prompt 

   instead, reusing the existing sign-in dialog/flow rather than building a new one. 

   This app supports "Continue without signing in" for manual score entry, so make 

   sure that path still works fully — only the AI-powered bits should now require 

   an account. Update any button labels or copy that currently imply these features 

   work for guests.

3. In scan-scorecard.functions.ts, the Zod schema for the request has no upper bound 

   on imageDataUrl. Add a .max() to it so an oversized payload gets rejected 

   server-side too, not just checked client-side.

Don't touch the rounds save/load logic or anything from the previous fix — this is 

scoped to auth-gating the two AI endpoints only.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/27ae434f-4e19-4b71-8318-d92f0ed33d9c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
