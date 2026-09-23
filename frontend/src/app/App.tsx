import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Shell } from "./Shell";
import { LoginPage } from "../features/auth/LoginPage";
import { RegisterPage } from "../features/auth/RegisterPage";
import { OverviewPage, PhasePlaceholder } from "../features/dashboard/OverviewPage";
import { AboutPage } from "../features/about/AboutPage";
import { ClientsPage } from "../features/clients/ClientsPage";
import { ClientDetailPage } from "../features/clients/ClientDetailPage";
import { ProjectsPage } from "../features/projects/ProjectsPage";
import { ProjectDetailPage } from "../features/projects/ProjectDetailPage";

const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  {
    path: "/",
    element: <Shell />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: "projects", element: <ProjectsPage /> },
      { path: "projects/:id", element: <ProjectDetailPage /> },
      { path: "clients", element: <ClientsPage /> },
      { path: "clients/:id", element: <ClientDetailPage /> },
      { path: "tasks", element: <PhasePlaceholder title="tasks" phase="phase 3" /> },
      { path: "timesheet", element: <PhasePlaceholder title="timesheet" phase="phase 4" /> },
      { path: "invoices", element: <PhasePlaceholder title="invoices" phase="phase 5" /> },
      { path: "settings", element: <PhasePlaceholder title="settings" phase="a later phase" /> },
      { path: "about", element: <AboutPage /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
