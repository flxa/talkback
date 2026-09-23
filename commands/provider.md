---
description: Choose the speech provider, e.g. /talkback:provider elevenlabs | say | auto
argument-hint: auto | say | elevenlabs
allowed-tools: Bash(node:*), Bash(rm:*)
---
Argument: `$ARGUMENTS`, one of `auto`, `say`, `elevenlabs`. `auto` uses ElevenLabs when a key and voice id are configured and `say` otherwise.

1. If the argument is not one of the three, reply with a <speak> block explaining the choices and stop.
2. Write it as `provider` in `~/.talkback/config.json`, keeping every other key, using a one-line `node -e` script.
3. Run `rm -f ~/.talkback/elevenlabs-cooldown` so a previous quota or auth failure does not hold the new choice back.
4. Reply with a <speak> block only, naming the provider now in use.
