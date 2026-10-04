import { lazy, Suspense, useEffect } from "react";
import LiveApp from "./LiveApp.tsx";
import { DemoApp } from "./App.tsx";
import ReportFlow from "./citizen/ReportFlow.tsx";
import StatusPage from "./citizen/StatusPage.tsx";
import TaskPage from "./citizen/TaskPage.tsx";
import { CitizenFrame, Link, useRoute, setDemoMode } from "./citizen/navigation.tsx";
import { Header } from "./components/Header.tsx";
import { Landing } from "./components/Landing.tsx";
import { Workflow } from "./components/Workflow.tsx";

const Mission = lazy(() => import("./play/Mission.tsx"));

export default function Routes() {
  const route = useRoute(), path = route.split(/[?#]/)[0]!;
  useEffect(() => {
    const mode = new URLSearchParams(location.search).get("mode");
    if (path === "/demo" || mode === "demo") setDemoMode(true);
    else if (mode === "live" || path === "/review" || path === "/login") setDemoMode(false);
    document.documentElement.lang = "en";
    const target = document.getElementById(location.hash === "#how-it-works" ? "how-it-works" : "main-content");
    target?.focus();
    if (location.hash) target?.scrollIntoView();
  }, [route, path]);
  let page;
  if (path === "/") page = <Landing/>;
  else if (path === "/demo") page = <DemoApp shared/>;
  else if (path === "/report") page = <ReportFlow key={route}/>;
  else if (path === "/play") page = <Suspense fallback={<main id="main-content">Loading mission…</main>}><Mission key={route}/></Suspense>;
  else if (path.startsWith("/report/")) page = <StatusPage key={path} refId={decodeURIComponent(path.slice(8))}/>;
  else if (path === "/task") page = <TaskPage key={route}/>;
  else if (path === "/review" || path === "/login") page = <LiveApp loginOnly={path === "/login"}/>;
  else if (path === "/workflow") page = <Workflow/>;
  else page = <CitizenFrame simulated={false}><h1>Page not found</h1><Link href="/">Return home</Link></CitizenFrame>;
  return <div className="route-root">{path !== "/play" && <Header path={path} route={route}/>}{page}</div>;
}
