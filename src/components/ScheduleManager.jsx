import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button, Form, Input, Modal, Space, Spin, Drawer, Select, TimePicker, Tag, Alert, message, Table, Calendar } from "antd";
import { PlusOutlined, DeleteOutlined, ArrowLeftOutlined, EditOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import axios from "axios";
import { useApiUrl } from "../hooks/useApiUrl";
import socket from "../socket";

dayjs.extend(customParseFormat);

const ScheduleManager = ({ user, onBack }) => {
  const [schedules, setSchedules] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showScheduleDrawer, setShowScheduleDrawer] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState(null);
  const [scheduleForm] = Form.useForm();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [accounts, setAccounts] = useState([]);
  const [selectedPlaylistFilter, setSelectedPlaylistFilter] = useState([]);
  const [selectedAccountFilter, setSelectedAccountFilter] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [recurrence, setRecurrence] = useState('one-time');
  const API_URL = useApiUrl();

  // Function to convert date to day of week string in Vietnamese
  const getDayOfWeekString = (date) => {
    const dayIndex = date.day(); // dayjs: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    // Convert to Vietnamese day names: 0 = Chủ Nhật, 1 = Thứ Hai, etc.
    const vietnameseDays = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    return vietnameseDays[dayIndex];
  };

  // Disable dates before today
  const disabledDate = (current) => {
    if (!current) return false;
    
    const today = dayjs().startOf('day');
    const currentDate = current.startOf('day');
    
    // Disable dates before today (but NOT today)
    if (currentDate.isBefore(today, 'day')) {
      return true;
    }
    
    return false;
  };

  const basicAuth = useMemo(() => ({
    username: process.env.REACT_APP_BASIC_AUTH_USERNAME,
    password: process.env.REACT_APP_BASIC_AUTH_PASSWORD
  }), []);

  const getAuthHeader = useCallback(() => {
    const credentials = `${basicAuth.username}:${basicAuth.password}`;
    const encoded = btoa(credentials);
    return `Basic ${encoded}`;
  }, [basicAuth]);

  // Fetch playlists
  const fetchPlaylists = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/admin/playlists?limit=1000`, {
        headers: {
          "Authorization": getAuthHeader()
        }
      });
      setPlaylists(response.data.data || []);
    } catch (err) {
      console.error(err);
    }
  }, [API_URL, getAuthHeader]);

  // Fetch accounts
  const fetchAccounts = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/admin/accounts?limit=1000`, {
        headers: {
          "Authorization": getAuthHeader()
        }
      });
      setAccounts(response.data.data || []);
    } catch (err) {
      console.error(err);
    }
  }, [API_URL, getAuthHeader]);

  // Fetch schedules
  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/admin/schedules`, {
        params: {
          search: searchTerm,
          page: currentPage
        },
        headers: {
          "Authorization": getAuthHeader()
        }
      });
      const scheduleData = response.data.data || [];
      console.log("Fetched schedules:", scheduleData);
      scheduleData.forEach((s, idx) => {
        console.log(`Schedule ${idx}:`, {
          _id: s._id,
          day: s.day,
          startTime: s.startTime,
          endTime: s.endTime
        });
      });
      setSchedules(scheduleData);
      if (response.data.pagination) {
        setPagination(response.data.pagination);
      }
    } catch (err) {
      console.error(err);
      // If schedules endpoint doesn't exist, use empty array
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, [API_URL, getAuthHeader, searchTerm, currentPage]);

  useEffect(() => {
    fetchPlaylists();
    fetchAccounts();
    fetchSchedules();
  }, [fetchPlaylists, fetchAccounts, fetchSchedules]);

  const handleScheduleSubmit = async (values) => {
    setLoading(true);

    try {
      // Get the date from selectedDate if available
      const scheduleDate = selectedDate ? selectedDate.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');
      
      // Ensure accounts is always an array
      const accountsArray = Array.isArray(values.accounts) ? values.accounts : [values.accounts];

      // Check if any of the selected accounts already have a schedule on this date/day
      const conflictingAccounts = [];
      
      // Get days to check (array for weekly, single day for one-time)
      const daysToCheck = recurrence === 'weekly' 
        ? (Array.isArray(values.day) ? values.day : [values.day])
        : [selectedDate ? getDayOfWeekString(selectedDate) : null];
      
      for (const accountId of accountsArray) {
        const hasConflict = schedules.some(schedule => {
          // Skip the current schedule being edited
          if (editingScheduleId && schedule._id === editingScheduleId) return false;
          
          // Get account IDs from the schedule
          const existingAccountIds = Array.isArray(schedule.accounts)
            ? schedule.accounts.map(a => a._id || a)
            : [schedule.account?._id || schedule.account];
          
          if (!existingAccountIds.includes(accountId)) return false;
          
          if (recurrence === 'one-time') {
            // Check date conflict
            return schedule.date === scheduleDate;
          } else if (recurrence === 'weekly') {
            // Check if any of the selected days conflicts with existing schedule
            const existingDays = Array.isArray(schedule.day) 
              ? schedule.day 
              : [schedule.day];
            return daysToCheck.some(day => existingDays.includes(day));
          }
          
          return false;
        });
        
        if (hasConflict) {
          const account = accounts.find(a => a._id === accountId);
          conflictingAccounts.push(account?.restaurantName || account?.name || account?.email);
        }
      }
      
      if (conflictingAccounts.length > 0) {
        message.error(`Tài khoản "${conflictingAccounts.join(', ')}" đã có lịch phát vào ngày/thời gian này. Vui lòng chọn ngày khác hoặc tài khoản khác.`);
        setLoading(false);
        return;
      }

      const url = editingScheduleId
        ? `${API_URL}/admin/schedules/${editingScheduleId}`
        : `${API_URL}/admin/schedules`;

      const method = editingScheduleId ? "put" : "post";

      // Ensure playlists is always an array
      const playlistsArray = Array.isArray(values.playlists) 
        ? values.playlists 
        : (values.playlists ? [values.playlists] : []);

      const payload = {
        playlists: playlistsArray,
        accounts: accountsArray,
        startTime: values.startTime?.format('HH:mm'),
        endTime: values.endTime?.format('HH:mm'),
        day: recurrence === 'weekly' ? (Array.isArray(values.day) ? values.day : [values.day]) : (selectedDate ? getDayOfWeekString(selectedDate) : null),
        date: recurrence === 'one-time' ? scheduleDate : null,
        recurrence: recurrence
      };

      console.log(editingScheduleId ? "Updating schedule:" : "Creating new schedule:", payload);

      await axios[method](url, payload, {
        headers: {
          "Authorization": getAuthHeader(),
          "Content-Type": "application/json"
        }
      });

      scheduleForm.resetFields();
      setShowScheduleDrawer(false);
      setEditingScheduleId(null);

      message.success(editingScheduleId ? "Cập nhật lịch phát thành công" : "Tạo lịch phát thành công");
      socket.emit('schedule-updated');
      await fetchSchedules();
    } catch (err) {
      console.error("Error:", err.response?.data || err);
      message.error(err.response?.data?.error || err.message || "Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  const handleEditSchedule = (schedule) => {
    const playlistIds = Array.isArray(schedule.playlists)
      ? schedule.playlists.map(p => p._id || p)
      : [schedule.playlists?._id || schedule.playlists];
    
    const accountIds = Array.isArray(schedule.accounts)
      ? schedule.accounts.map(a => a._id || a)
      : [schedule.account?._id || schedule.account];
    
    // Parse times using dayjs
    const startTime = dayjs(schedule.startTime, 'HH:mm');
    const endTime = dayjs(schedule.endTime, 'HH:mm');
    
    // Set recurrence
    setRecurrence(schedule.recurrence || 'one-time');
    
    // Set selected date if one-time and available
    if (schedule.recurrence === 'one-time' && schedule.date) {
      setSelectedDate(dayjs(schedule.date));
    } else {
      setSelectedDate(null);
    }
    
    // Handle day - convert to array for weekly
    const daysValue = schedule.recurrence === 'weekly' 
      ? (Array.isArray(schedule.day) ? schedule.day : [schedule.day])
      : schedule.day;
    
    scheduleForm.setFieldsValue({
      playlists: playlistIds,
      accounts: accountIds,
      recurrence: schedule.recurrence || 'one-time',
      day: daysValue,
      startTime: startTime,
      endTime: endTime
    });
    
    setEditingScheduleId(schedule._id);
    setShowScheduleDrawer(true);
  };

  const handleDeleteSchedule = (id) => {
    Modal.confirm({
      title: "Xác nhận xóa",
      content: "Bạn chắc chắn muốn xóa lịch phát này?",
      okText: "Xóa",
      okType: "danger",
      cancelText: "Hủy",
      onOk: async () => {
        setLoading(true);
        try {
          await axios.delete(`${API_URL}/admin/schedules/${id}`, {
            headers: {
              "Authorization": getAuthHeader()
            }
          });
          setSchedules(schedules.filter(s => s._id !== id));
          message.success("Xóa lịch phát thành công");
          socket.emit('schedule-updated');
        } catch (err) {
          console.error(err);
          message.error("Không thể xóa lịch phát");
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleCancelSchedule = () => {
    setShowScheduleDrawer(false);
    setEditingScheduleId(null);
    setSelectedDate(null);
    setRecurrence('one-time');
    scheduleForm.resetFields();
  };

  const handleSearch = (value) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const getPlaylistName = (playlistId) => {
    const playlist = playlists.find(p => p._id === playlistId);
    return playlist?.name || 'N/A';
  };

  const getAccountName = (accountId) => {
    const account = accounts.find(a => a._id === accountId);
    return account?.restaurantName || account?.name || account?.email || 'N/A';
  };

  // Filter out schedules with deleted playlists or accounts
  const filteredSchedules = useMemo(() => {
    return schedules.filter(schedule => {
      // Check if all playlists still exist
      const playlistsArray = Array.isArray(schedule.playlists) 
        ? schedule.playlists 
        : [schedule.playlists];
      const hasValidPlaylists = playlistsArray.some(p => {
        const playlistId = p._id || p;
        return playlists.some(pl => pl._id === playlistId);
      });

      // Check if all accounts still exist
      const accountsArray = Array.isArray(schedule.accounts)
        ? schedule.accounts
        : [schedule.account];
      const hasValidAccounts = accountsArray.some(a => {
        const accountId = a._id || a;
        return accounts.some(ac => ac._id === accountId);
      });

      // Check playlist filter
      let matchPlaylistFilter = true;
      if (selectedPlaylistFilter.length > 0) {
        const playlistIds = playlistsArray.map(p => p._id || p);
        matchPlaylistFilter = playlistIds.some(id => selectedPlaylistFilter.includes(id));
      }

      // Check account filter
      let matchAccountFilter = true;
      if (selectedAccountFilter.length > 0) {
        const accountIds = accountsArray.map(a => a._id || a);
        matchAccountFilter = accountIds.some(id => selectedAccountFilter.includes(id));
      }

      // Only show schedule if it has at least one valid playlist and account, and matches filters
      return hasValidPlaylists && hasValidAccounts && matchPlaylistFilter && matchAccountFilter;
    });
  }, [schedules, playlists, accounts, selectedPlaylistFilter, selectedAccountFilter]);

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
              <div className="header-title">Hẹn Giờ Phát Nhạc</div>
              <div className="header-sub">Music for Business</div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="dashboard-main">
          <div>
            <Button
              type="primary"
              size="middle"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingScheduleId(null);
                setShowScheduleDrawer(true);
                scheduleForm.resetFields();
                setRecurrence('one-time');
                setSelectedDate(null);
              }}
            >
              Tạo Lịch Phát Mới
            </Button>
          </div>

          <div className="dashboard-table-container">
            <h2 style={{ marginBottom: 20, fontSize: 18, fontWeight: 600 }}>
              Danh Sách Lịch Phát
            </h2>

            {/* Filter Section */}
            <div style={{ marginBottom: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <Select
                mode="multiple"
                placeholder="Lọc theo Danh Mục Phát"
                style={{ width: '100%' }}
                value={selectedPlaylistFilter}
                onChange={setSelectedPlaylistFilter}
                allowClear
                showSearch
                filterOption={(input, option) =>
                  (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                }
                virtual
              >
                {playlists.map((playlist) => (
                  <Select.Option key={playlist._id} value={playlist._id}>
                    {playlist.name}
                  </Select.Option>
                ))}
              </Select>

              <Select
                mode="multiple"
                placeholder="Lọc theo Tài Khoản"
                style={{ width: '100%' }}
                value={selectedAccountFilter}
                onChange={setSelectedAccountFilter}
                allowClear
                showSearch
                filterOption={(input, option) =>
                  (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                }
                virtual
              >
                {accounts.map((account) => (
                  <Select.Option key={account._id} value={account._id}>
                    {account.restaurantName || account.name || account.email}
                  </Select.Option>
                ))}
              </Select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Input
                placeholder="Tìm kiếm theo danh mục hoặc tài khoản..."
                allowClear
                onSearch={handleSearch}
                onChange={(e) => handleSearch(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <Spin spinning={loading}>
              {filteredSchedules.length === 0 ? (
                <Alert message="Chưa có lịch phát nào" type="info" />
              ) : (
                <Table
                  dataSource={filteredSchedules}
                  rowKey="_id"
                  pagination={{
                    current: currentPage,
                    pageSize: 10,
                    total: pagination.total,
                    onChange: (page) => setCurrentPage(page)
                  }}
                  columns={[
                    {
                      title: 'Danh Mục Phát',
                      dataIndex: 'playlists',
                      key: 'playlists',
                      render: (playlists) => (
                        Array.isArray(playlists) 
                          ? playlists.map(p => p.name || 'N/A').join(', ')
                          : getPlaylistName(playlists?._id || playlists)
                      )
                    },
                    {
                      title: 'Ngày',
                      dataIndex: 'day',
                      key: 'day',
                      render: (day) => (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {Array.isArray(day)
                            ? day.map(d => <Tag color="blue" key={d}>{d}</Tag>)
                            : <Tag color="blue">{day}</Tag>
                          }
                        </div>
                      )
                    },
                    {
                      title: 'Thời Gian',
                      key: 'time',
                      render: (_, schedule) => (
                        <Tag color="green">{schedule.startTime} - {schedule.endTime}</Tag>
                      )
                    },
                    {
                      title: 'Tài Khoản',
                      dataIndex: 'accounts',
                      key: 'accounts',
                      render: (accounts, schedule) => (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {Array.isArray(accounts)
                            ? accounts.map(a => (
                              <Tag color="cyan" key={a._id || a}>
                                {a.restaurantName || a.name || a.email || 'N/A'}
                              </Tag>
                            ))
                            : <Tag color="cyan">{getAccountName(schedule.account?._id || schedule.account)}</Tag>
                          }
                        </div>
                      )
                    },
                    {
                      title: 'Hành Động',
                      key: 'actions',
                      render: (_, schedule) => (
                        <Space>
                          <Button
                            type="primary"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => handleEditSchedule(schedule)}
                          >
                            Sửa
                          </Button>
                          <Button
                            danger
                            size="small"
                            type="primary"
                            icon={<DeleteOutlined />}
                            onClick={() => handleDeleteSchedule(schedule._id)}
                          >
                            Xóa
                          </Button>
                        </Space>
                      )
                    }
                  ]}
                scroll={{ x: true }}
                style={{ width: '100%', whiteSpace: 'nowrap' }}
                />
              )}
            </Spin>
          </div>
        </div>
      </div>

      {/* Drawer Form - Schedules */}
      <Drawer
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span>{editingScheduleId ? "Chỉnh Sửa Lịch Phát" : "Tạo Lịch Phát Mới"}</span>
            <div style={{ display: 'flex', gap: '12px' }}>
              <Button onClick={handleCancelSchedule}>
                Hủy
              </Button>
              <Button
                type="primary"
                onClick={() => scheduleForm.submit()}
                loading={loading}
              >
                {editingScheduleId ? 'Cập Nhật' : 'Tạo Mới'}
              </Button>
            </div>
          </div>
        }
        onClose={handleCancelSchedule}
        open={showScheduleDrawer}
        width={700}
        className="dashboard-drawer"
      >
        <Form
          form={scheduleForm}
          layout="vertical"
          onFinish={handleScheduleSubmit}
        >

          {/* Playlist Selection - Multi Select */}
          <Form.Item
            label="Chọn Danh Mục Phát"
            name="playlists"
            rules={[{ required: true, message: "Vui lòng chọn ít nhất một danh mục phát" }]}
            style={{ marginBottom: '16px' }}
          >
            <Select 
              mode="multiple"
              placeholder="Chọn một hoặc nhiều danh mục phát"
              optionLabelProp="label"
            >
              {playlists.map((playlist) => (
                <Select.Option key={playlist._id} value={playlist._id} label={playlist.name}>
                  {playlist.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          {/* Account Selection - Multi Select */}
          <Form.Item
            label="Chọn Tài Khoản Phát Nhạc"
            name="accounts"
            rules={[{ required: true, message: "Vui lòng chọn ít nhất một tài khoản" }]}
            style={{ marginBottom: '16px' }}
          >
            <Select 
              mode="multiple"
              placeholder="Chọn một hoặc nhiều tài khoản"
              optionLabelProp="label"
              showSearch
              filterOption={(input, option) =>
                (option?.children ?? '').toLowerCase().includes(input.toLowerCase())
              }
              virtual
              maxTagCount="responsive"
            >
              {accounts.map((account) => (
                <Select.Option 
                  key={account._id} 
                  value={account._id}
                  label={account.restaurantName || account.name || account.email}
                >
                  {account.restaurantName || account.name || account.email}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
  {/* Recurrence Selection */}
          <Form.Item
            label="Kiểu Lặp Lại"
            name="recurrence"
            initialValue="one-time"
            rules={[{ required: true, message: "Vui lòng chọn kiểu lặp lại" }]}
            style={{ marginBottom: '16px' }}
          >
            <Select onChange={(value) => setRecurrence(value)}>
              <Select.Option value="one-time">Một Lần</Select.Option>
              <Select.Option value="weekly">Mỗi Tuần</Select.Option>
            </Select>
          </Form.Item>
          {/* Day Selection */}
          <Form.Item
            label={recurrence === 'weekly' ? "Ngày Trong Tuần (Có thể chọn nhiều)" : "Ngày Phát"}
            name="day"
            rules={[{ required: true, message: "Vui lòng chọn ít nhất một ngày" }]}
            style={{ marginBottom: '16px' }}
          >
            {recurrence === 'weekly' ? (
              <Select 
                mode="multiple"
                placeholder="Chọn một hoặc nhiều ngày trong tuần"
                onChange={(values) => {
                  // Ensure it's always an array
                  const arrayValues = Array.isArray(values) ? values : [values];
                  scheduleForm.setFieldValue('day', arrayValues);
                }}
              >
                {['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'].map((day) => (
                  <Select.Option key={day} value={day}>
                    {day}
                  </Select.Option>
                ))}
              </Select>
            ) : (
              <div>
                <div style={{ marginBottom: '12px' }}>
                  {selectedDate && (
                    <div style={{ 
                      padding: '8px 12px', 
                      backgroundColor: '#e6f7ff', 
                      borderRadius: '4px',
                      color: '#0050b3',
                      fontWeight: 500
                    }}>
                      Đã chọn: {selectedDate.format('dddd, DD/MM/YYYY')} ({getDayOfWeekString(selectedDate)})
                    </div>
                  )}
                </div>
                <Calendar
                  fullscreen={false}
                  onChange={(date) => {
                    const dayString = getDayOfWeekString(date);
                    scheduleForm.setFieldValue('day', dayString);
                    setSelectedDate(date);
                  }}
                  value={selectedDate}
                  disabledDate={disabledDate}
                />
              </div>
            )}
          </Form.Item>

          {/* Time Range */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <Form.Item
              label="Giờ Bắt Đầu"
              name="startTime"
              rules={[{ required: true, message: "Vui lòng chọn giờ bắt đầu" }]}
              style={{ marginBottom: 0 }}
            >
              <TimePicker format="HH:mm" placeholder="HH:mm" className="icon-time" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              label="Giờ Kết Thúc"  
              name="endTime"
              rules={[{ required: true, message: "Vui lòng chọn giờ kết thúc" }]}
              style={{ marginBottom: 0 }}
            >
              <TimePicker format="HH:mm" placeholder="HH:mm" className="icon-time" style={{ width: '100%' }} />
            </Form.Item>
          </div>
        </Form>
      </Drawer>
    </div>
  );
};

export default ScheduleManager;
