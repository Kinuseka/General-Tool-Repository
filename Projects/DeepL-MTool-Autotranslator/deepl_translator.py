#!/usr/bin/env python3
"""
DeepL Auto-Translator for JSON files
Translates Japanese text to English using DeepL API
"""

import json
import time
import sys
import requests
from typing import Dict, Any

class DeepLTranslator:
    def __init__(self, config_file: str = "config.json"):
        """Initialize the translator with configuration"""
        self.config = self.load_config(config_file)
        self.api_key = self.config["deepl_api_key"]
        self.source_lang = self.config["source_language"]
        self.target_lang = self.config["target_language"]
        self.delay = self.config["delay_between_requests"]
        self.batch_size = self.config["batch_size"]
        self.api_url = "https://api-free.deepl.com/v2/translate"
        if not self.api_key.endswith(":fx"):
            self.api_url = "https://api.deepl.com/v2/translate"
    
    def load_config(self, config_file: str) -> Dict[str, Any]:
        """Load configuration from JSON file"""
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                config = json.load(f)
            
            if config["deepl_api_key"] == "YOUR_DEEPL_API_KEY_HERE":
                raise ValueError("Please set your DeepL API key in config.json")
            
            return config
        except FileNotFoundError:
            print(f"Error: {config_file} not found!")
            sys.exit(1)
        except json.JSONDecodeError:
            print(f"Error: Invalid JSON in {config_file}")
            sys.exit(1)
    
    def translate_batch(self, texts: list) -> dict:
        """Translate multiple texts using DeepL API batch feature"""
        # Filter out texts that don't need translation
        texts_to_translate = []
        text_indices = []
        
        for i, text in enumerate(texts):
            if self.is_already_translated(text):
                continue
            texts_to_translate.append(text)
            text_indices.append(i)
        
        # If no texts need translation, return originals
        if not texts_to_translate:
            return {text: text for text in texts}
        
        headers = {
            "Authorization": f"DeepL-Auth-Key {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "text": texts_to_translate,
            "source_lang": self.source_lang,
            "target_lang": self.target_lang,
            "model_type": "prefer_quality_optimized"
        }
        
        try:
            response = requests.post(self.api_url, headers=headers, json=payload)
            response.raise_for_status()
            
            result = response.json()
            translations = result["translations"]
            
            # Create result dictionary
            translation_results = {}
            translation_index = 0
            
            for i, original_text in enumerate(texts):
                if self.is_already_translated(original_text):
                    translation_results[original_text] = original_text
                else:
                    translated_text = translations[translation_index]["text"]
                    translation_results[original_text] = translated_text
                    print(f"Translated: '{original_text}' -> '{translated_text}'")
                    translation_index += 1
            
            time.sleep(self.delay)  # Rate limiting
            return translation_results
            
        except requests.exceptions.RequestException as e:
            print(f"Error translating batch: {e}")
            # Return original texts if batch fails
            return {text: text for text in texts}
    
    def is_already_translated(self, text: str) -> bool:
        """Check if text is already in English or should not be translated"""
        # Skip numbers, single characters, or obvious English words
        english_patterns = [
            "Scene", "Attack", "Fire", "Ice", "Thunder", "Water", "Wind",
            "Heal", "Magic", "Battle", "Save", "Load", "Menu", "Title",
            "false", "true", "ON", "OFF", "Graphics", "Data", "Window"
        ]
        
        # Check if it's purely ASCII (likely English)
        try:
            text.encode('ascii')
            return True
        except UnicodeEncodeError:
            pass
        
        # Check if it contains common English words
        for pattern in english_patterns:
            if pattern.lower() in text.lower():
                return True
        
        return False
    
    def translate_json_file(self):
        """Translate the entire JSON file using batch API"""
        input_file = self.config["input_file"]
        output_file = self.config["output_file"]
        
        # Load source file
        try:
            with open(input_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except FileNotFoundError:
            print(f"Error: {input_file} not found!")
            sys.exit(1)
        
        print(f"Starting translation of {len(data)} entries in batches of {self.batch_size}...")
        
        # Get all texts to translate
        texts_to_translate = list(data.keys())
        translated_data = {}
        processed = 0
        total = len(texts_to_translate)
        
        # Process in batches
        for i in range(0, len(texts_to_translate), self.batch_size):
            batch = texts_to_translate[i:i + self.batch_size]
            batch_results = self.translate_batch(batch)
            
            # Add batch results to final data
            translated_data.update(batch_results)
            processed += len(batch)
            
            batch_num = i // self.batch_size + 1
            total_batches = (len(texts_to_translate) + self.batch_size - 1) // self.batch_size
            print(f"Progress: {processed}/{total} ({processed/total*100:.1f}%) - Batch {batch_num}/{total_batches}")
        
        # Save translated file
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(translated_data, f, ensure_ascii=False, indent=4)
        
        print(f"Translation complete! Saved to {output_file}")
        print(f"Total entries translated: {processed}")
        print(f"Total API calls made: {(total + self.batch_size - 1) // self.batch_size}")

def main():
    """Main function"""
    print("DeepL Auto-Translator for Japanese Text")
    print("=" * 40)
    
    translator = DeepLTranslator()
    translator.translate_json_file()

if __name__ == "__main__":
    main() 