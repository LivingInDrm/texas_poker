import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import LobbyPage from './pages/LobbyPage';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        
        {/* Protected routes */}
        <Route 
          path="/lobby" 
          element={
            <ProtectedRoute>
              <LobbyPage />
            </ProtectedRoute>
          } 
        />
        
        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/lobby" replace />} />
        
        {/* Catch all - redirect to lobby */}
        <Route path="*" element={<Navigate to="/lobby" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
