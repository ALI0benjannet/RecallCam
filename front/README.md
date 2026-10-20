# Front

Next.js App Router and TypeScript scaffold. Home provides a real backend-liveness check. Upload, library, and investigation routes clearly identify their unimplemented state.

```sh
npm ci
npm run dev
```

Copy `.env.example` to `.env.local` in this folder to change the API URL. Variables prefixed `NEXT_PUBLIC_` are browser-visible: do not put model credentials or service secrets there.

Validation commands: `npm run typecheck` and `npm run build`. Product design and functional upload/chat flows are future work.
