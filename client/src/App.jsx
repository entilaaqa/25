import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";

// نفس روابط الموقع: / ، /login ، /dashboard.html
const routes = {
  "/": Landing,
  "/index.html": Landing,
  "/login": Login,
  "/login.html": Login,
  "/dashboard.html": Dashboard,
};

export default function App() {
  const Page = routes[location.pathname] || Landing;
  return <Page />;
}
