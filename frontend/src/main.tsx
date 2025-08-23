import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from './App';
import Health from './pages/Health';
import AuthPage from './pages/AuthPage';
import SummaryPage from './pages/SummaryPage';
import './index.css';
import CreateQuestionPage from './pages/CreateQuestionPage';

const router = createBrowserRouter([
    { path: '/', element: <App /> },
    { path: '/health', element: <Health /> },
    { path: '/auth', element: <AuthPage /> },
    { path: '/summary', element: <SummaryPage /> },
    { path: '/create_question', element: <CreateQuestionPage /> },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <RouterProvider router={router} />
    </React.StrictMode>
);
