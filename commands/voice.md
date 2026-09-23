---
description: Set the talkback voice, e.g. /talkback:voice Roger  or  /talkback:voice say Karen 210
argument-hint: [say] <voice-name> [speed-or-rate]
allowed-tools: Bash(node:*), Bash(say:*), Bash(curl:*), Bash(afplay:*)
---
Arguments: `$ARGUMENTS`. Config lives in `~/.talkback/config.json`; keep every other key when you write it, using a one-line `node -e` script.

Decide the target first. ElevenLabs is configured when `elevenlabs.apiKey` is set in the config or `ELEVENLABS_API_KEY` is in the environment. If the first token is `say`, drop it and target macOS `say` regardless.

**ElevenLabs target**
1. Fetch the account's voices: `curl -s -H "xi-api-key: $KEY" https://api.elevenlabs.io/v1/voices` (read the key out of the config with node, never echo it).
2. Match the first token case-insensitively against each voice's name up to its first ` - `, or accept a 20 character voice id as is. If nothing matches, reply with a <speak> block naming three voices from the list and stop.
3. Write `elevenlabs.voiceId`. If a second token is given, write it as `elevenlabs.speed` (0.7 to 1.2).
4. Reply with a <speak> block only; the reply is spoken in the new voice.
5. With no arguments, reply with a <speak> block naming the current voice and three others from the list, grouped by accent.

**say target**
1. Write the first token as `voice` and the optional second token as `rate` (words per minute).
2. Run `say -v "<voice>" -r <rate> "Talkback is now using <voice>."` so the user hears it.
3. Reply with a <speak> block only.
4. With no arguments, run `say -v '?'` and reply with a <speak> block naming three good English voices that are installed, and tell the user that better voices (Karen Premium, Zoe Premium, Matilda) are downloaded under System Settings, Accessibility, Spoken Content, System Voice, Manage Voices.
