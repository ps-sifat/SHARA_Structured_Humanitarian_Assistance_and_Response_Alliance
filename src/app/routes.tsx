import { createHashRouter, Navigate } from "react-router"
import { DashLayout, PublicLayout } from "./layouts"
import Home from "./Home"
import { PublicApply, PublicMapPage, PublicTracking, PublicHelpRequests } from "./Part3Public"
import { LiveMissionDetail, LiveMissionList } from "./Part3Missions"
import { LiveRequestDetail, LiveRequestQueue } from "./Part3Review"
import { LiveMyTeam, LiveTeamForm, LiveTeamList } from "./Part3Teams"
import { LiveAdminDashboard, LiveOrganizationDashboard, LiveVolunteerDashboard } from "./Part3Dashboards"
import {
  VolunteerFormPage,
  VolunteerOrganizationPage,
  OrganizationDiscoveryPage,
} from "./VolunteerPages"
import {
  OrganizationRegistrationPage,
  OrganizationStatusPage,
  OrganizationMembershipsPage,
  OrganizationProfilePage,
  AdminOrganizationReviewPage,
} from "./OrganizationPages"
import {
  Suppliers,
} from "./Admin"
import { AccessDenied, Privacy } from "./PublicFlow"
import { LoginPage, PasswordChangePage, WorkspacePicker } from "./AuthPages"

export const router = createHashRouter([
  {
    Component: PublicLayout,
    children: [
      { index: true, Component: Home },
      { path: "apply", Component: PublicApply },
      { path: "map", Component: PublicMapPage },
      { path: "volunteer/register", element: <VolunteerFormPage registration /> },
      { path: "organization/register", Component: OrganizationRegistrationPage },
      { path: "organization/status", Component: OrganizationStatusPage },
      { path: "workspaces", Component: WorkspacePicker },
      { path: "account/password", Component: PasswordChangePage },
      { path: "login", Component: LoginPage },
      { path: "track", Component: PublicTracking },
      { path: "privacy", Component: Privacy },
      { path: "access-denied", Component: AccessDenied },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
  {
    path: "volunteer",
    element: <DashLayout role="volunteer" />,
    children: [
      { index: true, Component: LiveVolunteerDashboard },
      { path: "requests", Component: PublicHelpRequests },
      { path: "profile/edit", element: <VolunteerFormPage /> },
      { path: "organizations", Component: OrganizationDiscoveryPage },
      { path: "organization", Component: VolunteerOrganizationPage },
      { path: "team", Component: LiveMyTeam },
      {
        path: "teams",
        element: <Navigate to="/volunteer/organizations" replace />,
      },
      { path: "missions", Component: LiveMissionList },
      { path: "missions/:id", Component: LiveMissionDetail },
    ],
  },
  {
    path: "org",
    element: <DashLayout role="org" />,
    children: [
      { index: true, Component: LiveOrganizationDashboard },
      { path: "memberships", Component: OrganizationMembershipsPage },
      { path: "volunteers", element: <OrganizationMembershipsPage volunteersOnly /> },
      { path: "profile", Component: OrganizationProfilePage },
      { path: "teams", Component: LiveTeamList },
      { path: "teams/new", Component: LiveTeamForm },
      { path: "teams/:id/edit", Component: LiveTeamForm },
      { path: "missions", Component: LiveMissionList },
      { path: "missions/:id", Component: LiveMissionDetail },
    ],
  },
  {
    path: "admin",
    element: <DashLayout role="admin" />,
    children: [
      { index: true, Component: LiveAdminDashboard },
      { path: "requests", Component: LiveRequestQueue },
      { path: "requests/:id", Component: LiveRequestDetail },
      { path: "missions", Component: LiveMissionList },
      { path: "missions/:id", Component: LiveMissionDetail },
      { path: "organizations", Component: AdminOrganizationReviewPage },
      { path: "teams", element: <LiveTeamList admin /> },
      { path: "suppliers", Component: Suppliers },
    ],
  },
])
