/**
 * Level editor entry point (editor.html): boots the EditorApp into #editor.
 */
import '@fontsource/cinzel/600.css';
import './editor.css';
import { EditorApp } from './EditorApp.js';

const root = document.getElementById('editor');
try {
  const app = new EditorApp(root);
  app.ready.finally(() => document.documentElement.classList.add('le-booted'));
} catch (e) {
  console.error('[editor] failed to start', e);
  root.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'le-fatal';
  box.innerHTML = '<h1>The level editor could not start</h1><pre></pre>';
  box.querySelector('pre').textContent = String(e?.stack ?? e);
  root.appendChild(box);
}
