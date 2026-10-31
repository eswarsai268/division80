import { Navigate, Route, Routes } from "react-router-dom";
import RoleRoute from "../auth/RoleRoute";
import AppLayout from "../layouts/AppLayout";
import NotFound from "../pages/NotFound";
import LoginPage from "../pages/auth/LoginPage";
import RootRedirect from "./RootRedirect";
// citizen
import EventsPage from "../pages/citizen/EventsPage";
// booth member
import BoothDashboard from "../pages/booth/BoothDashboard";
import Households from "../pages/booth/Households";
import HouseholdDetail from "../pages/booth/HouseholdDetail";
import VerificationsPage from "../pages/booth/VerificationsPage";
import PrintSlip from "../pages/booth/PrintSlip";
import PrintSlips from "../pages/booth/PrintSlips";
// admin
import AdminDashboard from "../pages/admin/AdminDashboard";
import AdminBooths from "../pages/admin/AdminBooths";
import AdminBoothDetail from "../pages/admin/AdminBoothDetail";
import AdminAssignments from "../pages/admin/AdminAssignments";
import AdminUsers from "../pages/admin/AdminUsers";
import AdminCitizens from "../pages/admin/AdminCitizens";
import AdminImport from "../pages/admin/AdminImport";
import AdminExports from "../pages/admin/AdminExports";
import AdminWhatsApp from "../pages/admin/AdminWhatsApp";
import AdminEvents from "../pages/admin/AdminEvents";
import AdminDPeople from "../pages/admin/AdminDPeople";
import AdminDCounts from "../pages/admin/AdminDCounts";
import AdminDeadPeople from "../pages/admin/AdminDeadPeople";
import AdminSettings from "../pages/admin/AdminSettings";
const Redirect = ({ to }) => <Navigate to={to} replace />;

/** Route guards are UX only — every API call is authorised again on the server. */
export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<Redirect to="/booth/login" />} />
      <Route path="/booth/login" element={<LoginPage portal="BOOTH_MEMBER" />} />
      <Route path="/admin/login" element={<LoginPage portal="ADMIN" />} />

      <Route element={<RoleRoute roles={["BOOTH_MEMBER", "ADMIN"]} />}>
        <Route element={<AppLayout />}>
          <Route path="/events" element={<EventsPage />} />
        </Route>
      </Route>

      <Route element={<RoleRoute roles={["BOOTH_MEMBER"]} />}>
        <Route element={<AppLayout />}>
          <Route path="/booth" element={<Redirect to="/booth/households" />} />
          <Route path="/booth/dashboard" element={<BoothDashboard />} />
          <Route path="/booth/households" element={<Households />} />
          <Route path="/booth/households/:id" element={<HouseholdDetail />} />
          <Route path="/booth/households/:id/citizens" element={<HouseholdDetail />} />
          <Route path="/booth/verifications" element={<VerificationsPage />} />
          <Route path="/booth/print-slips" element={<PrintSlips />} />
          <Route path="/slips/voter/:id" element={<PrintSlip />} />
        </Route>
      </Route>

      <Route element={<RoleRoute roles={["ADMIN"]} />}>
        <Route element={<AppLayout />}>
          <Route path="/admin" element={<Redirect to="/admin/dashboard" />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/booths" element={<AdminBooths />} />
          <Route path="/admin/booths/:boothId" element={<AdminBoothDetail />} />
          <Route path="/admin/assignments" element={<AdminAssignments />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/citizens" element={<AdminCitizens />} />
          <Route path="/admin/import" element={<AdminImport />} />
          <Route path="/admin/exports" element={<AdminExports />} />
          <Route path="/admin/whatsapp" element={<AdminWhatsApp />} />
          <Route path="/admin/events" element={<AdminEvents />} />
          <Route path="/admin/d-people" element={<AdminDPeople />} />
          <Route path="/admin/d-counts" element={<AdminDCounts />} />
          <Route path="/admin/dead-people" element={<AdminDeadPeople />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
