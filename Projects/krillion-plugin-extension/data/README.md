# data/

`words.txt` is the local English dictionary: one lowercase word per line, 172,823 words. The background
worker loads it on first use (about 0.2 s), only for prompts that ask for *English words*. Delete or replace
it freely; if it is missing the extension still works, English-word prompts are just answered without a
dictionary, and Settings says "Not installed".

**Source:** `enable1.txt` from <https://github.com/dolph/dictionary>, unmodified. That repository describes it as the
word list used by Words With Friends and as a more generous alternative to the Official Scrabble Players
Dictionary. ENABLE is commonly described as public domain, **but that repository does not state a licence or
the list's origin**, so check the terms yourself before redistributing this file.

**How complete it is** (measured on this file): 172,823 words. Everyday words and their inflections are all
there (`squirrels`, `squabbled`, `running`, `geese`: 8 of 8), and so are UK/US spelling variants. It is an
older game list, so it is missing most modern words (`internet`, `email`, `website`, `blog`, `podcast`,
`selfie`, `emoji`, `smartphone`: 1 of 14 present), proper nouns (`london`, `france`, `monday`, `lego`),
abbreviations (`dna`, `usa`, `tv`), some slang (`meme`, `gonna`) and newer Scrabble additions (`qi`, `za`).
It is not the same set Krillion uses.

To use a different list, replace the file (one word per line; case, digits, punctuation and accents are
ignored) and reload the extension at `chrome://extensions`.
