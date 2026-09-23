---
description: Mute talkback for every session until /talkback:on
allowed-tools: Bash(node:*), Bash(pkill:*), Bash(rm:*)
---
Run exactly this and reply with the single word "muted". Do not add a <speak> block.

```bash
node -e 'const fs=require("fs"),p=process.env.HOME+"/.talkback/config.json";fs.mkdirSync(process.env.HOME+"/.talkback",{recursive:true});let c={};try{c=JSON.parse(fs.readFileSync(p,"utf8"))}catch{};c.enabled=false;fs.writeFileSync(p,JSON.stringify(c,null,2))'; pkill -x say; rm -f ~/.talkback/queue/*.json
```
