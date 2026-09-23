---
description: Unmute talkback
allowed-tools: Bash(node:*)
---
Run exactly this, then reply with a <speak> block saying talkback is back on.

```bash
node -e 'const fs=require("fs"),p=process.env.HOME+"/.talkback/config.json";fs.mkdirSync(process.env.HOME+"/.talkback",{recursive:true});let c={};try{c=JSON.parse(fs.readFileSync(p,"utf8"))}catch{};c.enabled=true;fs.writeFileSync(p,JSON.stringify(c,null,2))'
```
