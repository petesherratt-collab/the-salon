#!/usr/bin/env node
// salon-columnist.js — outputs the next persona's info as JSON for the scheduled agent
// Usage: node salon-columnist.js
// Output: JSON {id, name, voiceGuide, researchPath, researchContent}
// The scheduled Claude agent reads this, writes the essay, then calls post-to-substack.js

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { ALL_PERSONAS } from './personas.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(__dirname, '.columnist-state.json');

function loadState() {
  try { return JSON.parse(readFileSync(STATE_FILE, 'utf8')); }
  catch { return { lastPersonaId: null }; }
}

function nextPersona(state) {
  if (!ALL_PERSONAS.length) throw new Error('No active personas in personas.js');
  const idx = ALL_PERSONAS.findIndex(p => p.id === state.lastPersonaId);
  return ALL_PERSONAS[(idx + 1) % ALL_PERSONAS.length];
}

const state   = loadState();
const persona = nextPersona(state);

const researchPath    = join(__dirname, 'research', `${persona.id}.md`);
const researchContent = readFileSync(researchPath, 'utf8');

console.log(JSON.stringify({
  id:             persona.id,
  name:           persona.name,
  voiceGuide:     persona.voiceGuide,
  researchPath,
  researchContent
}));
