import { useState, useEffect, useCallback, useMemo } from "react";
import { Button, Form, Input, Modal, Space, Spin, Drawer, Tag, Alert, Checkbox, Upload, message, Table } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, ArrowLeftOutlined, UploadOutlined } from "@ant-design/icons";
import axios from "axios";
import { useApiUrl } from "../hooks/useApiUrl";
import "../styles/Dashboard.css";
import defaultImage from '../asset/disk.webp';

const PlaylistManager = ({ user, onBack }) => {
  const [musicFiles, setMusicFiles] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPlaylistDrawer, setShowPlaylistDrawer] = useState(false);
  const [editingPlaylistId, setEditingPlaylistId] = useState(null);
  const [playlistForm] = Form.useForm();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [, setAccounts] = useState([]);
  const [selectedSongs, setSelectedSongs] = useState([]);
  const [selectedSongsData, setSelectedSongsData] = useState({});
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [currentPlaylistImage, setCurrentPlaylistImage] = useState(null);
  const [showSongsDrawer, setShowSongsDrawer] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  // Music pagination state
  const [musicCurrentPage, setMusicCurrentPage] = useState(1);
  const [musicPagination, setMusicPagination] = useState({ total: 0, totalPages: 1 });
  const [loadingMoreMusic, setLoadingMoreMusic] = useState(false);
  const [musicSearchTerm, setMusicSearchTerm] = useState("");
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

  // Format duration
  const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Format total duration
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

  // Calculate total duration of selected songs
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

  // Fetch music files with pagination
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
          "Authorization": getAuthHeader()
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
      console.error("Error fetching music:", err);
    } finally {
      setLoadingMoreMusic(false);
    }
  }, [API_URL, getAuthHeader]);

  // Fetch accounts
  const fetchAccounts = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/admin/accounts`, {
        headers: {
          "Authorization": getAuthHeader()
        }
      });
      setAccounts(response.data.data || []);
    } catch (err) {
      console.error(err);
    }
  }, [API_URL, getAuthHeader]);

  // Fetch playlists
  const fetchPlaylists = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/admin/playlists`, {
        params: {
          search: searchTerm,
          page: currentPage
        },
        headers: {
          "Authorization": getAuthHeader()
        }
      });
      setPlaylists(response.data.data || []);
      if (response.data.pagination) {
        setPagination(response.data.pagination);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [API_URL, getAuthHeader, searchTerm, currentPage]);

  useEffect(() => {
    fetchMusicFiles(1, musicSearchTerm);
    fetchAccounts();
    fetchPlaylists();
  }, [fetchMusicFiles, fetchAccounts, fetchPlaylists, musicSearchTerm]);

  // Load music data when songs drawer opens
  useEffect(() => {
    if (showSongsDrawer && musicFiles.length === 0) {
      fetchMusicFiles(1, "");
    }
  }, [showSongsDrawer, musicFiles.length, fetchMusicFiles]);

  const handlePlaylistSubmit = async (values) => {
    setLoading(true);

    try {
      // Validate required fields
      if (!values.name || !values.name.trim()) {
        message.error("Vui lòng nhập tên playlist");
        setLoading(false);
        return;
      }

      if (selectedSongs.length === 0) {
        message.error("Vui lòng chọn ít nhất một bài hát");
        setLoading(false);
        return;
      }

      const url = editingPlaylistId
        ? `${API_URL}/admin/playlists/${editingPlaylistId}`
        : `${API_URL}/admin/playlists`;

      const method = editingPlaylistId ? "put" : "post";

      // Ensure songs is array of valid IDs
      const songsArray = Array.isArray(selectedSongs) ? selectedSongs : [];
      
      const payload = {
        name: values.name.trim(),
        songs: songsArray
      };

      console.log("Payload being sent:", payload);
      console.log("Selected songs:", selectedSongs);
      console.log("Music files count:", musicFiles.length);

      const response = await axios[method](url, payload, {
        headers: {
          "Authorization": getAuthHeader(),
          "Content-Type": "application/json"
        }
      });

      console.log("Response:", response);

      const playlistId = editingPlaylistId || response.data.data._id;

      // Upload image if selected and it's a NEW playlist (not editing)
      // For editing, image is already uploaded in handleImageChange
      if (selectedImageFile && !editingPlaylistId) {
        const formData = new FormData();
        formData.append("file", selectedImageFile);

        await axios.post(`${API_URL}/admin/playlists/${playlistId}/image`, formData, {
          headers: {
            "Authorization": getAuthHeader(),
            "Content-Type": "multipart/form-data"
          }
        });
      }

      // Reset all state
      playlistForm.resetFields();
      setShowPlaylistDrawer(false);
      setEditingPlaylistId(null);
      setSelectedImageFile(null);
      setCurrentPlaylistImage(null);
      setSelectedSongs([]); // Reset selected songs
      setSelectedSongsData({});

      message.success(editingPlaylistId ? "Cập nhật danh mục thành công" : "Tạo danh mục thành công");
      await fetchPlaylists();
    } catch (err) {
      console.error("Error creating/updating playlist:", err);
      const errorMessage = err.response?.data?.error || err.response?.data?.message || err.message || "Có lỗi xảy ra";
      console.error("Full error response:", err.response?.data);
      if (err.response && err.response.status === 409) {
        message.warning(errorMessage);
      } else {
        message.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePlaylist = (id) => {
    Modal.confirm({
      title: "Xác nhận xóa",
      content: "Bạn chắc chắn muốn xóa danh mục này?",
      okText: "Xóa",
      okType: "danger",
      cancelText: "Hủy",
      onOk: async () => {
        setLoading(true);
        try {
          await axios.delete(`${API_URL}/admin/playlists/${id}`, {
            headers: {
              "Authorization": getAuthHeader()
            }
          });
          setPlaylists(playlists.filter(p => p._id !== id));
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleEditPlaylist = (playlist) => {
    playlistForm.setFieldsValue({
      name: playlist.name,
      songs: playlist.songs.map(s => s._id || s)
    });
    
    // Store both ID and song data for display
    const songIds = playlist.songs.map(s => s._id || s);
    setSelectedSongs(songIds);
    
    // Create a map of song data for quick lookup
    const songDataMap = {};
    (playlist.songs || []).forEach(song => {
      const id = song._id || song;
      songDataMap[id] = song;
    });
    setSelectedSongsData(songDataMap);
    
    setCurrentPlaylistImage(playlist.imagePath || null);
    setEditingPlaylistId(playlist._id);
    setShowPlaylistDrawer(true);
  };

  const handleCancelPlaylist = () => {
    setShowPlaylistDrawer(false);
    setEditingPlaylistId(null);
    setSelectedSongs([]);
    setSelectedSongsData({});
    setSelectedImageFile(null);
    setCurrentPlaylistImage(null);
    playlistForm.resetFields();
  };

  const handleImageChange = async (file) => {
    setSelectedImageFile(file);
    
    // If editing, upload image immediately
    if (editingPlaylistId) {
      setUploadingImage(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        
        await axios.post(`${API_URL}/admin/playlists/${editingPlaylistId}/image`, formData, {
          headers: {
            "Authorization": getAuthHeader(),
            "Content-Type": "multipart/form-data"
          }
        });
        
        message.success("Cập nhật ảnh thành công");
        // Set current image to preview the uploaded image
        setCurrentPlaylistImage(URL.createObjectURL(file));
      } catch (err) {
        console.error("Error uploading image:", err);
        message.error("Lỗi cập nhật ảnh");
        setSelectedImageFile(null);
      } finally {
        setUploadingImage(false);
      }
    }
    
    return false; // Prevent default upload
  };

  const handleSearch = (value) => {
    setSearchTerm(value);
    setCurrentPage(1); // Reset to first page on search
  };

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
              <div className="header-title">Danh Mục Phát</div>
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
                setShowPlaylistDrawer(true);
                setEditingPlaylistId(null);
                playlistForm.resetFields();
              }}
            >
              Tạo Danh Mục Mới
            </Button>
          </div>

          <div className="dashboard-table-container">
            <h2 style={{ marginBottom: 20, fontSize: 18, fontWeight: 600 }}>
              Danh Sách Danh Mục Phát
            </h2>
            <div style={{ marginBottom: 16 }}>
              <Input
                placeholder="Tìm kiếm theo tên danh mục hoặc ngày phát..."
                allowClear
                onSearch={handleSearch}
                onChange={(e) => handleSearch(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <Spin spinning={loading}>
              {playlists.length === 0 ? (
                <Alert message="Chưa có danh mục nào" type="info" />
              ) : (
                <Table
                  dataSource={playlists}
                  rowKey="_id"
                  pagination={{
                    current: currentPage,
                    pageSize: 10,
                    total: pagination.total,
                    onChange: (page) => setCurrentPage(page)
                  }}
                  columns={[
                    {
                      title: 'Tên Danh Mục',
                      dataIndex: 'name',
                      key: 'name'
                    },
                    {
                      title: 'Số Bài Hát',
                      dataIndex: 'songs',
                      key: 'songs',
                      render: (songs) => songs?.length || 0
                    },
                    {
                      title: 'Hành Động',
                      key: 'actions',
                      render: (_, playlist) => (
                        <Space>
                          <Button
                            type="primary"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => handleEditPlaylist(playlist)}
                          >
                            Sửa
                          </Button>
                          <Button
                            danger
                            size="small"
                            type="primary"
                            icon={<DeleteOutlined />}
                            onClick={() => handleDeletePlaylist(playlist._id)}
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

      {/* Drawer Form - Playlists */}
      <Drawer
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span>{editingPlaylistId ? "Chỉnh Sửa Playlist" : "Tạo Playlist Mới"}</span>
            <Space style={{ gap: '12px' }}>
              <Button onClick={handleCancelPlaylist} size="middle">
                Hủy
              </Button>
              <Button
                type="primary"
                onClick={() => playlistForm.submit()}
                loading={loading}
                size="middle"
              >
                {editingPlaylistId ? 'Cập Nhật' : 'Tạo Mới'}
              </Button>
            </Space>
          </div>
        }
        onClose={handleCancelPlaylist}
        open={showPlaylistDrawer}
        width={600}
        className="dashboard-drawer"
      >
        <Form
          form={playlistForm}
          layout="vertical"
          onFinish={handlePlaylistSubmit}
        >
          {/* Image Upload - At Top */}
          <Form.Item label="Ảnh Danh Mục (Tùy Chọn)" style={{ marginBottom: '16px' }}>
            <Spin spinning={uploadingImage}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }} className="fl-ms">
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
                      Hỗ trợ upload ảnh PNG, JPG, GIF
                    </p>
                  </Upload.Dragger>
                </div>
                {(selectedImageFile || currentPlaylistImage) && (
                  <div style={{ width: '140px', flexShrink: 0 }}>
                    <img
                      src={
                        selectedImageFile
                          ? URL.createObjectURL(selectedImageFile)
                          : `${API_URL.replace('/api', '')}${currentPlaylistImage}`
                      }
                      alt="Playlist"
                      style={{
                        width: '140px',
                        height: '140px',
                        borderRadius: '4px',
                        objectFit: 'cover',
                        border: '2px solid rgba(0, 211, 229, 0.3)'
                      }}
                    />
                  </div>
                )}
              </div>
            </Spin>
          </Form.Item>

          {/* Row 1: Name */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '16px' }}>
            <Form.Item
              label="Tên Playlist"
              name="name"
              rules={[
                { required: true, message: "Vui lòng nhập tên playlist" },
                { min: 1, message: "Tên playlist không được để trống" },
                { whitespace: false, message: "Tên playlist không được chỉ chứa khoảng trắng" },
                {
                  validator: (_, value) => {
                    if (!value || !value.trim()) {
                      return Promise.resolve();
                    }
                    const trimmedValue = value.trim();
                    const isDuplicate = playlists.some(p => 
                      p._id !== editingPlaylistId && 
                      p.name.toLowerCase() === trimmedValue.toLowerCase()
                    );
                    if (isDuplicate) {
                      return Promise.reject(new Error("Tên playlist đã tồn tại"));
                    }
                    return Promise.resolve();
                  }
                }
              ]}
              style={{ marginBottom: 0 }}
            >
              <Input placeholder="VD: Nhạc USUK 2024" size="middle" />
            </Form.Item>
          </div>

          {/* Songs Selection */}
          <Form.Item
            label="Chọn Bài Hát"
            style={{ marginBottom: '16px' }}
          >
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
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
};

export default PlaylistManager;

