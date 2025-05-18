import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { ThemeProvider } from "@/components/providers/theme-provider";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AuthErrorBoundary from "@/components/auth/AuthErrorBoundary";
import { Suspense } from "react";
import LoadingScreen from "@/components/LoadingScreen";

// Pages
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import CompleteProfile from "@/pages/CompleteProfile";
import Dashboard from "@/pages/Dashboard";
import TasksPage from "@/pages/TasksPage";
import BudgetPage from "@/pages/BudgetPage";
import RiskManagementPage from "@/pages/RiskManagementPage";
import DocumentRepository from "@/pages/DocumentRepository";
import ContactsPage from "@/pages/ContactsPage";
import ProfilePage from "@/pages/ProfilePage";
import UsersPage from "@/pages/UsersPage";
import CalendarPage from "@/pages/CalendarPage";
import MeetingsPage from "@/pages/MeetingsPage";
import ForumPage from "@/pages/ForumPage";
import Unauthorized from "@/pages/Unauthorized";
import NotFound from "@/pages/NotFound";
import FixAuth from "@/pages/FixAuth";
import DeletionLogsPage from '@/pages/DeletionLogsPage';

const queryClient = new QueryClient();

const App = () => (
  <AuthErrorBoundary>
    <Suspense fallback={<LoadingScreen />}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <NotificationsProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <Routes>
                    {/* Public routes */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/auth/register" element={<Register />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/unauthorized" element={<Unauthorized />} />
                    <Route path="/fix-auth" element={<FixAuth />} />
                    
                    {/* Complete profile route (authenticated but not fully onboarded) */}
                    <Route path="/complete-profile" element={
                      <ProtectedRoute skipProfileCheck>
                        <CompleteProfile />
                      </ProtectedRoute>
                    } />
                    
                    {/* Root redirect to dashboard */}
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    
                    {/* Protected routes */}
                    <Route path="/" element={
                      <ProtectedRoute>
                        <DashboardLayout />
                      </ProtectedRoute>
                    }>
                      <Route path="dashboard" element={<Dashboard />} />
                      <Route path="tasks" element={
                        <ProtectedRoute requiresSpecial>
                          <TasksPage />
                        </ProtectedRoute>
                      } />
                      <Route path="calendar" element={<CalendarPage />} />
                      <Route path="meetings" element={
                        <ProtectedRoute requiresSpecial>
                          <MeetingsPage />
                        </ProtectedRoute>
                      } />
                      <Route path="budget" element={
                        <ProtectedRoute requiresSpecial>
                          <BudgetPage />
                        </ProtectedRoute>
                      } />
                      <Route path="risks" element={
                        <ProtectedRoute requiresSpecial>
                          <RiskManagementPage />
                        </ProtectedRoute>
                      } />
                      <Route path="documents" element={
                        <ProtectedRoute requiresSpecial>
                          <DocumentRepository />
                        </ProtectedRoute>
                      } />
                      <Route path="contacts" element={
                        <ProtectedRoute requiresSpecial>
                          <ContactsPage />
                        </ProtectedRoute>
                      } />
                      <Route path="forum" element={<ForumPage />} />
                      <Route path="profile" element={<ProfilePage />} />
                      <Route path="users" element={
                        <ProtectedRoute requiresAdmin>
                          <UsersPage />
                        </ProtectedRoute>
                      } />
                      <Route path="admin/deletion-logs" element={
                        <ProtectedRoute requiresAdmin>
                          <DeletionLogsPage />
                        </ProtectedRoute>
                      } />
                    </Route>
                    
                    {/* 404 route */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </BrowserRouter>
              </TooltipProvider>
            </NotificationsProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </Suspense>
  </AuthErrorBoundary>
);

export default App;
