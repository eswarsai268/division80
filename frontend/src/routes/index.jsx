import { Navigate, Route, Routes } from "react-router-dom";
import RoleRoute from "../auth/RoleRoute";
import AppLayout from "../layouts/AppLayout";
import NotFound from "../pages/NotFound";
import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
import RootRedirect from "./RootRedirect";
// citizen
import CitizenHome from "../pages/citizen/CitizenHome";
import ComplaintList from "../pages/citizen/ComplaintList";
import NewComplaint from "../pages/citizen/NewComplaint";
import ComplaintDetail from "../pages/citizen/ComplaintDetail";
import EventsPage from "../pages/citizen/EventsPage";
import Profile from "../pages/citizen/Profile";
// booth member
import BoothDashboard from "../pages/booth/BoothDashboard";
import Households from "../pages/booth/Households";
import HouseholdDetail from "../pages/booth/HouseholdDetail";
import VerificationsPage from "../pages/booth/VerificationsPage";
import CrossBooth from "../pages/booth/CrossBooth";
import BoothComplaints from "../pages/booth/BoothComplaints";
// admin
import AdminDashboard from "../pages/admin/AdminDashboard";
import AdminBooths from "../pages/admin/AdminBooths";
import AdminBoothDetail from "../pages/admin/AdminBoothDetail";
import AdminAssignments from "../pages/admin/AdminAssignments";
import AdminUsers from "../pages/admin/AdminUsers";
import AdminComplaints from "../pages/admin/AdminComplaints";
import AdminComplaintDetail from "../pages/admin/AdminComplaintDetail";
import AdminCitizens from "../pages/admin/AdminCitizens";
import AdminImport from "../pages/admin/AdminImport";
import AdminExports from "../pages/admin/AdminExports";
import AdminEvents from "../pages/admin/AdminEvents";
import AdminAudit from "../pages/admin/AdminAudit";
import AdminSettings from "../pages/admin/AdminSettings";
import AdminCrossBooth from "../pages/admin/AdminCrossBooth";
import { t } from "../i18n";

const Redirect = ({ to }) => <Navigate to={to} replace />;

/** Route guards are UX only — every API call is authorised again on the server. */
export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage portal={t("USER")} />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/booth/login" element={<LoginPage portal="BOOTH_MEMBER" />} />
      <Route path="/admin/login" element={<LoginPage portal={t("ADMIN")} />} />

      <Route element={<RoleRoute roles={["USER"]} />}>
        <Route element={<AppLayout />}>
          <Route path="/home" element={<CitizenHome />} />
          <Route path="/complaints" element={<ComplaintList />} />
          <Route path="/complaints/new" element={<NewComplaint />} />
          <Route path="/complaints/:id" element={<ComplaintDetail />} />
          <Route path="/events" element={<EventsPage />} />
        </Route>
      </Route>

      <Route element={<RoleRoute roles={["BOOTH_MEMBER"]} />}>
        <Route element={<AppLayout />}>
          <Route path="/booth" element={<Redirect to="/booth/dashboard" />} />
          <Route path="/booth/dashboard" element={<BoothDashboard />} />
          <Route path="/booth/households" element={<Households />} />
          <Route path="/booth/households/:id" element={<HouseholdDetail />} />
          <Route path="/booth/households/:id/citizens" element={<HouseholdDetail />} />
          <Route path="/booth/verifications" element={<VerificationsPage />} />
          <Route path="/booth/cross-booth" element={<CrossBooth />} />
          <Route path="/booth/complaints" element={<BoothComplaints />} />
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
          <Route path="/admin/complaints" element={<AdminComplaints />} />
          <Route path="/admin/complaints/:id" element={<AdminComplaintDetail />} />
          <Route path="/admin/citizens" element={<AdminCitizens />} />
          <Route path="/admin/import" element={<AdminImport />} />
          <Route path="/admin/exports" element={<AdminExports />} />
          <Route path="/admin/events" element={<AdminEvents />} />
          <Route path="/admin/audit-logs" element={<AdminAudit />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
          <Route path="/admin/cross-booth" element={<AdminCrossBooth />} />
        </Route>
      </Route>

      <Route element={<RoleRoute roles={["USER", "BOOTH_MEMBER", "ADMIN"]} />}>
        <Route element={<AppLayout />}><Route path="/profile" element={<Profile />} /></Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
