import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';
import ProtectedRoute from './components/ProtectedRoute';
import ReconnectionIndicator from './components/ReconnectionIndicator';
import { useSocket } from './hooks/useSocket';

function AppContent() {
  const { connectionStatus } = useSocket();

  return (
    <>
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
        
        <Route 
          path="/game/:roomId" 
          element={
            <ProtectedRoute>
              <GamePage />
            </ProtectedRoute>
          } 
        />
        
        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/lobby" replace />} />
        
        {/* Catch all - redirect to lobby */}
        <Route path="*" element={<Navigate to="/lobby" replace />} />
      </Routes>
      
      {/* 全局重连指示器 */}
      <ReconnectionIndicator connectionStatus={connectionStatus} />
    </>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
