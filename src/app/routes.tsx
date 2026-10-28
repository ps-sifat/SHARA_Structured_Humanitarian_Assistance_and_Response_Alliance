import { createHashRouter, Navigate } from "react-router"
import { DashLayout, PublicLayout } from "./layouts"
import Home from "./Home"
import Apply from "./Apply"
import MapPage from "./MapPage"
import {
  Teams,
  VolunteerDashboard,
  VolunteerProfileEdit,
  VolunteerRegister,
  MyOrganization,
  MyTeam,
} from "./Volunteer"
import Org, { OrganizationRegister } from "./Org"
import {
  AdminDashboard,
  RequestQueue,
  RequestDetail,
  Suppliers,
  OrganizationsReview,
} from "./Admin"
import HelpRequests from "./HelpRequests"
import { AccessDenied, DemoLogin, Privacy, Tracking } from "./PublicFlow"
import { MissionDetail, MissionList } from "./Missions"
import {
  OrganizationProfile,
  OrgMemberships,
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
      { path: "volunteer/register", Component: VolunteerRegister },
      { path: "organization/register", Component: OrganizationRegister },
      { path: "login", Component: DemoLogin },
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
      { index: true, Component: VolunteerDashboard },
      { path: "requests", Component: HelpRequests },
      { path: "profile/edit", Component: VolunteerProfileEdit },
      { path: "organizations", Component: Teams },
      { path: "organization", Component: MyOrganization },
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
      { index: true, Component: Org },
      { path: "memberships", Component: OrgMemberships },
      { path: "volunteers", element: <OrgMemberships volunteersOnly /> },
      { path: "profile", Component: OrganizationProfile },
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
      { index: true, Component: AdminDashboard },
      { path: "requests", Component: RequestQueue },
      { path: "requests/:id", Component: RequestDetail },
      { path: "missions", Component: MissionList },
      { path: "missions/:id", Component: MissionDetail },
      { path: "organizations", Component: OrganizationsReview },
      { path: "teams", element: <TeamList admin /> },
      { path: "suppliers", Component: Suppliers },
    ],
  },
])
