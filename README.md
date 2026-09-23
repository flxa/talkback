# talkback

Claude Code plugin that speaks replies aloud. Uses [ElevenLabs](https://elevenlabs.io/docs) when a key is configured and falls back to macOS `say` otherwise. No dependencies beyond Node 22.

## How it works

1. An output style (and a SessionStart hook, so it survives compaction) tells Claude to end every reply with a `<speak>` block: one to three spoken sentences, no paths, code, or links.
2. The Stop hook reads the reply and queues its block. If the reply has no block, the hook sends the turn back once (`decision: block`) so Claude appends one. If it still has none, the hook strips markdown, code, links, paths and hashes and speaks the first few sentences, or says the details are on screen.
3. The UserPromptSubmit hook speaks a short acknowledgement ("Hold your horses, mate") when you send a prompt, skipped for slash commands. Phrases live in `ackPhrases` in the config.
4. The Notification hook queues "needs your permission" and "is waiting for you" with the project name.
5. A detached worker drains `~/.talkback/queue` one item at a time across all sessions, so hooks return instantly and two sessions never talk over each other. When a session's new reply lands before its old one was spoken, the old one is dropped. The project name is spoken only when the speaker changes.
6. The worker speaks each item through the chosen provider. With ElevenLabs it fetches an MP3 from the [text-to-speech endpoint](https://elevenlabs.io/docs/api-reference/text-to-speech/convert) and plays it with `afplay`. Acks and notifications are fixed phrases, so their audio is cached under `~/.talkback/cache` and costs characters once. Anything that stops ElevenLabs answering (no key, network error, timeout, quota, bad key) falls back to `say` for that item and is logged. After an auth or quota error the worker stays on `say` for `cooldownMinutes` before trying again.

## Commands

- `/talkback:hush` stop speaking now
- `/talkback:off` and `/talkback:on` mute and unmute everywhere
- `/talkback:provider elevenlabs` choose `auto`, `say` or `elevenlabs`
- `/talkback:voice Roger` choose an ElevenLabs voice by name or id, or `/talkback:voice say Karen 210` for a macOS voice and rate

## Config

`~/.talkback/config.json`, all optional. `provider` defaults to `auto`: ElevenLabs when `elevenlabs.apiKey` (or the `ELEVENLABS_API_KEY` environment variable) and `elevenlabs.voiceId` are both set, otherwise `say`.

```json
{
  "enabled": true,
  "provider": "auto",
  "voice": "Karen",
  "rate": 200,
  "elevenlabs": { "apiKey": "sk_...", "voiceId": "CwhRBWXzGAHq8TQ4Fs17", "modelId": "eleven_flash_v2_5", "speed": 1, "timeoutMs": 8000, "cooldownMinutes": 15 },
  "prefixProject": true,
  "fallback": "strip",
  "fallbackMaxChars": 400,
  "notifications": true,
  "enforce": true,
  "ack": true,
  "ackPhrases": ["Just a tick."],
  "projectNames": { "my-app": "my app" }
}
```

Keep the key out of shell profiles: sessions launched from the desktop app never read them. The config file is read by every session, so `chmod 600 ~/.talkback/config.json`.

Log: `~/.talkback/talkback.log`.

## ElevenLabs

A free ElevenLabs account is enough to use it here. Setup:

1. Sign up at [elevenlabs.io](https://elevenlabs.io/app/sign-up). No card is needed for the free tier.
2. Create a key under [API Keys](https://elevenlabs.io/app/settings/api-keys) with the `text_to_speech`, `voices_read` and `user_read` permissions. The first is enough to speak; the other two let `/talkback:voice` list voices and let you read your quota.
3. Put the key and a voice id from the table below into `~/.talkback/config.json`, then `chmod 600` it:

   ```json
   { "elevenlabs": { "apiKey": "sk_...", "voiceId": "CwhRBWXzGAHq8TQ4Fs17" } }
   ```

4. Restart Claude Code. With `provider` left at `auto`, talkback switches to ElevenLabs as soon as both values are present, and `/talkback:voice Roger` changes the voice later.

The free tier works. It allows 10,000 characters a month, roughly a day of replies, and only the account's premade voices below. Voices added from the voice library need a paid plan over the API; pick one and it starts working when the plan is active. When the quota runs out the worker falls back to `say` until the reset. Plans and limits are on the [pricing page](https://elevenlabs.io/pricing).

Premade voices that work on the free tier, from `GET /v1/voices`:

| Accent | Voice | Id |
|---|---|---|
| Australian | Charlie, deep and confident, male | `IKne3meq5aSn9XLyUdCD` |
| British | George, warm storyteller, male | `JBFqnCBsd6RMkjVDRZzb` |
| British | Daniel, steady broadcaster, male | `onwK4e9ZLuTAKqWW03F9` |
| British | Alice, clear educator, female | `Xb7hH8MSUJpSbSDYk0k2` |
| British | Lily, velvety, female | `pFZP5JQG7iQjIQuC4Bku` |
| American | Roger, laid back, male | `CwhRBWXzGAHq8TQ4Fs17` |
| American | Brian, deep and comforting, male | `nPczCjzI2devNBz1zQrb` |
| American | Eric, smooth, male | `cjVigY5qzO86Huf0OWal` |
| American | Chris, down to earth, male | `iP95p4xoKVk53GoZ742B` |
| American | Adam, firm, male | `pNInz6obpgDQGcFmaJgB` |
| American | Bill, wise and mature, male | `pqHfZKP75CvOlQylNhV4` |
| American | Callum, husky, male | `N2lVS1w4EtoT3dr4eOWO` |
| American | Will, relaxed optimist, male | `bIHbv24MWmeRgasZH58o` |
| American | Liam, energetic, male | `TX3LPaxmHKxFdv7VOQHJ` |
| American | Harry, fierce, male | `SOYHLrjzK2X1ezoPC6cr` |
| American | River, relaxed and neutral | `SAz9YHcvj6GT2YYXdXww` |
| American | Sarah, reassuring, female | `EXAVITQu4vr4xnSDxMaL` |
| American | Matilda, professional, female | `XrExE9yKIg1WjnnlVkGX` |
| American | Bella, bright and warm, female | `hpp4J3VqNfWAUOO0d1Us` |
| American | Jessica, playful, female | `cgSgspJ2msm6clMCkdW9` |
| American | Laura, quirky, female | `FGY2WhTYpPnrIDTdsKH5` |

## Install

```bash
claude plugin marketplace add ~/projects/talkback
claude plugin install talkback@talkback
```

## Test

```bash
npm test
```

The install is a copy under `~/.claude/plugins/cache/talkback`. After editing this repo, commit and run `claude plugin update talkback@talkback`, then restart Claude Code. If you run sessions from another config directory, repeat the update with `CLAUDE_CONFIG_DIR` pointing at it.
