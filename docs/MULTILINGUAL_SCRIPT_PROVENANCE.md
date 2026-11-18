# Multilingual source-script provenance

## Purpose

Improve multilingual OSINT synthesis without pretending that script detection is language identification. This increment supplies bounded Unicode script hints to the existing AI synthesis path and passes original evidence text plus optional explicit language metadata from Investigation Studio.

## Script hints

`detectSourceScript` counts Latin, Bengali and Devanagari Unicode characters and returns `LATIN`, `BENGALI`, `DEVANAGARI`, `MIXED` or `UNKNOWN`. The counts are provenance hints only:

- Devanagari is used by multiple languages; it does not prove the source is Hindi.
- Latin script may be English, transliteration or another language.
- Mixed-script content must remain mixed unless a reviewer or source metadata establishes the language.
- The system does not translate, rewrite or replace the original source text.

## AI synthesis behaviour

The existing multilingual task now receives the script hint and any explicit language metadata. The prompt requires the model to preserve original spellings, dates, numbers and quotations; cite every factual statement; distinguish candidate narrative themes from verified claims; and report explicit-language coverage separately from script-only hints.

The client passes original evidence text when available, falling back to the analyst's evidence notes. Existing provider connections, API keys, OpenRouter routing and Claude publishing remain unchanged.

## Validation

Regression tests cover Bengali, Devanagari, Latin, mixed and unknown script cases, and assert that the multilingual prompt explicitly prevents language inference from script alone. Script detection is not a translation-quality or retrieval-accuracy metric. Those require representative human-reviewed samples.
