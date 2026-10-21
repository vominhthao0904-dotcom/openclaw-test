# Second Brain data safety

Second Brain notes are private production data.

## Netlify Blobs isolation

Never rely on generic store names across cloned sites.

Current Anh site unique store:

```text
second-brain-store-<unique-user-site-timestamp>
```

Rules:

- Each user/site needs its own `SB_BLOBS_STORE` or hardcoded unique fallback.
- Never copy `SB_BLOBS_SITE_ID` / `SB_BLOBS_TOKEN` from one user's site to another.
- After clone/deploy, compare `/.netlify/functions/list-notes` on both domains.
- If another domain shows the same private notes: backup → rotate store → restore notes → patch local functions → commit.

## Export safety

Skill exports must exclude:

- real notes data
- `.env`
- Netlify token/site state
- API keys/private endpoints
- `node_modules`

- **Second Brain Netlify Blobs isolation hard-lock (2026-06-02):** Không dùng generic store `second-brain-store` cho nhiều site/cloned installs. Mỗi user/site phải có unique `SB_BLOBS_STORE` hoặc hardcoded unique fallback riêng (ví dụ example: `second-brain-store-<unique-user-site-timestamp>`). Không copy `SB_BLOBS_SITE_ID`/`SB_BLOBS_TOKEN` sang Claw/site khác. Sau deploy/clone phải live-check `/.netlify/functions/list-notes` giữa domain anh và domain clone để chắc notes không bị shared. Nếu phát hiện shared, backup notes, rotate store, restore notes vào store mới, patch local functions, rồi commit.
