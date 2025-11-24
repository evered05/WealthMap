import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Assets from './pages/Assets';
import Liabilities from './pages/Liabilities';
import Budget from './pages/Budget';
import Simulation from './pages/Simulation';

function App() {
    return (
        <AuthProvider>
            <Router>
                <Routes>
                    {/* <Route path="/login" element={<Login />} /> */}
                    {/* <Route path="/register" element={<Register />} /> */}

                    {/* Bypass Auth: Directly render Layout */}
                    <Route path="/" element={<Layout />}>
                        <Route index element={<Dashboard />} />
                        <Route path="assets" element={<Assets />} />
                        <Route path="liabilities" element={<Liabilities />} />
                        <Route path="budget" element={<Budget />} />
                        <Route path="simulation" element={<Simulation />} />
                    </Route>
                </Routes>
            </Router>
        </AuthProvider>
    );
}

export default App;
