import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";

import { useAuth } from "@/context/AuthContext";

import Landing from "@/pages/Landing";
import AuthPage from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Twin from "@/pages/Twin";
import Simulation from "@/pages/Simulation";
import Assistant from "@/pages/Assistant";
import CropHealth from "@/pages/CropHealth";
import PestPrediction from "@/pages/PestPrediction";
import Drone from "@/pages/Drone";
import VoiceDoctor from "@/pages/VoiceDoctor";
import Climate from "@/pages/Climate";
import Profit from "@/pages/Profit";
import Sustainability from "@/pages/Sustainability";
import Profile from "@/pages/Profile";
import NotFound from "@/pages/NotFound";

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/twin"
        element={
          <ProtectedRoute>
            <Twin />
          </ProtectedRoute>
        }
      />
      <Route
        path="/simulation"
        element={
          <ProtectedRoute>
            <Simulation />
          </ProtectedRoute>
        }
      />
      <Route
        path="/assistant"
        element={
          <ProtectedRoute>
            <Assistant />
          </ProtectedRoute>
        }
      />
      <Route
        path="/crop-health"
        element={
          <ProtectedRoute>
            <CropHealth />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pest-prediction"
        element={
          <ProtectedRoute>
            <PestPrediction />
          </ProtectedRoute>
        }
      />
      <Route
        path="/drone"
        element={
          <ProtectedRoute>
            <Drone />
          </ProtectedRoute>
        }
      />
      <Route
        path="/voice-doctor"
        element={
          <ProtectedRoute>
            <VoiceDoctor />
          </ProtectedRoute>
        }
      />
      <Route
        path="/climate"
        element={
          <ProtectedRoute>
            <Climate />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profit"
        element={
          <ProtectedRoute>
            <Profit />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sustainability"
        element={
          <ProtectedRoute>
            <Sustainability />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
