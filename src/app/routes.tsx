import { createHashRouter, Navigate } from "react-router"
import { DashLayout, PublicLayout } from "./layouts"
import Home from "./Home"
import Apply from "./Apply"
import MapPage from "./MapPage"
import { MyTeam } from "./Volunteer"
import {
  VolunteerFormPage,
  VolunteerDashboardPage,
  VolunteerOrganizationPage,
  OrganizationDiscoveryPage,
} from "./VolunteerPages"
import {
  OrganizationRegistrationPage,
  OrganizationStatusPage,
  OrganizationDashboardPage,
  OrganizationMembershipsPage,
  OrganizationProfilePage,
  AdminDashboardPage,
  AdminOrganizationReviewPage,
} from "./OrganizationPages"
import {
  RequestQueue,
  RequestDetail,
  Suppliers,
} from "./Admin"
import HelpRequests from "./HelpRequests"
import { AccessDenied, Privacy, Tracking } from "./PublicFlow"
import { LoginPage, PasswordChangePage, WorkspacePicker } from "./AuthPages"
import { MissionDetail, MissionList } from "./Missions"
import {
  TeamForm,
  TeamList,
} from "./OrgManagement"

export const router = createHashRouter([
  {
    Component: PublicLayout,
    children: [
      { index: true, Component: Home },
      { path: "apply", Component: Apply },
      { path: "map", Component: MapPage },
      { path: "volunteer/register", element: <VolunteerFormPage registration /> },
      { path: "organization/register", Component: OrganizationRegistrationPage },
      { path: "organization/status", Component: OrganizationStatusPage },
      { path: "workspaces", Component: WorkspacePicker },
      { path: "account/password", Component: PasswordChangePage },
      { path: "login", Component: LoginPage },
      { path: "track", Component: Tracking },
      { path: "privacy", Component: Privacy },
      { path: "access-denied", Component: AccessDenied },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
  {
    path: "volunteer",
    element: <DashLayout role="volunteer" />,
    children: [
      { index: true, Component: VolunteerDashboardPage },
      { path: "requests", Component: HelpRequests },
      { path: "profile/edit", element: <VolunteerFormPage /> },
      { path: "organizations", Component: OrganizationDiscoveryPage },
      { path: "organization", Component: VolunteerOrganizationPage },
      { path: "team", Component: MyTeam },
      {
        path: "teams",
        element: <Navigate to="/volunteer/organizations" replace />,
      },
      { path: "missions", Component: MissionList },
      { path: "missions/:id", Component: MissionDetail },
    ],
  },
  {
    path: "org",
    element: <DashLayout role="org" />,
    children: [
      { index: true, Component: OrganizationDashboardPage },
      { path: "memberships", Component: OrganizationMembershipsPage },
      { path: "volunteers", element: <OrganizationMembershipsPage volunteersOnly /> },
      { path: "profile", Component: OrganizationProfilePage },
      { path: "teams", Component: TeamList },
      { path: "teams/new", Component: TeamForm },
      { path: "teams/:id/edit", Component: TeamForm },
      { path: "missions", Component: MissionList },
      { path: "missions/:id", Component: MissionDetail },
    ],
  },
  {
    path: "admin",
    element: <DashLayout role="admin" />,
    children: [
      { index: true, Component: AdminDashboardPage },
      { path: "requests", Component: RequestQueue },
      { path: "requests/:id", Component: RequestDetail },
      { path: "missions", Component: MissionList },
      { path: "missions/:id", Component: MissionDetail },
      { path: "organizations", Component: AdminOrganizationReviewPage },
      { path: "teams", element: <TeamList admin /> },
      { path: "suppliers", Component: Suppliers },
    ],
  },
])
