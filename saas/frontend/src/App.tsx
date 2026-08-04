import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import SwapPage from './pages/SwapPage';
import CreditsPage from './pages/CreditsPage';
import HistoryPage from './pages/HistoryPage';
import ApiKeysPage from './pages/ApiKeysPage';
import TemplatesPage from './pages/TemplatesPage';
import BatchPage from './pages/BatchPage';
import ProfilePage from './pages/ProfilePage';
import LiveSwapPage from './pages/LiveSwapPage';
import VirtualCamPage from './pages/VirtualCamPage';
import PhonePairPage from './pages/PhonePairPage';
import VideoCallPage from './pages/VideoCallPage';
import AdminLayout from './components/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminTransactions from './pages/admin/AdminTransactions';
import AdminPricing from './pages/admin/AdminPricing';
import AdminAnnouncements from './pages/admin/AdminAnnouncements';
import AdminSettings from './pages/admin/AdminSettings';
import AdminRevenue from './pages/admin/AdminRevenue';
import AdminSystem from './pages/admin/AdminSystem';
import AdminWithdrawals from './pages/admin/AdminWithdrawals';
import AdminActivity from './pages/admin/AdminActivity';
import AdminMonitoring from './pages/admin/AdminMonitoring';
import AdminSupport from './pages/admin/AdminSupport';
import AdminVastGPU from './pages/admin/AdminVastGPU';
import ContactPage from './pages/ContactPage';
import TermsPage from './pages/legal/TermsPage';
import PrivacyPage from './pages/legal/PrivacyPage';
import CookiePolicyPage from './pages/legal/CookiePolicyPage';
import AboutPage from './pages/legal/AboutPage';
import HelpCenterPage from './pages/legal/HelpCenterPage';
import StatusPage from './pages/legal/StatusPage';
import BlogPage from './pages/legal/BlogPage';
import CareersPage from './pages/legal/CareersPage';
import PressKitPage from './pages/legal/PressKitPage';
import CommunityPage from './pages/legal/CommunityPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div></div>;
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div></div>;
  if (!user || !user.is_admin) return <Navigate to="/app/dashboard" />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/cookies" element={<CookiePolicyPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/help" element={<HelpCenterPage />} />
          <Route path="/status" element={<StatusPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/careers" element={<CareersPage />} />
          <Route path="/press" element={<PressKitPage />} />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/app" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/app/dashboard" />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="swap" element={<SwapPage />} />
            <Route path="credits" element={<CreditsPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="api-keys" element={<ApiKeysPage />} />
            <Route path="templates" element={<TemplatesPage />} />
            <Route path="batch" element={<BatchPage />} />
            <Route path="live" element={<LiveSwapPage />} />
            <Route path="virtual-cam" element={<VirtualCamPage />} />
            <Route path="phone-pair" element={<PhonePairPage />} />
            <Route path="video-call" element={<VideoCallPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
          <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="transactions" element={<AdminTransactions />} />
            <Route path="pricing" element={<AdminPricing />} />
            <Route path="announcements" element={<AdminAnnouncements />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="revenue" element={<AdminRevenue />} />
            <Route path="system" element={<AdminSystem />} />
            <Route path="withdrawals" element={<AdminWithdrawals />} />
            <Route path="activity" element={<AdminActivity />} />
            <Route path="monitoring" element={<AdminMonitoring />} />
            <Route path="support" element={<AdminSupport />} />
            <Route path="vast" element={<AdminVastGPU />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
