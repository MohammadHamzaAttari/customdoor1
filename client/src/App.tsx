import React, { Suspense } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/sonner";
import { Route, Switch } from "wouter";

// ⚡ Lazy load pages - these won't be in the initial bundle
const DoorConfigurator = React.lazy(() => import("./pages/DoorConfigurator"));
const CheckoutPage = React.lazy(() => import("./pages/CheckoutPage"));
const AdminDashboard = React.lazy(() => import("./pages/AdminDashboard"));
const AdminLogin = React.lazy(() => import("./pages/AdminLogin"));
const ForgotPassword = React.lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = React.lazy(() => import("./pages/ResetPassword"));
import { AuthProvider, useAuth } from "./hooks/use-auth";

function ProtectedAdminRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <PageLoader />;
  if (!user) {
    // Redirect to login if not authenticated
    return <AdminLogin />;
  }

  return <AdminDashboard />;
}

// Premium lightweight loading fallback
function PageLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-stone-50 via-white to-orange-50/30">
      {/* Outer pulsing halo */}
      <div className="relative flex items-center justify-center mb-8">
        <div className="absolute inset-0 bg-orange-400/20 rounded-full blur-xl animate-pulse-soft scale-150" />
        <div className="absolute inset-2 bg-gradient-to-r from-orange-500 to-red-500 rounded-full blur-md opacity-40 animate-spin" />

        {/* Core spinner rings */}
        <div className="relative w-16 h-16 rounded-full border-[3px] border-stone-100 border-t-orange-500/80 animate-spin shadow-lg" />
        <div className="absolute inset-2 rounded-full border-[2.5px] border-stone-50 border-b-red-400/80 animate-[spin_1.5s_linear_infinite_reverse]" />

        {/* Center dot */}
        <div className="absolute w-3 h-3 bg-gradient-to-br from-orange-400 to-red-500 rounded-full shadow-inner animate-pulse" />
      </div>

      <div className="text-center space-y-2 animate-in-up">
        <h3 className="text-lg font-black text-stone-800 tracking-tight">Loading Workspace</h3>
        <p className="text-[13px] font-medium text-stone-400">Preparing your custom door designer...</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Switch>
            <Route path="/admin/login" component={AdminLogin} />
            <Route path="/admin/forgot-password" component={ForgotPassword} />
            <Route path="/admin/reset-password" component={ResetPassword} />
            <Route path="/admin" component={ProtectedAdminRoute} />
            <Route path="/checkout" component={CheckoutPage} />
            <Route path="/" component={DoorConfigurator} />
            <Route component={DoorConfigurator} />
          </Switch>
        </Suspense>
        <Toaster position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;