import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Table, Button, Form, Input, Switch, Modal, Space, Spin, Drawer, Alert, Descriptions, Tag, message, Select } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, ArrowLeftOutlined, EyeOutlined, ReloadOutlined, LogoutOutlined } from "@ant-design/icons";
import axios from "axios";
import { useApiUrl } from "../hooks/useApiUrl";
import "../styles/Dashboard.css";
import socket from "../socket";

const AccountManager = ({ user, onBack }) => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [showDrawer, setShowDrawer] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [accountDetail, setAccountDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loginLogs, setLoginLogs] = useState({});
  const [userStatuses, setUserStatuses] = useState({});
  const [playingStatuses, setPlayingStatuses] = useState({});
  const [realTimePlayingStatus, setRealTimePlayingStatus] = useState({});
  const [accountSchedules, setAccountSchedules] = useState({});
  const [playingFilter, setPlayingFilter] = useState('all');
  const [onlineFilter, setOnlineFilter] = useState('all');
  const API_URL = useApiUrl();

  const basicAuth = useMemo(() => ({
    username: process.env.REACT_APP_BASIC_AUTH_USERNAME,
    password: process.env.REACT_APP_BASIC_AUTH_PASSWORD
  }), []);

  const getAuthHeader = useCallback(() => {
    const credentials = `${basicAuth.username}:${basicAuth.password}`;
    const encoded = btoa(credentials);
    return `Basic ${encoded}`;
  }, [basicAuth]);

  const fetchLoginLogs = useCallback(async (accountIds) => {
    try {
      const response = await axios.get(`${API_URL}/admin/login-logs`, {
        headers: {
          "Authorization": getAuthHeader()
        }
      });

      const logsMap = {};
      if (response.data.data && Array.isArray(response.data.data)) {
        response.data.data.forEach(log => {
          logsMap[log.accountId] = log;
        });
      }
      setLoginLogs(logsMap);
    } catch (err) {
      console.error('Error fetching login logs:', err);
    }
  }, [API_URL, getAuthHeader]);
  const fetchAccountSchedules = useCallback(async (accountId) => {
    try {
      const response = await axios.get(`${API_URL}/admin/schedules/account/${accountId}`, {
        headers: {
          "Authorization": getAuthHeader()
        }
      });
      setAccountSchedules(prev => ({ ...prev, [accountId]: response.data.data || [] }));
    } catch (err) {
      console.error("Error fetching account schedules:", err);
      setAccountSchedules(prev => ({ ...prev, [accountId]: [] }));
    }
  }, [API_URL, getAuthHeader]);
  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/admin/accounts`, {
        params: {
          search: searchTerm,
          page: currentPage,
          onlineFilter: onlineFilter,
          playingFilter: playingFilter
        },
        headers: {
          "Authorization": getAuthHeader()
        }
      });
      setAccounts(response.data.data || []);
      if (response.data.pagination) {
        setPagination(response.data.pagination);
      }

      // Fetch login logs for accounts
      if (response.data.data && response.data.data.length > 0) {
        const accountIds = response.data.data.map(acc => acc._id);
        await fetchLoginLogs(accountIds);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [API_URL, getAuthHeader, searchTerm, currentPage, fetchLoginLogs, onlineFilter, playingFilter]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Send user-online when user is available (for admin viewing accounts)
  useEffect(() => {
    if (user) {
      socket.emit('user-online', {
        accountId: user._id,
        username: user.username,
        restaurantName: user.restaurantName
      });
      // Request current online statuses
      socket.emit('request-online-statuses');
    }
  }, [user]);

  // Listen for real-time updates
  useEffect(() => {
    const handleUserStatusUpdate = (data) => {
      setUserStatuses(prev => ({
        ...prev,
        [data.accountId]: data.status
      }));
    };

    const handleOnlineStatusesBatch = (onlineUsers) => {
      const statuses = {};
      onlineUsers.forEach(user => {
        statuses[user.accountId] = user.status;
      });
      setUserStatuses(statuses);
    };

    const handlePlayingStatusUpdate = (data) => {
      setPlayingStatuses(prev => ({
        ...prev,
        [data.accountId]: data
      }));
      setRealTimePlayingStatus(prev => ({
        ...prev,
        [data.accountId]: data
      }));
    };

    const handleUserOffline = (data) => {
      setUserStatuses(prev => ({ ...prev, [data.accountId]: 'offline' }));
      setPlayingStatuses(prev => {
        const newStatuses = { ...prev };
        delete newStatuses[data.accountId];
        return newStatuses;
      });
      setRealTimePlayingStatus(prev => {
        const newStatuses = { ...prev };
        delete newStatuses[data.accountId];
        return newStatuses;
      });
    };

    socket.on('user-status-update', handleUserStatusUpdate);
    socket.on('online-statuses-batch', handleOnlineStatusesBatch);
    socket.on('playing-status-update', handlePlayingStatusUpdate);
    socket.on('user-offline', handleUserOffline);

    return () => {
      socket.off('user-status-update', handleUserStatusUpdate);
      socket.off('online-statuses-batch', handleOnlineStatusesBatch);
      socket.off('playing-status-update', handlePlayingStatusUpdate);
      socket.off('user-offline', handleUserOffline);
    };
  }, []);

  const handleSubmit = async (values) => {
    setLoading(true);

    try {
      const url = editingId
        ? `${API_URL}/admin/accounts/${editingId}`
        : `${API_URL}/admin/accounts`;

      const method = editingId ? "put" : "post";

      // eslint-disable-next-line no-unused-vars
      const response = await axios[method](url, values, {
        headers: {
          "Authorization": getAuthHeader()
        }
      });

      form.resetFields();
      setShowDrawer(false);
      setEditingId(null);

      await fetchAccounts();
    } catch (err) {
      console.error(err);
      if (err.response && err.response.status === 409) {
        message.warning(err.response.data.error);
      } else {
        message.error("Có lỗi xảy ra khi lưu tài khoản");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (account) => {
    form.setFieldsValue({
      username: account.username,
      password: account.password,
      restaurantName: account.restaurantName,
      permission: account.permission
    });
    setEditingId(account._id);
    setShowDrawer(true);
  };

  const handleDelete = (id) => {
    Modal.confirm({
      title: "Xác nhận xóa",
      content: "Bạn chắc chắn muốn xóa tài khoản này?",
      okText: "Xóa",
      okType: "danger",
      cancelText: "Hủy",
      onOk: async () => {
        setLoading(true);

        try {
          await axios.delete(
            `${API_URL}/admin/accounts/${id}`,
            {
              headers: {
                "Authorization": getAuthHeader()
              }
            }
          );

          await fetchAccounts();
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleRemoteLogout = (accountId) => {
    Modal.confirm({
      title: "Xác nhận đăng xuất từ xa",
      content: "Bạn chắc chắn muốn đăng xuất tài khoản này từ xa?",
      okText: "Đăng xuất",
      okType: "danger",
      cancelText: "Hủy",
      onOk: () => {
        socket.emit('remote-logout', { accountId });
        message.success('Đã gửi lệnh đăng xuất từ xa.');
      }
    });
  };

  const handleSearch = (value) => {
    setSearchTerm(value);
    setCurrentPage(1); // Reset to first page on search
  };

  const handleCancel = () => {
    setShowDrawer(false);
    setEditingId(null);
    form.resetFields();
  };

  const handleViewDetail = async (account) => {
    setDetailLoading(true);
    try {
      const response = await axios.get(
        `${API_URL}/admin/user-playlist-logs/last-selected/${account._id}`,
        {
          headers: {
            "Authorization": getAuthHeader()
          }
        }
      );

      // Fetch schedules for this account
      await fetchAccountSchedules(account._id);

      // Get IP and location from loginLogs
      const log = loginLogs[account._id];

      setAccountDetail({
        ...account,
        playlistLog: response.data.data,
        ipAddress: log?.ipAddress || null,
        location: log?.location || null
      });
      setShowDetailModal(true);
    } catch (err) {
      console.error(err);
      // Fetch schedules even on error
      await fetchAccountSchedules(account._id);
      const log = loginLogs[account._id];
      setAccountDetail({
        ...account,
        playlistLog: null,
        ipAddress: log?.ipAddress || null,
        location: log?.location || null
      });
      setShowDetailModal(true);
    } finally {
      setDetailLoading(false);
    }
  };

  const columns = [
    {
      title: "#",
      key: "index",
      render: (_, __, index) => index + 1,
      width: 50
    },
    {
      title: "Username",
      dataIndex: "username",
      key: "username",
    },
    {
      title: "Tên Nhà Hàng",
      dataIndex: "restaurantName",
      key: "restaurantName",
    },
    {
      title: "Trạng Thái Đăng Nhập",
      key: "loginStatus",
      render: (_, record) => {
        const status = userStatuses[record._id];
        const isOnline = status === 'online';
        return (
          <Tag color={isOnline ? "green" : "red"} style={{ fontSize: 12 }}>
            {isOnline ? "Online" : "Offline"}
          </Tag>
        );
      }
    },
    {
      title: "IP Address",
      key: "ipAddress",
      render: (_, record) => {
        const log = loginLogs[record._id];
        return log?.ipAddress || "-";
      }
    },
    {
      title: "Vị Trí",
      key: "location",
      render: (_, record) => {
        const log = loginLogs[record._id];
        return log?.location || "-";
      }
    },
    {
      title: "Lần Đăng Nhập Cuối",
      key: "lastLogin",
      render: (_, record) => {
        const log = loginLogs[record._id];
        if (!log?.lastStatusChange) return "-";
        return new Date(log.lastStatusChange).toLocaleString("vi-VN");
      }
    },
    {
      title: "Quyền",
      dataIndex: "permission",
      key: "permission",
      render: (permission) => (
        <span style={{ color: permission ? "#52c41a" : "#f5222d" }}>
          {permission ? "Có" : "Không"}
        </span>
      )
    },
    {
      title: "Đang Phát",
      key: "playingStatus",
      render: (_, record) => {
        const playing = playingStatuses[record._id];
        if (!playing) return <span style={{ color: '#93a6c4' }}>Không có dữ liệu</span>;
        
        const songInfo = playing.currentSong ? `${playing.currentSong.title} - ${playing.currentSong.artist}` : 'N/A';
        const playlistInfo = playing.freePlayMode ? (playing.playlist?.name || 'Phát tự do') : (playing.playlist && playing.playlist.startTime && playing.playlist.endTime ? `${playing.playlist.name} (${playing.playlist.startTime}-${playing.playlist.endTime})` : 'Phát tự do');
        const status = playing.isPlaying ? 'Đang phát' : 'Tạm dừng';
        
        return (
          <div style={{ fontSize: 12, lineHeight: 1.4 }}>
            <div style={{ color: playing.isPlaying ? '#00D3E5' : '#f5222d' }}>{status}</div>
            <div>{songInfo}</div>
            <div style={{ color: '#93a6c4' }}>{playlistInfo}</div>
          </div>
        );
      }
    },
    {
      title: "Ngày Tạo",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (date) => new Date(date).toLocaleDateString("vi-VN")
    },
    {
      title: "Hành Động",
      key: "actions",
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            Chi Tiết
          </Button>
          <Button
            type="primary"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            Sửa
          </Button>
          <Button
            type="primary"
            size="small"
            icon={<LogoutOutlined />}
            onClick={() => handleRemoteLogout(record._id)}
            style={{ backgroundColor: '#faad14', borderColor: '#faad14' }}
          >
            Đăng xuất từ xa
          </Button>
          <Button
            danger
            size="small"
            type='primary'
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record._id)}
          >
            Xóa
          </Button>
        </Space>
      )
    }
  ];

  // Filtering is now handled on backend, so we use accounts directly
  const filteredAccounts = accounts;

  return (
    <div className="dashboard-root">
      <div className="dashboard-content">
        {/* Header */}
        <div className="dashboard-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="timeline-arrow">
              <Button
                type="text"
                icon={<ArrowLeftOutlined />}
                onClick={onBack}
                style={{ color: '#dbe7f7' }}
              />
            </div>
            <div className="header-info">
              <div className="header-title">Quản Lý Tài Khoản</div>
              <div className="header-sub">Music for Business</div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="dashboard-main">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Button
              type="primary"
              size="middle"
              icon={<PlusOutlined />}
              onClick={() => {
                setShowDrawer(true);
                setEditingId(null);
                form.resetFields();
              }}
            >
              Thêm Tài Khoản Mới
            </Button>
            <Button
              size="middle"
              icon={<ReloadOutlined />}
              onClick={() => fetchAccounts()}
            >
              Làm Mới
            </Button>
          </div>

          <div className="dashboard-table-container">
            <h2 style={{ marginBottom: 20, fontSize: 18, fontWeight: 600 }}>
              Danh Sách Tài Khoản
            </h2>
            {accounts.length === 0 && !loading ? (
              <Alert message="Chưa có tài khoản nào" type="info" showIcon />
            ) : (
              <>
                <div style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
                  <Select
                    value={onlineFilter}
                    onChange={setOnlineFilter}
                    style={{ width: 200 }}
                    placeholder="Lọc theo trạng thái online"
                  >
                    <Select.Option value="all">Tất cả</Select.Option>
                    <Select.Option value="online">Online</Select.Option>
                    <Select.Option value="offline">Offline</Select.Option>
                  </Select>
                  <Select
                    value={playingFilter}
                    onChange={setPlayingFilter}
                    style={{ width: 200 }}
                    placeholder="Lọc theo trạng thái phát nhạc"
                  >
                    <Select.Option value="all">Tất cả</Select.Option>
                    <Select.Option value="playing">Đang phát nhạc</Select.Option>
                    <Select.Option value="not-playing">Không phát nhạc</Select.Option>
                  </Select>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <Input
                    placeholder="Tìm kiếm theo username hoặc tên nhà hàng..."
                    allowClear
                    onSearch={handleSearch}
                    onChange={(e) => handleSearch(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
                <Spin spinning={loading}>
                  <Table
                    columns={columns}
                    dataSource={filteredAccounts}
                    size="small"
                    rowKey="_id"
                    pagination={{
                      pageSize: 5,
                      current: currentPage,
                      total: pagination.total,
                      totalPages: pagination.totalPages,
                      onChange: (page) => setCurrentPage(page)
                    }}
                    locale={{ emptyText: "Chưa có tài khoản nào" }}
                    scroll={{ x: true }}
                    style={{ width: '100%', whiteSpace: 'nowrap' }}
                  />
                </Spin>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Drawer Form - Accounts */}
      <Drawer
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span>{editingId ? "Chỉnh Sửa Tài Khoản" : "Tạo Tài Khoản Mới"}</span>
            <div style={{ display: 'flex', gap: '12px' }}>
              <Button onClick={handleCancel}>
                Hủy
              </Button>
              <Button
                type="primary"
                onClick={() => form.submit()}
                loading={loading}
                size="middle"
              >
                Lưu
              </Button>
            </div>
          </div>
        }
        onClose={handleCancel}
        open={showDrawer}
        width={400}
        className="dashboard-drawer"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{ permission: false }}
        >
          <Form.Item
            label="Username"
            name="username"
            rules={[{ required: true, message: "Vui lòng nhập username" }]}
          >
            <Input
              placeholder="Nhập username"
              disabled={editingId ? true : false}
              size="middle"
            />
          </Form.Item>

          <Form.Item
            label="Password"
            name="password"
            rules={[{ required: true, message: "Vui lòng nhập password" }]}
          >
            <Input.Password placeholder="Nhập password" size="middle" />
          </Form.Item>

          <Form.Item
            label="Tên Nhà Hàng"
            name="restaurantName"
            rules={[{ required: true, message: "Vui lòng nhập tên nhà hàng" }]}
          >
            <Input placeholder="Nhập tên nhà hàng" />
          </Form.Item>

          <Form.Item name="permission" valuePropName="checked" style={{ marginBottom: 24 }} label="Cấp quyền truy cập dashboard">
            <Switch />
          </Form.Item>
        </Form>
      </Drawer>

      {/* Detail Drawer - Account Status */}
      <Drawer
        title="Chi Tiết Trạng Thái Tài Khoản"
        onClose={() => setShowDetailModal(false)}
        open={showDetailModal}
        width={800}
        className="dashboard-drawer"
      >
        <Spin spinning={detailLoading}>
          {accountDetail && (
            <>
              <div style={{ marginBottom: 32 }}>
                <h3 style={{ marginBottom: 16, fontSize: 14, fontWeight: 600, color: '#00D3E5' }}>
                  THÔNG TIN TÀI KHOẢN
                </h3>
                <Descriptions bordered column={1} size="small" style={{
                  backgroundColor: '#1a2332',
                  borderColor: '#2a3a4a'
                }}>
                  <Descriptions.Item
                    label="Tên Tài Khoản"
                    labelStyle={{ color: '#93a6c4', backgroundColor: '#0f1419' }}
                    contentStyle={{ color: '#dbe7f7', backgroundColor: '#1a2332' }}
                  >
                    <strong>{accountDetail.username}</strong>
                  </Descriptions.Item>
                  <Descriptions.Item
                    label="Tên Nhà Hàng"
                    labelStyle={{ color: '#93a6c4', backgroundColor: '#0f1419' }}
                    contentStyle={{ color: '#dbe7f7', backgroundColor: '#1a2332' }}
                  >
                    {accountDetail.restaurantName}
                  </Descriptions.Item>
                  <Descriptions.Item
                    label="Quyền Dashboard"
                    labelStyle={{ color: '#93a6c4', backgroundColor: '#0f1419' }}
                    contentStyle={{ color: '#dbe7f7', backgroundColor: '#1a2332' }}
                  >
                    <Tag color={accountDetail.permission ? "green" : "red"}>
                      {accountDetail.permission ? "Có Quyền" : "Không Có Quyền"}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item
                    label="Ngày Tạo"
                    labelStyle={{ color: '#93a6c4', backgroundColor: '#0f1419' }}
                    contentStyle={{ color: '#dbe7f7', backgroundColor: '#1a2332' }}
                  >
                    {new Date(accountDetail.createdAt).toLocaleString("vi-VN")}
                  </Descriptions.Item>
                  <Descriptions.Item
                    label="IP Address"
                    labelStyle={{ color: '#93a6c4', backgroundColor: '#0f1419' }}
                    contentStyle={{ color: '#dbe7f7', backgroundColor: '#1a2332' }}
                  >
                    {accountDetail.ipAddress || "-"}
                  </Descriptions.Item>
                  <Descriptions.Item
                    label="Vị Trí"
                    labelStyle={{ color: '#93a6c4', backgroundColor: '#0f1419' }}
                    contentStyle={{ color: '#dbe7f7', backgroundColor: '#1a2332' }}
                  >
                    {accountDetail.location || "-"}
                  </Descriptions.Item>
                </Descriptions>
              </div>

              {/* Schedules Section */}
              <div style={{ marginBottom: 32 }}>
                <h3 style={{ marginBottom: 16, fontSize: 14, fontWeight: 600, color: '#00D3E5' }}>
                  LỊCH TRÌNH KHUNG GIỜ PHÁT
                </h3>
                {accountSchedules[accountDetail._id] && accountSchedules[accountDetail._id].length > 0 ? (() => {
                  // Group schedules by timeSlot
                  const groupedByTime = {};
                  accountSchedules[accountDetail._id].forEach(schedule => {
                    const timeKey = `${schedule.startTime || 'N/A'}-${schedule.endTime || 'N/A'}`;
                    if (!groupedByTime[timeKey]) {
                      groupedByTime[timeKey] = {
                        timeSlot: timeKey,
                        startTime: schedule.startTime,
                        endTime: schedule.endTime,
                        recurrence: schedule.recurrence,
                        days: [],
                        totalPlaylists: 0
                      };
                    }
                    groupedByTime[timeKey].days.push(schedule.day);
                    groupedByTime[timeKey].totalPlaylists += schedule.playlists?.length || 0;
                  });
                  
                  return (
                    <div style={{
                      padding: 16,
                      backgroundColor: '#1a2332',
                      border: '1px solid #2a3a4a',
                      borderRadius: 8
                    }}>
                      {Object.values(groupedByTime).map((group, index) => (
                        <div key={index} style={{ marginBottom: index < Object.values(groupedByTime).length - 1 ? 12 : 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#dbe7f7', marginBottom: 4 }}>
                            {group.days.join('-')} - {group.startTime && group.endTime ? `${group.startTime} đến ${group.endTime}` : 'Chưa thiết lập khung giờ'}
                          </div>
                          <div style={{ fontSize: 12, color: '#93a6c4' }}>
                            {group.recurrence === 'weekly' ? 'Hàng tuần' : 'Một lần'} - {group.totalPlaylists} playlist
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })() : (
                  <Alert message="Chưa có lịch trình nào" type="info" showIcon />
                )}
              </div>

              <div>
                <h3 style={{ marginBottom: 16, fontSize: 14, fontWeight: 600, color: '#00D3E5' }}>
                  THÔNG TIN PHÁT NHẠC GẦN ĐÂY
                </h3>
                {(() => {
                  const realTimeData = realTimePlayingStatus[accountDetail._id];
                  const combinedPlaylistLog = realTimeData ? {
                    playlistName: realTimeData.playlist?.name || 'N/A',
                    scheduleDay: realTimeData.playlist?.day || null,
                    scheduleStartTime: realTimeData.playlist?.startTime || null,
                    scheduleEndTime: realTimeData.playlist?.endTime || null,
                    currentSongTitle: realTimeData.currentSong?.title || null,
                    currentSongArtist: realTimeData.currentSong?.artist || null,
                    isPlaying: realTimeData.isPlaying || false,
                    type: realTimeData.freePlayMode ? 'album' : 'playlist',
                    updatedAt: new Date().toISOString()
                  } : accountDetail.playlistLog;
                  return combinedPlaylistLog ? (
                  <div>
                    {/* Playlist Info */}
                    <div style={{
                      padding: 16,
                      backgroundColor: '#1a2332',
                      border: '1px solid #2a3a4a',
                      borderRadius: 8,
                      marginBottom: 16
                    }}>
                      <div style={{
                        fontSize: 11,
                        color: '#93a6c4',
                        marginBottom: 8,
                        textTransform: 'uppercase',
                        fontWeight: 600,
                        letterSpacing: 0.5
                      }}>
                        {combinedPlaylistLog.type === 'album' ? 'Album Đang Phát' : 'Playlist Đang Phát'}
                      </div>
                      <div style={{
                        fontSize: 16,
                        fontWeight: 600,
                        color: '#00D3E5'
                      }}>
                        {combinedPlaylistLog.playlistName}
                      </div>
                      <div style={{
                        fontSize: 12,
                        color: '#93a6c4',
                        marginTop: 4
                      }}>
                        Chế độ phát: {combinedPlaylistLog.type === 'album' ? 'Phát tự do' : 'Phát theo playlist'}
                      </div>
                    </div>

                    {/* Schedule Info */}
                    {combinedPlaylistLog.scheduleDay && (() => {
                      const scheduleTimeKey = `${combinedPlaylistLog.scheduleStartTime || 'N/A'}-${combinedPlaylistLog.scheduleEndTime || 'N/A'}`;
                      const matchingSchedules = accountSchedules[accountDetail._id]?.filter(s => 
                        `${s.startTime || 'N/A'}-${s.endTime || 'N/A'}` === scheduleTimeKey
                      ) || [];
                      const daysForThisSchedule = matchingSchedules.map(s => s.day);
                      
                      return (
                        <div style={{
                          padding: 16,
                          backgroundColor: '#1a2332',
                          border: '1px solid #2a3a4a',
                          borderRadius: 8,
                          marginBottom: 16
                        }}>
                          <div style={{
                            fontSize: 11,
                            color: '#93a6c4',
                            marginBottom: 8,
                            textTransform: 'uppercase',
                            fontWeight: 600,
                            letterSpacing: 0.5
                          }}>
                            Lịch Trình & Khung Giờ Phát
                          </div>
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 12, color: '#93a6c4', marginBottom: 4 }}>Ngày:</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#dbe7f7' }}>
                              {daysForThisSchedule.length > 0 ? daysForThisSchedule.join('-') : accountDetail.playlistLog.scheduleDay}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: 12, color: '#93a6c4', marginBottom: 4 }}>Khung Giờ:</div>
                            <div style={{ fontSize: 14, fontWeight: 600, color: '#00D3E5' }}>
                              {combinedPlaylistLog.scheduleStartTime} - {combinedPlaylistLog.scheduleEndTime}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Current Song Info */}
                    <div style={{
                      padding: 16,
                      backgroundColor: '#1a2332',
                      border: '1px solid #2a3a4a',
                      borderRadius: 8,
                      marginBottom: 16
                    }}>
                      <div style={{
                        fontSize: 11,
                        color: '#93a6c4',
                        marginBottom: 8,
                        textTransform: 'uppercase',
                        fontWeight: 600,
                        letterSpacing: 0.5
                      }}>
                        Bài Hát Hiện Tại
                      </div>
                      {combinedPlaylistLog.currentSongTitle ? (
                        <>
                          <div style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: '#dbe7f7',
                            marginBottom: 4
                          }}>
                            {combinedPlaylistLog.currentSongTitle}
                          </div>
                          <div style={{
                            fontSize: 12,
                            color: '#93a6c4',
                            marginBottom: 12
                          }}>
                            {combinedPlaylistLog.currentSongArtist}
                          </div>
                          {realTimeData && realTimeData.songs && realTimeData.songs.length > 0 && (
                            <div style={{ marginBottom: 12 }}>
                              <Select
                                placeholder="Chọn bài hát để phát"
                                style={{ width: '100%' }}
                                onChange={(songId) => {
                                  socket.emit('remote-select-song', { accountId: accountDetail._id, songId });
                                }}
                                options={realTimeData.songs.map(song => ({
                                  value: song._id,
                                  label: `${song.title} - ${song.artist || 'N/A'}`
                                }))}
                                value={realTimeData.currentSong?._id}
                                disabled={userStatuses[accountDetail._id] !== 'online'}
                              />
                            </div>
                          )}
                          <Button
                            type="primary"
                            size="small"
                            onClick={() => {
                              socket.emit('remote-play-pause', { accountId: accountDetail._id });
                            }}
                            style={{ width: '100%' }}
                            disabled={userStatuses[accountDetail._id] !== 'online'}
                          >
                            {combinedPlaylistLog.isPlaying ? 'Tạm Dừng' : 'Phát'}
                          </Button>
                        </>
                      ) : (
                        <div style={{ color: '#93a6c4' }}>Chưa có bài hát</div>
                      )}
                    </div>

                    {/* Status */}
                    <div style={{
                      padding: 16,
                      backgroundColor: '#1a2332',
                      border: '1px solid #2a3a4a',
                      borderRadius: 8,
                      marginBottom: 16
                    }}>
                      <div style={{
                        fontSize: 11,
                        color: '#93a6c4',
                        marginBottom: 8,
                        textTransform: 'uppercase',
                        fontWeight: 600,
                        letterSpacing: 0.5
                      }}>
                        Trạng Thái
                      </div>
                      <div>
                        <Tag
                          color={combinedPlaylistLog.isPlaying ? "processing" : "error"}
                          style={{ fontSize: 12, padding: '4px 12px' }}
                        >
                          {combinedPlaylistLog.isPlaying ? "Đang Phát" : "Tạm Dừng"}
                        </Tag>
                      </div>
                    </div>

                    {/* Updated Time */}
                    <div style={{
                      padding: 16,
                      backgroundColor: '#1a2332',
                      border: '1px solid #2a3a4a',
                      borderRadius: 8
                    }}>
                      <div style={{
                        fontSize: 11,
                        color: '#93a6c4',
                        marginBottom: 8,
                        textTransform: 'uppercase',
                        fontWeight: 600,
                        letterSpacing: 0.5
                      }}>
                        Cập Nhật Lần Cuối
                      </div>
                      <div style={{
                        fontSize: 13,
                        color: '#dbe7f7'
                      }}>
                        {new Date(combinedPlaylistLog.updatedAt).toLocaleString("vi-VN")}
                      </div>
                    </div>
                  </div>
                ) : (
                  <Alert message="Chưa có dữ liệu phát nhạc" type="info" showIcon />
                );
                })()}
              </div>
            </>
          )}
        </Spin>
      </Drawer>
    </div>
  );
};

export default AccountManager;
