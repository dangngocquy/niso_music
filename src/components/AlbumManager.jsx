import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Button, Form, Input, Upload, Space, Row, Col, message, Drawer, Checkbox, Alert, Modal, Tag, Spin } from 'antd';
import { UploadOutlined, PlusOutlined, EditOutlined, DeleteOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useApiUrl } from '../hooks/useApiUrl';
import defaultImage from '../asset/disk.webp';
import loadinggif from '../asset/opac.gif';
import '../styles/Dashboard.css';
import socket from '../socket';

const { TextArea } = Input;

const AlbumManager = ({ user, onBack }) => {
  const API_URL = useApiUrl();
  const [albums, setAlbums] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const [musicFiles, setMusicFiles] = useState([]);
  const [selectedSongs, setSelectedSongs] = useState([]);
  const [selectedSongsData, setSelectedSongsData] = useState({});
  const [showSongsDrawer, setShowSongsDrawer] = useState(false);
  // Music pagination state
  const [musicCurrentPage, setMusicCurrentPage] = useState(1);
  const [musicPagination, setMusicPagination] = useState({ total: 0, totalPages: 1 });
  const [loadingMoreMusic, setLoadingMoreMusic] = useState(false);
  const [musicSearchTerm, setMusicSearchTerm] = useState("");
  const [showAlbumDrawer, setShowAlbumDrawer] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [currentAlbumImage, setCurrentAlbumImage] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [freePlayPermissions, setFreePlayPermissions] = useState([]);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const basicAuth = useMemo(() => ({
    username: process.env.REACT_APP_BASIC_AUTH_USERNAME,
    password: process.env.REACT_APP_BASIC_AUTH_PASSWORD
  }), []);

  const getAuthHeader = useCallback(() => {
    const credentials = `${basicAuth.username}:${basicAuth.password}`;
    const encoded = btoa(credentials);
    return `Basic ${encoded}`;
  }, [basicAuth]);

  const loadLocal = useCallback(() => {
    try {
      const raw = localStorage.getItem('albums');
      const arr = raw ? JSON.parse(raw) : [];
      setAlbums(arr);
    } catch (err) {
      setAlbums([]);
    }
  }, []);

  const fetchAlbums = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/admin/albums`, {
        headers: {
          'Authorization': getAuthHeader()
        }
      });
      const backendAlbums = response.data.data || [];
      setAlbums(backendAlbums.map(album => ({ ...album, id: album._id })));
    } catch (err) {
      console.error('Error fetching albums:', err);
      // Fallback to localStorage if backend fails
      loadLocal();
    }
  }, [API_URL, getAuthHeader, loadLocal]);

  const fetchMusicFiles = useCallback(async (pageNum = 1, search = "") => {
    try {
      const isFirstPage = pageNum === 1;
      if (isFirstPage) {
        setLoadingMoreMusic(true);
      }
      
      const response = await axios.get(`${API_URL}/admin/music`, {
        params: {
          search: search,
          page: pageNum
        },
        headers: {
          'Authorization': getAuthHeader()
        }
      });
      
      const newMusic = response.data.data || [];
      
      // Append to existing music or replace based on page
      setMusicFiles(prevMusic => {
        if (isFirstPage) {
          return newMusic;
        } else {
          // Remove duplicates when appending
          const existingIds = new Set(prevMusic.map(m => m._id));
          const newItems = newMusic.filter(m => !existingIds.has(m._id));
          return [...prevMusic, ...newItems];
        }
      });
      
      if (response.data.pagination) {
        setMusicPagination(response.data.pagination);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMoreMusic(false);
    }
  }, [API_URL, getAuthHeader]);

  const fetchAccounts = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/admin/accounts`, {
        headers: {
          'Authorization': getAuthHeader()
        }
      });
      setAccounts(response.data.data || []);
    } catch (err) {
      console.error(err);
    }
  }, [API_URL, getAuthHeader]);

  const fetchPermissions = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/permissions/freeplay`, {
        headers: {
          'Authorization': getAuthHeader()
        }
      });
      setFreePlayPermissions(response.data.permissions || []);
    } catch (err) {
      console.error('Error fetching permissions:', err);
      setFreePlayPermissions([]);
    }
  }, [API_URL, getAuthHeader]);

  const savePermissions = useCallback(async (permissions) => {
    try {
      await axios.post(`${API_URL}/admin/permissions/freeplay`, { accountIds: permissions }, {
        headers: {
          'Authorization': getAuthHeader()
        }
      });
      message.success('Đã lưu quyền phát tự do');
      socket.emit('permissions-updated');
    } catch (err) {
      console.error('Error saving permissions:', err);
      message.error('Lỗi khi lưu quyền');
    }
  }, [API_URL, getAuthHeader]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          fetchAlbums(),
          fetchMusicFiles(1, ""),
          fetchAccounts(),
          fetchPermissions()
        ]);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [fetchAlbums, fetchMusicFiles, fetchAccounts, fetchPermissions]);

  // Load music data when songs drawer opens
  useEffect(() => {
    if (showSongsDrawer && musicFiles.length === 0) {
      fetchMusicFiles(1, "");
    }
  }, [showSongsDrawer, musicFiles.length, fetchMusicFiles]);

  const saveToBackend = async (albumData, isUpdate = false) => {
    if (isUpdate && (!albumData.id || albumData.id.length !== 24)) {
      // Local album, update local only
      const updatedAlbums = albums.map(album =>
        album.id === albumData.id ? { ...album, ...albumData, updatedAt: new Date() } : album
      );
      localStorage.setItem('albums', JSON.stringify(updatedAlbums));
      setAlbums(updatedAlbums);
      message.success('Cập nhật album thành công (local)');
      return;
    }
    try {
      const url = isUpdate ? `${API_URL}/admin/albums/${albumData.id}` : `${API_URL}/admin/albums`;
      const method = isUpdate ? 'put' : 'post';
      const response = await axios[method](url, albumData, {
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json'
        }
      });
      if (!isUpdate) {
        // For create, refresh to get the new album with _id
        fetchAlbums();
      }
      message.success(isUpdate ? 'Cập nhật album thành công' : 'Tạo album thành công');
      return response.data;
    } catch (err) {
      console.error('Error saving album:', err);
      if (err.response && err.response.status === 409) {
        message.warning(err.response.data.error);
        throw err; // Re-throw to prevent localStorage fallback
      }
      // Fallback to localStorage
      if (!isUpdate) {
        const newAlbum = { ...albumData, id: Date.now(), createdAt: new Date() };
        const updatedAlbums = [...albums, newAlbum];
        localStorage.setItem('albums', JSON.stringify(updatedAlbums));
        setAlbums(updatedAlbums);
        message.success('Tạo album thành công (local)');
      } else {
        // For update, update localStorage
        const updatedAlbums = albums.map(album =>
          album.id === albumData.id ? { ...album, ...albumData, updatedAt: new Date() } : album
        );
        localStorage.setItem('albums', JSON.stringify(updatedAlbums));
        setAlbums(updatedAlbums);
        message.success('Cập nhật album thành công (local)');
      }
      throw err;
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const calculateTotalDuration = () => {
    let total = 0;
    selectedSongs.forEach(songId => {
      // Try to get from selectedSongsData first (for edit mode), then from musicFiles
      const song = selectedSongsData[songId] || musicFiles.find(m => m._id === songId);
      if (song && song.duration) {
        total += song.duration;
      }
    });
    return total;
  };

  const formatTotalDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0 phút 0 giây';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
      return `${hours} giờ ${mins} phút ${secs} giây`;
    }
    return `${mins} phút ${secs} giây`;
  };

  const onFinish = async (values) => {
    const file = selectedImageFile;
    if (file) {
      const reader = new FileReader();
      reader.onload = async () => {
        const imageData = reader.result;
        const album = {
          id: editing ? editing.id : Date.now().toString(),
          name: values.name,
          color: values.color || '#00D3E5',
          imageData,
          notes: values.notes || '',
          songs: selectedSongs || []
        };

        try {
          await saveToBackend(album, !!editing);
          handleCancelAlbum();
        } catch (err) {
          // Error handled in saveToBackend
        }
      };
      reader.readAsDataURL(file);
    } else {
      const album = {
        id: editing ? editing.id : Date.now().toString(),
        name: values.name,
        color: values.color || '#00D3E5',
        imageData: editing?.imageData || currentAlbumImage || null,
        notes: values.notes || '',
        songs: selectedSongs || []
      };

      try {
        await saveToBackend(album, !!editing);
        handleCancelAlbum();
      } catch (err) {
        // Error handled in saveToBackend
      }
    }
  };

  const handleEdit = (album) => {
    setEditing(album);
    form.setFieldsValue({
      name: album.name,
      color: album.color,
      notes: album.notes
    });
    
    // Store both ID and song data for display
    const songIds = album.songs?.map(song => song._id) || [];
    setSelectedSongs(songIds);
    
    // Create a map of song data for quick lookup
    const songDataMap = {};
    (album.songs || []).forEach(song => {
      const id = song._id || song;
      songDataMap[id] = song;
    });
    setSelectedSongsData(songDataMap);
    
    setCurrentAlbumImage(album.imageData || null);
    setShowAlbumDrawer(true);
  };

  const handleDelete = async (id) => {
    Modal.confirm({
      title: 'Xác nhận xóa',
      content: 'Bạn chắc chắn muốn xóa album này?',
      okText: 'Xóa',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          await axios.delete(`${API_URL}/admin/albums/${id}`, {
            headers: {
              'Authorization': getAuthHeader()
            }
          });
          message.success('Đã xóa album');
          fetchAlbums(); // Refresh the list
        } catch (err) {
          console.error('Error deleting album:', err);
          // Fallback to local delete
          const updatedAlbums = albums.filter(album => album.id !== id);
          localStorage.setItem('albums', JSON.stringify(updatedAlbums));
          setAlbums(updatedAlbums);
          message.success('Đã xóa album (local)');
        }
      }
    });
  };

  const handleCancelAlbum = () => {
    setShowAlbumDrawer(false);
    setEditing(null);
    setSelectedSongs([]);
    setSelectedSongsData({});
    setSelectedImageFile(null);
    setCurrentAlbumImage(null);
    form.resetFields();
  };

  const handleImageChange = async (file) => {
    setSelectedImageFile(file);
    return false;
  };

  const filteredAccounts = accounts.filter(account =>
    account.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (account.restaurantName && account.restaurantName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="dashboard-root">
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', paddingTop: '30px', height: '100vh'}}>
          <div className="container">
            <img src={loadinggif} alt="Loading..." style={{ width: '50px', height: '50px', objectFit: 'cover' }} />
          </div>
        </div>
      ) : (
        <>
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
              <div className="header-title">Quản Lý Album Phát</div>
              <div className="header-sub">Music for Business</div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="dashboard-main">
          <div style={{ display: 'flex', gap: '12px' }}>
            <Button
              type="primary"
              size="middle"
              icon={<PlusOutlined />}
              onClick={() => {
                setShowAlbumDrawer(true);
                setEditing(null);
                setSelectedSongs([]);
                setSelectedImageFile(null);
                setCurrentAlbumImage(null);
                form.resetFields();
              }}
            >
              Tạo Album Mới
            </Button>

            <Button
              size="middle"
              onClick={() => setShowPermissionModal(true)}
            >
              Phân quyền phát tự do
            </Button>
          </div>

          <Row gutter={[16, 16]}>
            {albums.length === 0 ? (
              <Col xs={24}>
                <Alert message="Chưa có album nào. Vui lòng tạo album mới." type="info" />
              </Col>
            ) : (
              albums.map(album => (
                <Col xs={24} sm={12} md={8} lg={6} key={album.id}>
                  <div className="album-card">
                    <div className="album-card-body">
                      <div className="album-card-image">
                        {album.imageData ? (
                          <img src={album.imageData} alt={album.name} />
                        ) : (
                          <div />
                        )}
                      </div>
                      <div className="album-card-content">
                        <div className="album-card-title" style={{ color: album.color || '#fff' }}>{album.name}</div>
                        <div className="album-card-notes">{album.notes}</div>
                        <div className="album-card-songs">
                          {album.songs?.length || 0} bài
                        </div>
                      </div>
                    </div>
                    <div className="album-card-actions">
                      <Button key="edit" type="primary" size="small" icon={<EditOutlined />} onClick={() => handleEdit(album)}>
                        Sửa
                      </Button>
                      <Button key="delete" type="primary" danger size="small" icon={<DeleteOutlined />} onClick={() => handleDelete(album.id)}>
                        Xóa
                      </Button>
                    </div>
                  </div>
                </Col>
              ))
            )}
          </Row>
        </div>
      </div>

      {/* Drawer Form - Album */}
      <Drawer
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span>{editing ? 'Chỉnh Sửa Album' : 'Tạo Album Mới'}</span>
            <Space style={{ gap: '12px' }}>
              <Button onClick={handleCancelAlbum} size="middle">
                Hủy
              </Button>
              <Button
                type="primary"
                onClick={() => form.submit()}
                size="middle"
              >
                {editing ? 'Cập Nhật' : 'Tạo Mới'}
              </Button>
            </Space>
          </div>
        }
        onClose={handleCancelAlbum}
        open={showAlbumDrawer}
        width={600}
        className="dashboard-drawer"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
        >
          {/* Image Upload */}
          <Form.Item label="Ảnh Album (Tùy Chọn)" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <Upload.Dragger
                  beforeUpload={handleImageChange}
                  accept="image/*"
                  maxCount={1}
                  fileList={[]}
                  style={{
                    background: 'rgba(13, 110, 253, 0.05)',
                    borderColor: 'rgba(0, 211, 229, 0.3)',
                    borderRadius: '4px'
                  }}
                >
                  <p style={{ fontSize: '16px', marginBottom: '8px' }}>
                    <UploadOutlined style={{ color: '#00d3e5', fontSize: '32px' }} />
                  </p>
                  <p style={{ margin: 0, color: '#dbe7f7', fontWeight: 500 }}>
                    Kéo thả ảnh vào đây hoặc bấm để chọn
                  </p>
                  <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#999' }}>
                    Hỗ trợ PNG, JPG, GIF
                  </p>
                </Upload.Dragger>
              </div>
              {(selectedImageFile || currentAlbumImage) && (
                <div style={{ width: '120px', flexShrink: 0 }}>
                  <img
                    src={
                      selectedImageFile
                        ? URL.createObjectURL(selectedImageFile)
                        : currentAlbumImage
                    }
                    alt="Album"
                    style={{
                      width: '120px',
                      height: '120px',
                      borderRadius: '4px',
                      objectFit: 'cover',
                      border: '2px solid rgba(0, 211, 229, 0.3)'
                    }}
                  />
                </div>
              )}
            </div>
          </Form.Item>

          {/* Name */}
          <Form.Item
            label="Tên Album"
            name="name"
            rules={[{ required: true, message: 'Vui lòng nhập tên album' }]}
          >
            <Input placeholder="VD: Nhạc UK hay nhất" size="middle" />
          </Form.Item>

          {/* Color */}
          {/* <Form.Item
            label="Màu chủ đạo"
            name="color"
          >
            <Input type="color" />
          </Form.Item> */}

          {/* Notes */}
          <Form.Item
            label="Ghi chú"
            name="notes"
          >
            <TextArea rows={2} placeholder="Mô tả ngắn về album..." />
          </Form.Item>

          {/* Song Selection */}
          <Form.Item label="Chọn Bài Hát" style={{ marginBottom: '16px' }}>
            <div style={{ marginBottom: '16px' }}>
              <Button
                type="primary"
                size="middle"
                onClick={() => setShowSongsDrawer(true)}
                style={{ width: '100%' }}
              >
                Chọn Bài Hát ({selectedSongs.length} bài)
              </Button>
            </div>
            {selectedSongs.length > 0 && (
              <div style={{ 
                backgroundColor: 'rgba(0, 211, 229, 0.1)', 
                padding: '12px', 
                borderRadius: '4px',
                marginBottom: '16px'
              }}>
                <p style={{ marginBottom: '8px', fontWeight: 600, color: '#dbe7f7' }}>
                  Tổng: {formatTotalDuration(calculateTotalDuration())} ({selectedSongs.length} bài)
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {selectedSongs.map(songId => {
                    // Try to get from selectedSongsData first (for edit mode), then from musicFiles
                    const song = selectedSongsData[songId] || musicFiles.find(m => m._id === songId);
                    return (
                      <Tag 
                        key={songId} 
                        closable 
                        onClose={() => {
                          setSelectedSongs(selectedSongs.filter(id => id !== songId));
                          const newData = { ...selectedSongsData };
                          delete newData[songId];
                          setSelectedSongsData(newData);
                        }}
                      >
                        {song?.title || 'Unknown'}
                      </Tag>
                    );
                  })}
                </div>
              </div>
            )}
          </Form.Item>
        </Form>

        {/* Nested Songs Selection Drawer */}
        <Drawer
          title="Chọn Bài Hát"
          onClose={() => {
            setShowSongsDrawer(false);
            setMusicCurrentPage(1);
            setMusicSearchTerm("");
          }}
          open={showSongsDrawer}
          width={500}
          className="dashboard-drawer"
          style={{ position: 'absolute' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
            {/* Search input for music */}
            <Input
              placeholder="Tìm kiếm bài hát..."
              allowClear
              value={musicSearchTerm}
              onChange={(e) => {
                setMusicSearchTerm(e.target.value);
                setMusicCurrentPage(1);
                fetchMusicFiles(1, e.target.value);
              }}
            />
            
            {musicFiles.length === 0 && !loadingMoreMusic ? (
              <Alert message="Không có bài hát nào" type="info" />
            ) : (
              <div 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '12px', 
                  maxHeight: 'calc(70vh - 100px)', 
                  overflowY: 'auto',
                  paddingRight: '8px'
                }}
                onScroll={(e) => {
                  const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
                  // Trigger load more when scrolled near bottom
                  if (scrollHeight - scrollTop <= clientHeight + 50 && !loadingMoreMusic && musicCurrentPage < musicPagination.totalPages) {
                    setMusicCurrentPage(prev => prev + 1);
                    fetchMusicFiles(musicCurrentPage + 1, musicSearchTerm);
                  }
                }}
              >
                {musicFiles.map((song) => (
                  <div
                    key={song._id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px',
                      backgroundColor: selectedSongs.includes(song._id) ? 'rgba(0, 211, 229, 0.15)' : 'rgba(13, 110, 253, 0.05)',
                      borderRadius: '4px',
                      border: '1px solid ' + (selectedSongs.includes(song._id) ? 'rgba(0, 211, 229, 0.5)' : 'rgba(0, 211, 229, 0.2)'),
                      cursor: 'pointer',
                      transition: 'all 0.3s ease'
                    }}
                    onClick={() => {
                      if (selectedSongs.includes(song._id)) {
                        setSelectedSongs(selectedSongs.filter(id => id !== song._id));
                        const newData = { ...selectedSongsData };
                        delete newData[song._id];
                        setSelectedSongsData(newData);
                      } else {
                        setSelectedSongs([...selectedSongs, song._id]);
                        setSelectedSongsData({
                          ...selectedSongsData,
                          [song._id]: song
                        });
                      }
                    }}
                  >
                    <Checkbox
                      checked={selectedSongs.includes(song._id)}
                      onChange={() => {}}
                      style={{ marginRight: '8px' }}
                    />
                    <img
                      src={song.imagePath ? `${API_URL.replace('/api', '')}${song.imagePath}` : defaultImage}
                      alt={song.title}
                      style={{
                        width: '50px',
                        height: '50px',
                        borderRadius: '4px',
                        objectFit: 'cover',
                        flexShrink: 0
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: '#dbe7f7', marginBottom: '4px' }}>
                        {song.title}
                      </div>
                      <div style={{ fontSize: '12px', color: '#999' }}>
                        {song.artist || 'N/A'}
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', color: '#00d3e5', fontWeight: 500 }}>
                      {formatDuration(song.duration)}
                    </div>
                  </div>
                ))}
                
                {loadingMoreMusic && (
                  <div style={{ textAlign: 'center', padding: '16px' }}>
                    <Spin size="small" />
                  </div>
                )}
                
                {musicCurrentPage >= musicPagination.totalPages && musicFiles.length > 0 && (
                  <div style={{ textAlign: 'center', padding: '12px', color: '#999', fontSize: '12px' }}>
                    Đã tải hết tất cả bài hát
                  </div>
                )}
              </div>
            )}
          </div>
        </Drawer>
      </Drawer>

      {/* Permission Drawer */}
      <Drawer
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span>Phân Quyền Phát Tự Do</span>
            <Space style={{ gap: '12px' }}>
              <Button onClick={() => setShowPermissionModal(false)} size="middle">
                Hủy
              </Button>
              <Button
                type="primary"
                onClick={() => {
                  savePermissions(freePlayPermissions);
                  setShowPermissionModal(false);
                }}
                size="middle"
              >
                Lưu
              </Button>
            </Space>
          </div>
        }
        onClose={() => {
          setShowPermissionModal(false);
          setSearchTerm('');
        }}
        open={showPermissionModal}
        width={600}
        className="dashboard-drawer"
      >
        <Form.Item style={{ marginBottom: '16px' }}>
          <Input
            placeholder="Tìm kiếm tài khoản..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="middle"
          />
        </Form.Item>
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {filteredAccounts.length === 0 ? (
            <Alert message={accounts.length === 0 ? "Không có tài khoản nào" : "Không tìm thấy tài khoản phù hợp"} type="info" />
          ) : (
            filteredAccounts.map(account => (
              <div key={account._id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0' }}>
                <Checkbox
                  checked={freePlayPermissions.includes(account._id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setFreePlayPermissions([...freePlayPermissions, account._id]);
                    } else {
                      setFreePlayPermissions(freePlayPermissions.filter(id => id !== account._id));
                    }
                  }}
                />
                <div>
                  <div style={{ fontWeight: 500, color: '#dbe7f7' }}>{account.username}</div>
                  <div style={{ fontSize: '12px', color: '#999' }}>{account.restaurantName || 'N/A'}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </Drawer>
        </>
      )}
    </div>
  );
};

export default AlbumManager;
