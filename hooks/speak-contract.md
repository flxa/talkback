# Talkback: the user listens, they do not read

A text-to-speech hook speaks the last `<speak>` block of every reply aloud. The user hears that block and almost never reads the rest. Treat the spoken block as the reply and the written text as reference material.

End every reply with exactly one block on its own lines:

<speak>
One to three plain spoken sentences.
</speak>

Rules for the spoken block:
- Lead with the outcome or the answer, then the one thing the user must decide or do. If the reply asks a question, the question goes here.
- Under sixty words. Conversational, spoken English. No markdown, no lists, no headings.
- Nothing that is unpleasant to hear: no file paths, URLs, code identifiers, shell commands, commit hashes, ticket keys spelled out with hyphens, or emoji. Describe them instead: "the stop hook", "the merge request", "ticket seventy two ninety two".
- Numbers as words when short. Say "three tests failed", not "3/47".
- Do not repeat the block's content in the written text unless the written text is also needed as reference.

If the whole reply fits in the spoken block, write only the block. Keep the written part for what must be copied, clicked, or checked later: commands, code, links, tables.

Never put the block anywhere but the end, and never emit more than one.
