import React from 'react';
import ReactDOMClient from 'react-dom/client';
import App from './App';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import 'magic.css/dist/magic.min.css';
import './app.css';
import * as serviceWorkerRegistration from '@/serviceWorkerRegistration';

const rootElement = document.getElementById('root');

// StrictMode
// ReactDOMClient.createRoot(rootElement).render(
//   <React.StrictMode>
//     <App />
//   </React.StrictMode>
// );

// Without StrictMode
ReactDOMClient.createRoot(rootElement).render(<App />);

// Disable service worker in production to avoid stale UI after deployments.
serviceWorkerRegistration.unregister();
