import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth, type FeatureName } from "@/hooks/useAuth";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import AppointmentsPage from "./pages/AppointmentsPage";
import ConnectPage from "./pages/ConnectPage";
import SettingsPage from "./pages/SettingsPage";
import AdminPage from "./pages/AdminPage";
import CRMPage from "./pages/CRMPage";
import FinancePage from "./pages/FinancePage";
import RealEstateCataloguePage from "./pages/RealEstateCataloguePage";
import RealEstateCRMPage from "./pages/RealEstateCRMPage";
import RealEstateMatchingPage from "./pages/RealEstateMatchingPage";
import RealEstateFinancePage from "./pages/RealEstateFinancePage";
import RestaurantMenuPage from "./pages/RestaurantMenuPage";
import RestaurantOrdersPage from "./pages/RestaurantOrdersPage";
import RestaurantCustomersPage from "./pages/RestaurantCustomersPage";
import RestaurantInventoryPage from "./pages/RestaurantInventoryPage";
import RestaurantFinancePage from "./pages/RestaurantFinancePage";
import PublicBookingPage from "./pages/PublicBookingPage";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

// 1. Feature Protected Route (Forces Subscription)
function ProtectedFeatureRoute({
  children,
  featureName,
}: {
  children: React.ReactNode;
  featureName: FeatureName;
}) {
  const { user, loading, canAccessFeature } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!canAccessFeature(featureName)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-2 px-6">
          <p className="text-lg font-semibold">Subscription Required</p>
          <p className="text-sm text-muted-foreground">
            Upgrade your plan from Settings to unlock this feature instantly.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// 2. Admin Protected Route (Forces Superuser)
function ProtectedAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || profile?.role !== 'superuser') {
    // If logged in but not admin, go to dashboard. If not logged in, go to auth.
    return user ? <Navigate to="/dashboard" replace /> : <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/book/:token" element={<PublicBookingPage />} />
            
            {/* Redirect root to auth or dashboard */}
            <Route path="/" element={<Navigate to="/auth" replace />} />

            {/* Private Routes (Require Login) */}
            <Route
              path="/dashboard"
              element={
                <ProtectedFeatureRoute featureName="dashboard">
                  <DashboardPage />
                </ProtectedFeatureRoute>
              }
            />
            <Route
              path="/crm"
              element={
                <ProtectedFeatureRoute featureName="crm">
                  <CRMPage />
                </ProtectedFeatureRoute>
              }
            />
            <Route
              path="/finance"
              element={
                <ProtectedFeatureRoute featureName="finance">
                  <FinancePage />
                </ProtectedFeatureRoute>
              }
            />
            <Route
              path="/appointments"
              element={
                <ProtectedFeatureRoute featureName="calendar-sync">
                  <AppointmentsPage />
                </ProtectedFeatureRoute>
              }
            />
            <Route
              path="/connect"
              element={
                <ProtectedFeatureRoute featureName="chat">
                  <ConnectPage />
                </ProtectedFeatureRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedFeatureRoute featureName="advanced-settings">
                  <SettingsPage />
                </ProtectedFeatureRoute>
              }
            />
            <Route
              path="/immobilier"
              element={
                <ProtectedFeatureRoute featureName="immobilier-catalogue">
                  <RealEstateCataloguePage />
                </ProtectedFeatureRoute>
              }
            />
            <Route
              path="/immobilier/crm"
              element={
                <ProtectedFeatureRoute featureName="immobilier-catalogue">
                  <RealEstateCRMPage />
                </ProtectedFeatureRoute>
              }
            />
            <Route
              path="/immobilier/matching"
              element={
                <ProtectedFeatureRoute featureName="immobilier-catalogue">
                  <RealEstateMatchingPage />
                </ProtectedFeatureRoute>
              }
            />
            <Route
              path="/immobilier/finance"
              element={
                <ProtectedFeatureRoute featureName="immobilier-catalogue">
                  <RealEstateFinancePage />
                </ProtectedFeatureRoute>
              }
            />

            {/* Restaurant Routes */}
            <Route
              path="/restaurant/menu"
              element={
                <ProtectedFeatureRoute featureName="restaurant-menu">
                  <RestaurantMenuPage />
                </ProtectedFeatureRoute>
              }
            />
            <Route
              path="/restaurant/orders"
              element={
                <ProtectedFeatureRoute featureName="restaurant-menu">
                  <RestaurantOrdersPage />
                </ProtectedFeatureRoute>
              }
            />
            <Route
              path="/restaurant/customers"
              element={
                <ProtectedFeatureRoute featureName="restaurant-menu">
                  <RestaurantCustomersPage />
                </ProtectedFeatureRoute>
              }
            />
            <Route
              path="/restaurant/inventory"
              element={
                <ProtectedFeatureRoute featureName="restaurant-menu">
                  <RestaurantInventoryPage />
                </ProtectedFeatureRoute>
              }
            />
            <Route
              path="/restaurant/finance"
              element={
                <ProtectedFeatureRoute featureName="restaurant-menu">
                  <RestaurantFinancePage />
                </ProtectedFeatureRoute>
              }
            />

            {/* Admin Route (Requires Superuser) */}
            <Route
              path="/admin"
              element={
                <ProtectedAdminRoute>
                  <AdminPage />
                </ProtectedAdminRoute>
              }
            />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;