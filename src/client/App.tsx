import { Route, Routes } from "react-router";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import NotFoundPage from "./pages/NotFoundPage";
import ProfilePage from "./pages/ProfilePage";
import TopPage from "./pages/TopPage";
import RequireAuth from "./RequireAuth";

// URL と画面の対応はここだけ見れば分かる。
function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={<TopPage />}
      />
      <Route
        path="/login"
        element={<AuthPage />}
      />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        }
      />
      <Route
        path="/profile"
        element={
          <RequireAuth>
            <ProfilePage />
          </RequireAuth>
        }
      />
      <Route
        path="*"
        element={<NotFoundPage />}
      />
    </Routes>
  );
}

export default App;
