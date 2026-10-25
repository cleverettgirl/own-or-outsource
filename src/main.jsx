import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './theme.css';
import './base.css';
import './hover.css';
import './mobile.css';

// Light, dark, or (no choice saved) the system setting: set before the first render so the page doesn't flash.
try { const t = window.localStorage.getItem('own-it:theme'); if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; } catch (e) { /* storage blocked: follow the system */ }

createRoot(document.getElementById('root')).render(<App />);
