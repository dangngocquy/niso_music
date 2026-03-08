import './App.css';
import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ConfigProvider, message } from 'antd';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Bgm from './components/Bgm';
import AccountManager from './components/AccountManager';
import MusicManager from './components/MusicManager';
import PlaylistManager from './components/PlaylistManager';
import ScheduleManager from './components/ScheduleManager';
import AlbumManager from './components/AlbumManager';
import Loading from './components/Loading';
import NotFound from './components/NotFound';
import DownloadRedirect from './components/DownloadRedirect';
import socket from './socket';

function AppContent() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in
    const storedUser = localStorage.getItem('user');
    const loginTime = localStorage.getItem('loginTime');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        if (loginTime) {
          const loginDate = new Date(parseInt(loginTime));
          const currentDate = new Date();
          if (loginDate.toDateString() !== currentDate.toDateString()) {
            // Ngày khác, logout vì phiên đã hết hạn tại nửa đêm
            localStorage.clear();
            setUser(null);
          } else {
            setUser(user);
          }
        } else {
          setUser(user);
        }
      } catch (error) {
        console.error("Error parsing stored user:", error);
        localStorage.removeItem('user');
        localStorage.removeItem('loginTime');
      }
    }
    setLoading(false);
  }, []);

  const recordLogoutStatus = useCallback(async (currentUser) => {
    try {
      const credentials = `${process.env.REACT_APP_BASIC_AUTH_USERNAME}:${process.env.REACT_APP_BASIC_AUTH_PASSWORD}`;
      const encoded = btoa(credentials);

      await fetch(`${process.env.REACT_APP_API_URL}/admin/login-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${encoded}`
        },
        body: JSON.stringify({
          accountId: currentUser._id,
          username: currentUser.username,
          restaurantName: currentUser.restaurantName,
          status: 'offline'
        })
      });
    } catch (err) {
      console.error('Error recording logout status:', err);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    if (user) {
      await recordLogoutStatus(user);
      socket.emit('user-offline', {
        accountId: user._id,
        username: user.username,
        restaurantName: user.restaurantName
      });
    }
    setUser(null);
    localStorage.clear();
    navigate('/login', { replace: true });
  }, [user, recordLogoutStatus, navigate]);

  // Send online status when user logs in
  useEffect(() => {
    if (user) {
      socket.emit('user-online', {
        accountId: user._id,
        username: user.username,
        restaurantName: user.restaurantName
      });
    }
  }, [user]);

  // Listen for remote logout
  useEffect(() => {
    const handleRemoteLogout = (data) => {
      if (data.accountId === user?._id) {
        message.warning('Tài khoản của bạn đã được đăng nhập từ thiết bị khác.');
        handleLogout();
      }
    };

    socket.on('remote-logout', handleRemoteLogout);

    return () => {
      socket.off('remote-logout', handleRemoteLogout);
    };
  }, [user, handleLogout]);

  // Auto-logout at midnight (0 hours)
  useEffect(() => {
    if (!user) return;

    const calculateTimeToMidnight = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return tomorrow.getTime() - now.getTime();
    };

    const timeToMidnight = calculateTimeToMidnight();

    // Set timeout for logout at midnight
    const logoutTimer = setTimeout(() => {
      handleLogout();
    }, timeToMidnight);

    return () => clearTimeout(logoutTimer);
  }, [user, handleLogout]);

  // Listen for localStorage changes (when user logs in from another component)
  useEffect(() => {
    const handleStorageChange = () => {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch (error) {
          console.error("Error parsing stored user:", error);
        }
      } else {
        setUser(null);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '13px', backgroundColor: '#0b162a', color: '#00d3e5' }}>
       <div className='full_loading'>
      <Loading/>
    </div>
    </div>;
  }

  return (
    <Routes>
      <Route path="/" element={user?.permission ? <Navigate to="/dashboard" /> : user ? <Navigate to="/bgm" /> : <Login setUser={setUser} />} />
      <Route path="/login" element={user?.permission ? <Navigate to="/dashboard" /> : user ? <Navigate to="/bgm" /> : <Login setUser={setUser} />} />
      <Route path="/download" element={<DownloadRedirect />} />
      <Route path="/dashboard" element={user?.permission ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/" />} />
      <Route path="/accounts" element={user?.permission ? <AccountManager user={user} onBack={() => window.location.href = '/dashboard'} /> : <Navigate to="/" />} />
      <Route path="/music" element={user?.permission ? <MusicManager user={user} onBack={() => window.location.href = '/dashboard'} /> : <Navigate to="/" />} />
      <Route path="/playlists" element={user?.permission ? <PlaylistManager user={user} onBack={() => window.location.href = '/dashboard'} /> : <Navigate to="/" />} />
      <Route path="/schedules" element={user?.permission ? <ScheduleManager user={user} onBack={() => window.location.href = '/dashboard'} /> : <Navigate to="/" />} />
      <Route path="/albums" element={user?.permission ? <AlbumManager user={user} onBack={() => window.location.href = '/dashboard'} /> : <Navigate to="/" />} />
      <Route path="/bgm/*" element={user ? <Bgm users={user} onLogout={handleLogout} /> : <Navigate to="/" />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const AppWrapper = () => (
  <ConfigProvider
    theme={{
      token: {
        colorPrimary: '#00D3E5',
        borderRadius: 8,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        colorIcon: '#ffffff',
        colorIconHover: '#ffffff',
      },
      components: {
        Button: {
          colorPrimary: '#00D3E5',
          colorPrimaryHover: '#00b8c8',
        },
        Input: {
          colorBorder: 'hsla(0, 0%, 100%, 0.15)',
          colorBgContainer: 'rgba(255, 255, 255, 0.05)',
          colorTextPlaceholder: '#93a6c4',
          colorIcon: '#00D3E5',
          colorIconHover: '#00b8c8',
        },
        Switch: {
          colorPrimary: '#00D3E5',
        },
         Popover: {
        colorBgElevated: 'rgba(255, 255, 255, 0.05)',
         colorTextHeading: '#ffffff',
          colorText: '#dbe7f7',      
         },
        Drawer: {
          colorBgElevated: '#0b162a',
          iconColor: '#ffffff',
        },
        Modal: {
          contentBg: '#1a2332',
          headerBg: '#1a2332',
          titleColor: '#ffffff',
          iconColor: '#ffffff',
          borderRadiusLG: 8,
        },
        Select: {
          colorBorder: 'hsla(0, 0%, 100%, 0.15)',
          colorBgContainer: 'rgba(255, 255, 255, 0.05)',
          colorTextPlaceholder: '#93a6c4',
          colorText: '#ffffff',
          controlOutlineWidth: 2,
          colorPrimaryBorder: '#00D3E5',
          colorPrimary: '#00D3E5',
          colorBgElevated: '#1a2332',
          optionPadding: '5px 12px',
          optionLineHeightWithoutLineHeight: 1.5,
          optionSelectedBg: '#00D3E5',
          optionSelectedFontColor: '#1a2332',
          colorIcon: '#00D3E5',
          colorIconHover: '#00b8c8',
        },
        Calendar: {
          colorBgContainer: '#1a2332',
          colorText: '#ffffff',
          colorTextHeading: '#ffffff',
          colorBorder: 'hsla(0, 0%, 100%, 0.15)',
          colorPrimary: '#00D3E5',
          colorPrimaryBorder: '#00D3E5',
          cellHoverBg: 'rgba(0, 211, 229, 0.1)',
          colorTextDisabled: '#5a6c84',
          colorBgContainerDisabled: '#0f1823',
          colorIcon: '#00D3E5',
          colorIconHover: '#00b8c8',
          buttonBorderColor: '#00D3E5',
          buttonBg: 'transparent',
          controlOutlineWidth: 2,
        },
        DatePicker: {
          colorBgContainer: '#1a2332',
          colorText: '#0f1823',
          colorTextHeading: '#0f1823',
          colorBorder: 'hsla(0, 0%, 100%, 0.15)',
          colorPrimary: '#00D3E5',
          colorPrimaryBorder: '#00D3E5',
          cellHoverBg: 'rgba(0, 211, 229, 0.1)',
          colorTextDisabled: '#5a6c84',
          colorBgContainerDisabled: '#0f1823',
          colorIcon: '#00D3E5',
          colorIconHover: '#00b8c8',
          buttonBorderColor: '#00D3E5',
          buttonBg: 'transparent',
          controlOutlineWidth: 2,
        },

        Table: {
          headerBg: 'rgba(255, 255, 255, 0.05)',
          headerTextColor: '#1a2332',
          rowHoverBg: 'rgba(255, 255, 255, 0.08)',
          colorBgContainer: '#1a2332',
          colorBorder: '#2a3a4a',
          colorText: '#dbe7f7',
          colorTextHeading: '#00b8c8',
          colorIcon: '#00D3E5',
          colorIconHover: '#00b8c8',
          borderColor: '#2a3a4a',
          bodySortBg: 'rgba(0, 211, 229, 0.1)',
          headerBorderColor: '#00b8c8',
          headerSeparatorColor: '#00b8c8',
          headerSplitColor: '#00b8c8',
        },
        Pagination: {
          colorPrimary: '#1a2332',
          colorPrimaryHover: '#00b8c8',
          colorBgContainer: 'rgba(219, 231, 247, 0.3)',
          colorBorder: '#2a3a4a',
          colorText: '#fff',
          colorTextDisabled: '#5a6c84',
          itemActiveBg: '#00b8c8',
          itemActiveBgActive: '#00b8c8',
          itemActiveColorText: '#1a2332',
          itemBgActive: '#00b8c8',
          itemLinkBg: 'transparent',
          itemDisabledBg: 'transparent',
          itemSize: 32,
          itemSizeSM: 24,
        },
      },
    }}
  >
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  </ConfigProvider>
);

export default AppWrapper;
