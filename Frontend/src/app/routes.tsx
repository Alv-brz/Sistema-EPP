import { createBrowserRouter } from "react-router";
import { RootLayout } from "./layouts/RootLayout";
import { AuthLayout } from "./layouts/AuthLayout";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LiveMonitoringPage } from "./pages/LiveMonitoringPage";
import { ViolationsHistoryPage } from "./pages/ViolationsHistoryPage";
import { ReportsPage } from "./pages/ReportsPage";
import { CamerasPage } from "./pages/CamerasPage";
import { AreasPage } from "./pages/AreasPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UsersPage } from "./pages/UsersPage";
import { NotFoundPage } from "./pages/NotFoundPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      {
        path: "login",
        Component: AuthLayout,
        children: [
          { index: true, Component: LoginPage },
        ],
      },
      {
        path: "/",
        Component: DashboardLayout,
        children: [
          { index: true, Component: DashboardPage },
          { path: "monitoring", Component: LiveMonitoringPage },
          { path: "violations", Component: ViolationsHistoryPage },
          { path: "reports", Component: ReportsPage },
          { path: "cameras", Component: CamerasPage },
          { path: "areas", Component: AreasPage },
          { path: "users", Component: UsersPage },
          { path: "settings", Component: SettingsPage },
        ],
      },
      { path: "*", Component: NotFoundPage },
    ],
  },
]);
