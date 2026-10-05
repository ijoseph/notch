import React from 'react';
import { createRoot } from 'react-dom/client';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github.min.css';
import App from './App';
import NoteWindow from './components/Editor/NoteWindow';
import PreviewWindow from './components/Preview/PreviewWindow';
import './styles/index.css';

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    {new URLSearchParams(location.search).has('preview')
      ? <PreviewWindow label={new URLSearchParams(location.search).get('preview')!} /> : new URLSearchParams(location.search).has('note') ? <NoteWindow id={new URLSearchParams(location.search).get('note')!} path={new URLSearchParams(location.search).get('db')!} /> : <App />}
  </React.StrictMode>
);
