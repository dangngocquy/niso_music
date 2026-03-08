import React from "react";
import { Button, Space, Popover, Card, Row, Col } from "antd";
import { LogoutOutlined, SettingOutlined, BellOutlined } from "@ant-design/icons";
import { IoMusicalNotesOutline } from "react-icons/io5";
import { BiAlbum } from "react-icons/bi";
import { FaUsersCog, FaMusic, FaClock } from "react-icons/fa";
import { CiViewList } from "react-icons/ci";
import adminLogo from '../asset/Logo.svg';
import "../styles/Dashboard.css";
import socket from '../socket';

const Dashboard = ({ user, onLogout }) => {
  const [hoveredIndex, setHoveredIndex] = React.useState(null);
  const [notifications, setNotifications] = React.useState([]);
  const [notificationPopoverOpen, setNotificationPopoverOpen] = React.useState(false);

  const handleCheckStatus = () => {
    // Xóa thông báo cũ khi mở popover
    setNotifications([]);
    // Emit to server to check if user has schedule in current time but not playing
    socket.emit('check-playing-status', { userId: user._id });
  };

  React.useEffect(() => {
    const handleNotification = (data) => {
      // Chỉ giữ 1 thông báo mới nhất, thay thế cái cũ
      setNotifications([data]);
    };

    socket.on('notification', handleNotification);

    return () => {
      socket.off('notification', handleNotification);
    };
  }, []);

  const settingsContent = (
    <div style={{ minWidth: 200 }}>
      <Space direction="vertical" style={{ width: "100%" }}>
        <Button
          type="text"
          icon={<IoMusicalNotesOutline />}
          block
          onClick={() => window.location.href = '/bgm'}
          style={{ textAlign: "left", color: '#dbe7f7'}}
        >
          Phát Nhạc
        </Button>
        <Button
          type="text"
          danger
          icon={<LogoutOutlined />}
          block
          onClick={onLogout}
          style={{ textAlign: "left" }}
        >
          Đăng xuất
        </Button>
      </Space>
    </div>
  );

  const menuItems = [
    {
      title: "Quản Lý Tài Khoản",
      description: "Thêm, sửa, xóa tài khoản người dùng",
      icon: <FaUsersCog style={{ fontSize: 48, color: '#00D3E5' }} />,
      path: "/accounts",
    },
    {
      title: "Quản Lý Nhạc",
      description: "Tải lên, sửa, xóa bài hát",
      icon: <FaMusic style={{ fontSize: 48, color: '#00D3E5' }} />,
      path: "/music"
    },
    {
      title: "Tạo Album phát",
      description: "Tạo album, chọn nhạc, màu và ảnh, chọn tài khoản phát tự do",
      icon: <BiAlbum style={{ fontSize: 48, color: '#00D3E5' }} />,
      path: "/albums"
    },
    {
      title: "PlayList",
      description: "Tạo và quản lý danh mục phát nhạc",
      icon: <CiViewList style={{ fontSize: 48, color: '#00D3E5' }} />,
      path: "/playlists"
    },
    {
      title: "Hẹn Giờ Phát Nhạc",
      description: "Lên lịch phát nhạc theo giờ và tài khoản",
      icon: <FaClock style={{ fontSize: 48, color: '#00D3E5' }} />,
      path: "/schedules"
    }
  ];

  return (
    <div className="dashboard-root">
      <div className="dashboard-content">
        {/* Header */}
        <div className="dashboard-header">
          <div className="header-left">
            <img src={adminLogo} alt="logo" className="header-logo" />
            <div className="header-info">
              <div className="header-title">DASHBOARD</div>
              <div className="header-sub">Music for Business</div>
            </div>
          </div>
          <Popover
            content={
              <div>
                {notifications.length > 0 ? (
                  notifications.map((notif, index) => (
                    <div key={index} style={{ 
                      marginBottom: 8, 
                      padding: 8, 
                      borderRadius: 4,
                    }}>
                      {notif.message}
                    </div>
                  ))
                ) : (
                  <div style={{ padding: 8 }}>Không có thông báo</div>
                )}
              </div>
            }
            title="Thông báo"
            trigger="click"
            open={notificationPopoverOpen}
            onOpenChange={setNotificationPopoverOpen}
          >
            <Button
              type='text'
              icon={<BellOutlined style={{ fontSize: 20, color: "#dbe7f7" }} />}
              onClick={handleCheckStatus}
            >
            </Button>
          </Popover>
          <div style={{width: '2px', height: '24px', backgroundColor: 'rgba(255, 255, 255, 0.2)', margin: '0px 2px'}}></div>
          <Popover
            content={settingsContent}
            title="Cài đặt"
            trigger="click"
            placement="bottomRight"
          >
            <Button
              type="text"
              icon={<SettingOutlined style={{ fontSize: 20, color: "#dbe7f7" }} />}
              style={{ padding: "8px 12px" }}
            />
          </Popover>
        </div>

        {/* Main Content */}
        <div className="dashboard-main">
          <div>
            <h1 style={{ fontSize: 'clamp(18px, 6vw, 28px)', fontWeight: 700, color: '#fff', marginBottom: 8 }}>
              Chào mừng, {user?.restaurantName || "Admin"}!
            </h1>
            <p style={{ fontSize: 'clamp(12px, 4vw, 14px)', color: '#93a6c4' }}>
              Chọn một trong những chức năng dưới đây để quản lý hệ thống
            </p>
          </div>

          <Row gutter={[8, 8]}>
            {menuItems.map((item, index) => (
              <Col flex="1" key={index}>
                <Card
                  hoverable
                  onClick={() => window.location.href = item.path}
                  className={`dashboard-menu-card ${hoveredIndex === index ? 'hovered' : ''}`}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  style={{
                    textAlign: 'center',
                    cursor: 'pointer',
                    border: 'none',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '16px 12px',
                    background: `linear-gradient(135deg, rgba(0, 211, 229, 0.08) 0%, rgba(0, 211, 229, 0.02) 100%)`,
                  }}
                >
                  <div>
                    <div className="dashboard-menu-icon" style={{ marginBottom: 12 }}>
                      {React.cloneElement(item.icon, { style: { ...item.icon.props.style, fontSize: 36 } })}
                    </div>
                    <h2 style={{
                      fontSize: 'clamp(14px, 3vw, 18px)',
                      fontWeight: 700,
                      color: '#dbe7f7',
                      marginBottom: 8,
                      letterSpacing: '-0.5px'
                    }}>
                      {item.title}
                    </h2>
                    <p style={{
                      fontSize: 'clamp(10px, 2vw, 12px)',
                      color: '#93a6c4',
                      marginBottom: 0,
                      lineHeight: 1.5
                    }}>
                      {item.description}
                    </p>
                  </div>
                  <Button
                    type="primary"
                    style={{ 
                      marginTop: 12,
                      background: 'linear-gradient(135deg, #00D3E5 0%, #00B8CC 100%)',
                      border: 'none',
                      fontWeight: 600,
                      letterSpacing: '0.5px'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      window.location.href = item.path;
                    }}
                  >
                    Mở
                  </Button>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;