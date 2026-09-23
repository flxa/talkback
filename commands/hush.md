---
description: Stop the current speech and clear the talkback queue
allowed-tools: Bash(pkill:*), Bash(rm:*)
---
Run exactly this and reply with the single word "hushed":

```bash
pkill -x say; pkill -x afplay; rm -f ~/.talkback/queue/*.json
```
