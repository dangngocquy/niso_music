import { useState, useEffect, useRef } from 'react';
import { Form, Input, Button, ConfigProvider, message } from 'antd';
import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import axios from 'axios';
import login_video from '../asset/login_video.mp4';
import { useNavigate } from 'react-router-dom';
import { useApiUrl } from '../hooks/useApiUrl';

const Login = ({ setUser }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const API_URL = useApiUrl();
  const ipDataRef = useRef({ ip: null, location: null });

  // Fetch IP and location on component mount
  useEffect(() => {
    const fetchIpAndLocation = async () => {
      try {
        // First, try to get precise location from browser Geolocation API
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const { latitude, longitude } = position.coords;
              try {
                // Use reverse geocoding to get location name from coordinates
                const response = await axios.get(
                  `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
                );
                const location = response.data.city || 'Unknown';
                
                // Also get IP from service
                const ipResponse = await axios.get('https://api.ipify.org?format=json');
                const data = {
                  ip: ipResponse.data.ip,
                  location: location,
                  latitude: latitude,
                  longitude: longitude
                };
                ipDataRef.current = data;
              } catch (err) {
                console.error('Error with reverse geocoding:', err);
                // Fallback to IP-based location if geocoding fails
                try {
                  const ipResponse = await axios.get('https://api.ipify.org?format=json');
                  const data = {
                    ip: ipResponse.data.ip,
                    location: 'Unknown',
                    latitude: latitude,
                    longitude: longitude
                  };
                  ipDataRef.current = data;
                } catch (fallbackErr) {
                  console.error('Fallback IP fetch failed:', fallbackErr);
                }
              }
            },
            (error) => {
              console.warn('Geolocation error:', error);
              // If geolocation denied, fallback to IP-based location
              fetchIpBasedLocation();
            }
          );
        } else {
          // Geolocation not supported, use IP-based location
          fetchIpBasedLocation();
        }
      } catch (err) {
        console.error('Error fetching location:', err);
      }
    };

    const fetchIpBasedLocation = async () => {
      try {
        const response = await axios.get('https://api.ipify.org?format=json');
        const data = {
          ip: response.data.ip,
          location: 'Unknown'
        };
        ipDataRef.current = data;
      } catch (fallbackErr) {
        console.error('IP fetch failed:', fallbackErr);
        try {
          const response = await axios.get('https://api.ipify.org?format=json');
          const data = {
            ip: response.data.ip,
            location: 'Unknown'
          };
          ipDataRef.current = data;
        } catch (err) {
          console.error('Final fallback failed:', err);
        }
      }
    };

    fetchIpAndLocation();
  }, []);

  const recordLoginStatus = async (user, status, ipAddress, location) => {
    try {
      const credentials = `${process.env.REACT_APP_BASIC_AUTH_USERNAME}:${process.env.REACT_APP_BASIC_AUTH_PASSWORD}`;
      const encoded = btoa(credentials);
      
      await axios.post(`${API_URL}/admin/login-logs`, {
        accountId: user._id,
        username: user.username,
        restaurantName: user.restaurantName,
        status, // 'online' or 'offline'
        ipAddress: ipAddress || null,
        location: location || null
      }, {
        headers: {
          "Authorization": `Basic ${encoded}`
        }
      });
    } catch (err) {
      console.error('Error recording login status:', err);
    }
  };

  const onFinish = async (values) => {
    setLoading(true);
    try {
      // Use ref to get current IP data (not state closure issue)
      let finalIpData = ipDataRef.current;
      
      // If IP data is still null, fetch it now
      if (!finalIpData.ip) {
        try {
          const response = await axios.get('https://api.ipify.org?format=json');
          finalIpData = {
            ip: response.data.ip,
            location: 'Unknown'
          };
          ipDataRef.current = finalIpData;
        } catch (err) {
          console.error('Error fetching IP during login:', err);
          try {
            const response = await axios.get('https://api.ipify.org?format=json');
            finalIpData = {
              ip: response.data.ip,
              location: 'Unknown'
            };
            ipDataRef.current = finalIpData;
          } catch (fallbackErr) {
            console.error('Fallback failed:', fallbackErr);
            finalIpData = { ip: null, location: null };
          }
        }
      }

      const response = await axios.post(`${API_URL}/login`, {
        username: values.username,
        password: values.password,
        ipAddress: finalIpData.ip,
        location: finalIpData.location
      });

      if (response.data.user) {
        // Save user info to localStorage
        localStorage.setItem('user', JSON.stringify(response.data.user));
        // Save login timestamp for 24h logout
        localStorage.setItem('loginTime', Date.now().toString());
        
        // Record login status with IP and location
        await recordLoginStatus(response.data.user, 'online', finalIpData.ip, finalIpData.location);
        
        // Update user state in App component
        if (setUser) {
          setUser(response.data.user);
        }
        message.success(response.data.success || 'Đăng nhập thành công');
        // Navigate based on permission
        if (response.data.user.permission) {
          navigate('/dashboard');
        } else {
          navigate('/bgm');
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error.response?.data?.error || 'Đăng nhập thất bại';
      form.setFields([
        { name: 'username', errors: [] },
        { name: 'password', errors: [errorMessage] },
      ]);
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const themeTokens = {
    colorPrimary: '#00D3E5',
    colorBgLayout: '#0b162a',
    colorBgContainer: '#1a2332',
    colorText: '#ffffff',
    colorTextSecondary: '#b0b0b0',
  };

  const containerStyle = {
    display: 'flex',
    width: '100vw',
    height: '100vh',
    backgroundColor: '#f5f5f5',
  };

  const leftStyle = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  };

  const rightStyle = {
    flex: 1,
    backgroundColor: themeTokens.colorBgLayout,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  };

  const contentStyle = {
    width: '100%',
    color: themeTokens.colorText,
  };

  const welcomeTitleStyle = {
    fontSize: 42,
    fontWeight: 700,
    color: themeTokens.colorText,
    margin: '0 0 16px 0',
    lineHeight: 1.2,
  };

  const welcomeSubtitleStyle = {
    fontSize: 14,
    color: '#fff',
    margin: '0 0 40px 0',
    lineHeight: 1.6,
  };

  return (
    <ConfigProvider theme={{ token: themeTokens }}>
      <div style={containerStyle}>
        {/* Left side - Video background */}
        <div className="left-side" style={leftStyle}>
          <video autoPlay muted loop style={{ width: '100%', height: '100%', objectFit: 'cover' }}>
            <source src={login_video} type="video/mp4" />
          </video>
        </div>

        {/* Right side - Form */}
        <div style={{ ...rightStyle, backgroundImage: 'linear-gradient(180deg,#32dfd424,#a6ffc20f 32.83%,#1414140d 69.71%,#14141400)' }}>
          <div style={contentStyle}>
            {/* (logo removed) */}
            <div style={{ display: 'flex', flexDirection: 'row', gap: 10, marginBottom: 60 }} className='login-bg-mobile'>
              <div className='logo'></div>
              {/* <div style={{fontSize: 20, fontWeight: 'bold'}}>MUSIC FOR BUSINESS</div> */}
            </div>
            {/* Welcome Section */}
            <div style={{ maxWidth: '400px', margin: '0 auto' }}>
              <h1 style={welcomeTitleStyle}>Xin chào</h1>
              <p style={welcomeSubtitleStyle}>Playlist nhạc dành cho NISO</p>

              {/* Form */}
              <Form form={form} layout="vertical" onFinish={onFinish} autoComplete="off">
                <Form.Item label={<span style={{ color: themeTokens.colorText, fontSize: 14, fontWeight: 500 }}>Tên đăng nhập</span>} name="username" rules={[{ required: true, message: 'Vui lòng nhập tên đăng nhập' }]}>
                  <Input placeholder="Điền tên đăng nhập" size="large" />
                </Form.Item>

                <Form.Item label={<span style={{ color: themeTokens.colorText, fontSize: 14, fontWeight: 500 }}>Mật khẩu</span>} name="password" rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}>
                  <Input.Password placeholder="Điền mật khẩu" size="large" iconRender={(visible) => (visible ? <EyeOutlined /> : <EyeInvisibleOutlined />)} />
                </Form.Item>

                <Form.Item>
                  <Button type="primary" htmlType="submit" block size="large" loading={loading} style={{ background: '#00D3E5', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, letterSpacing: 1, height: 44, textTransform: 'uppercase', boxShadow: 'none' }}>
                    ĐĂNG NHẬP
                  </Button>
                </Form.Item>
              </Form>
            </div>
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
};

export default Login;
