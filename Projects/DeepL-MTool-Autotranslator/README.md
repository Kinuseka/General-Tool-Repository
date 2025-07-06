# DeepL MTool Autotranslator

A Python-based automatic translator that uses the DeepL API to translate Japanese text entries in JSON files to English.

## Overview

This tool is designed to automatically translate Japanese game text files (using MTool) using DeepL's translation service. So how we do this is basically 

Game -> MTool -> Export Data -> DeepL-MTool-Autotranslator -> Translated-Data -> Import Data -> MTool -> Game

## Setup

1. Install dependencies: `pip install -r requirements.txt`
2. Get a DeepL API key from [DeepL API](https://www.deepl.com/pro-api)
3. Update `config.json` with your API key
4. Run: `python deepl_translator.py`

## Configuration

Edit `config.json` to customize translation settings including source/target languages, batch processing options, and file paths.

The tool automatically handles rate limiting and error recovery to ensure reliable translation of large files. 