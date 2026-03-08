import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Table, Button, Form, Input, Upload, Modal, Space, Spin, Drawer, Progress, message, Image, Alert, Select } from "antd";
import { EditOutlined, DeleteOutlined, ArrowLeftOutlined, UploadOutlined, PlayCircleOutlined } from "@ant-design/icons";
import axios from "axios";
import { useApiUrl } from "../hooks/useApiUrl";
import PreviewModal from "./PreviewModal";
import defaultImage from "../asset/disk.webp";
import "../styles/Dashboard.css";

const MusicManager = ({ user, onBack }) => {
  const [musicFiles, setMusicFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showMusicForm, setShowMusicForm] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [musicForm] = Form.useForm();
  const [editingMusicId, setEditingMusicId] = useState(null);
  const [uploadingMusic, setUploadingMusic] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewingMusic, setPreviewingMusic] = useState(null);
  const [previewingIndex, setPreviewingIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [soundcloudTracks, setSoundcloudTracks] = useState([]);
  const [scLoading, setScLoading] = useState(false);
  const [scUrlInput, setScUrlInput] = useState("");
  const [scDrawerOpen, setScDrawerOpen] = useState(false);
  const [sourceFilter, setSourceFilter] = useState('all'); // 'all' | 'uploaded' | 'soundcloud'
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

  // Fetch music files
  const fetchMusicFiles = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/admin/music`, {
        params: {
          search: searchTerm,
          page: currentPage
        },
        headers: {
          "Authorization": getAuthHeader()
        }
      });
      setMusicFiles(response.data.data || []);
      if (response.data.pagination) {
        setPagination(response.data.pagination);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [API_URL, getAuthHeader, searchTerm, currentPage]);

  // Fetch SoundCloud tracks (requires env var REACT_APP_SOUNDCLOUD_CLIENT_ID)
  // Load SoundCloud track by URL via oEmbed
  const loadSoundCloudByUrl = useCallback(async (url) => {
    if (!url) {
      message.warning('Vui lòng dán URL SoundCloud');
      return;
    }

    setScLoading(true);
    try {
      const auth = getAuthHeader();
      const res = await axios.get(`${API_URL}/admin/music/search-soundcloud`, {
        params: { url },
        headers: { Authorization: auth }
      });
      const tracks = (res.data.data || []).map(t => ({
        _id: `sc_${t.id}`,
        title: t.title,
        artist: t.artist || '',
        duration: t.duration || 0,
        size: 0,
        imagePath: t.thumbnail_url || t.artwork_url || null,
        createdAt: t.created_at || null,
        source: 'soundcloud',
        previewUrl: null,
        externalUrl: t.permalink_url || url
      }));
      setSoundcloudTracks(tracks);
      if (tracks.length === 0) {
        message.info('Không tìm thấy kết quả');
      }
    } catch (err) {
      console.error('SoundCloud load error', err);
      message.error('Lỗi tải SoundCloud - kiểm tra URL');
    } finally {
      setScLoading(false);
    }
  }, [API_URL, getAuthHeader]);

  const handleImportSoundCloud = useCallback(async (track) => {
    if (!track) return;
    try {
      const auth = getAuthHeader();
      const payload = {
        title: track.title,
        artist: track.artist,
        duration: track.duration,
        imagePath: track.imagePath,
        externalUrl: track.externalUrl,
        source: track.source || 'soundcloud'
      };
      await axios.post(`${API_URL}/admin/music/import-soundcloud`, payload, {
        headers: { Authorization: auth, 'Content-Type': 'application/json' }
      });
      message.success('Thêm bài hát thành công');
      setScDrawerOpen(false);
      setSoundcloudTracks([]);
      setScUrlInput("");
      await fetchMusicFiles();
    } catch (err) {
      console.error('Import SoundCloud error', err);
      message.error('Không thể thêm bài hát');
    }
  }, [API_URL, getAuthHeader, fetchMusicFiles]);

  useEffect(() => {
    fetchMusicFiles();
  }, [fetchMusicFiles]);

  const handleMusicUpload = async (file) => {
    setSelectedFile(file);
    setSelectedImageFile(null);
    setShowMusicForm(true);
    return false;
  };

  const handleMusicFormSubmit = async (values) => {
    if (!selectedFile && !editingMusicId) return;

    setUploadingMusic(true);
    setUploadProgress(0);
    try {
      if (editingMusicId) {
        // eslint-disable-next-line no-unused-vars
        const response = await axios.put(`${API_URL}/admin/music/${editingMusicId}`, {
          title: values.title,
          artist: values.artist
        }, {
          headers: {
            "Authorization": getAuthHeader()
          }
        });

        // Upload image if selected
        if (selectedImageFile) {
          setUploadProgress(50);
          const imageFormData = new FormData();
          imageFormData.append('file', selectedImageFile);
          
          try {
            await axios.post(`${API_URL}/admin/music/${editingMusicId}/image`, imageFormData, {
              headers: {
                "Authorization": getAuthHeader()
              },
              onUploadProgress: (progressEvent) => {
                const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                setUploadProgress(50 + Math.round(percentCompleted / 2));
              }
            });
            setUploadProgress(100);
            message.success('Cập nhật bài hát và ảnh thành công');
          } catch (imageErr) {
            console.error('Error uploading image:', imageErr);
            message.warning('Cập nhật ảnh không thành công, nhưng bài hát đã được cập nhật');
            setUploadProgress(100);
          }
        } else {
          setUploadProgress(100);
        }

        musicForm.resetFields();
        setShowMusicForm(false);
        setEditingMusicId(null);
        setSelectedFile(null);
        setSelectedImageFile(null);
        await fetchMusicFiles();
      } else {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('title', values.title);
        formData.append('artist', values.artist);

        // eslint-disable-next-line no-unused-vars
        const response = await axios.post(`${API_URL}/admin/music/upload`, formData, {
          headers: {
            "Authorization": getAuthHeader(),
            "Content-Type": "multipart/form-data"
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(selectedImageFile ? Math.round(percentCompleted * 0.7) : percentCompleted);
          }
        });

        // Upload image if selected
        if (selectedImageFile && response.data.data._id) {
          setUploadProgress(70);
          const imageFormData = new FormData();
          imageFormData.append('file', selectedImageFile);
          
          try {
            await axios.post(`${API_URL}/admin/music/${response.data.data._id}/image`, imageFormData, {
              headers: {
                "Authorization": getAuthHeader()
              },
              onUploadProgress: (progressEvent) => {
                const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                setUploadProgress(70 + Math.round(percentCompleted * 0.3));
              }
            });
            setUploadProgress(100);
            message.success('Tải bài hát và ảnh lên thành công');
          } catch (imageErr) {
            console.error('Error uploading image:', imageErr);
            setUploadProgress(100);
            message.warning('Tải ảnh không thành công, nhưng bài hát đã được tải lên');
          }
        } else {
          setUploadProgress(100);
          message.success('Tải bài hát lên thành công');
        }

        musicForm.resetFields();
        setShowMusicForm(false);
        setSelectedFile(null);
        setSelectedImageFile(null);
        await fetchMusicFiles();
      }
    } catch (err) {
      console.error(err);
      message.error('Lỗi tải tệp lên');
    } finally {
      setUploadingMusic(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteMusic = (id) => {
    Modal.confirm({
      title: "Xác nhận xóa",
      content: "Bạn chắc chắn muốn xóa bài hát này? Nó sẽ bị xóa khỏi tất cả các danh mục.",
      okText: "Xóa",
      okType: "danger",
      cancelText: "Hủy",
      onOk: async () => {
        setLoading(true);
        try {
          // Delete music file
          await axios.delete(`${API_URL}/admin/music/${id}`, {
            headers: {
              "Authorization": getAuthHeader()
            }
          });

          // Remove song from all playlists that contain it
          try {
            await axios.delete(`${API_URL}/admin/playlists/song/${id}`, {
              headers: {
                "Authorization": getAuthHeader()
              }
            });
          } catch (playlistErr) {
            console.log("Playlist cascade delete not available, skipping");
          }

          setMusicFiles(musicFiles.filter(m => m._id !== id));
          message.success('Xóa bài hát thành công');
        } catch (err) {
          console.error(err);
          message.error('Lỗi xóa bài hát');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleEditMusic = (music) => {
    musicForm.setFieldsValue({
      title: music.title,
      artist: music.artist
    });
    setEditingMusicId(music._id);
    setSelectedImageFile(null);
    setSelectedFile(null);
    setShowMusicForm(true);
  };

  const handleCancelMusicForm = () => {
    setShowMusicForm(false);
    setEditingMusicId(null);
    setSelectedFile(null);
    setSelectedImageFile(null);
    musicForm.resetFields();
  };

  const formatDuration = (seconds, record) => {
    // For SoundCloud tracks, show "-" since we don't have duration data
    if (record && record.source === 'soundcloud') return '-';
    
    // For uploaded tracks, show the actual duration or 0:00
    if (!seconds || isNaN(seconds)) return '0:00';
    
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handlePreviewNext = () => {
    if (previewingIndex < musicFiles.length - 1) {
      const nextIndex = previewingIndex + 1;
      setPreviewingIndex(nextIndex);
      setPreviewingMusic(musicFiles[nextIndex]);
    }
  };

  const handlePreviewPrev = () => {
    if (previewingIndex > 0) {
      const prevIndex = previewingIndex - 1;
      setPreviewingIndex(prevIndex);
      setPreviewingMusic(musicFiles[prevIndex]);
    }
  };

  const handleSearch = (value) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  // Combined list shown in table according to selected sourceFilter
  const displayedMusic = useMemo(() => {
    if (sourceFilter === 'uploaded') return musicFiles;
    if (sourceFilter === 'soundcloud') return soundcloudTracks;
    // 'all'
    return [...musicFiles, ...soundcloudTracks];
  }, [musicFiles, soundcloudTracks, sourceFilter]);

  const getImageUrl = (imagePath) => {
    if (!imagePath) return defaultImage;
    // If it's a full URL (from SoundCloud oEmbed), return as-is
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    // Otherwise, it's a relative path on our server
    const baseUrl = API_URL.replace('/api', '');
    return `${baseUrl}${imagePath}`;
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
              <div className="header-title">Quản Lý Nhạc</div>
              <div className="header-sub">Music for Business</div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="dashboard-main">
          <div>
            <Upload
              name="file"
              action={`${API_URL}/admin/music/upload`}
              headers={{ "Authorization": getAuthHeader() }}
              accept="audio/*,.mp3,.wav,.ogg,.webm,.m4a,.aac"
              maxCount={1}
              beforeUpload={handleMusicUpload}
            >
              <Button
                type="primary"
                size="middle"
                icon={<UploadOutlined />}
                loading={uploadingMusic}
              >
                Tải Nhạc Lên
              </Button>
            </Upload>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'center' }}>
            <Select value={sourceFilter} onChange={setSourceFilter} style={{ width: 160 }}>
              <Select.Option value="all">Tất cả</Select.Option>
              <Select.Option value="uploaded">Nhạc tải lên</Select.Option>
              <Select.Option value="soundcloud">SoundCloud</Select.Option>
            </Select>

            <Button onClick={() => {
              setScDrawerOpen(true);
              setSoundcloudTracks([]);
              setScUrlInput("");
            }}>
              Chọn từ SoundCloud
            </Button>
          </div>

          <div className="dashboard-table-container">
            <h2 style={{ marginBottom: 20, fontSize: 18, fontWeight: 600 }}>
              Danh Sách Nhạc
            </h2>
            {musicFiles.length === 0 && !loading ? (
              <Alert message="Chưa có danh mục nào" type="info" showIcon />
            ) : (
              <>
                <div style={{ marginBottom: 16 }}>
                  <Input
                    placeholder="Tìm kiếm theo tên bài hát hoặc ca sĩ..."
                    allowClear
                    onSearch={handleSearch}
                    onChange={(e) => handleSearch(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
                <Spin spinning={loading}>
                  <Table
                scroll={{ x: true }}
                style={{ width: '100%', whiteSpace: 'nowrap' }}
                size="small"
                columns={[
                  {
                    title: "#",
                    key: "index",
                    render: (_, __, index) => index + 1,
                    width: 50
                  },
                  {
                    title: "Tên Bài Hát",
                    dataIndex: "title",
                    key: "title",
                  },
                  {
                    title: "Ca Sĩ",
                    dataIndex: "artist",
                    key: "artist",
                  },
                  {
                    title: "Nguồn",
                    dataIndex: "source",
                    key: "source",
                    render: (src) => (src === 'soundcloud' ? 'SoundCloud' : src === 'spotify' ? 'Spotify' : 'Tải lên'),
                    width: 100
                  },
                  {
                    title: "Thời Gian",
                    dataIndex: "duration",
                    key: "duration",
                    render: (duration, record) => formatDuration(duration, record),
                    width: 80
                  },
                  {
                    title: "Kích Thước",
                    dataIndex: "size",
                    key: "size",
                    render: (size) => size ? `${(size / 1024 / 1024).toFixed(2)} MB` : 'N/A',
                    width: 100
                  },
                  {
                    title: "Hình Ảnh",
                    dataIndex: "imagePath",
                    key: "imagePath",
                    render: (imagePath) => {
                      const imageUrl = getImageUrl(imagePath);
                      return (
                        <Image
                          src={imageUrl}
                          alt="music-thumbnail"
                          width={50}
                          height={50}
                          preview
                          fallback={defaultImage}
                          style={{ objectFit: 'cover', borderRadius: 4 }}
                        />
                      );
                    },
                    width: 70
                  },
                  {
                    title: "Ngày Tải",
                    dataIndex: "createdAt",
                    key: "createdAt",
                    render: (date) => date ? new Date(date).toLocaleDateString("vi-VN") : 'N/A',
                    width: 100
                  },
                  {
                    title: "Hành Động",
                    key: "actions",
                    render: (_, record) => (
                      <Space size="small">
                        <Button
                          type="primary"
                          size="small"
                          icon={<PlayCircleOutlined />}
                          onClick={() => {
                            const index = displayedMusic.findIndex(m => m._id === record._id);
                            setPreviewingIndex(index);
                            setPreviewingMusic(record);
                            setPreviewModalOpen(true);
                          }}
                        >
                          Nghe
                        </Button>
                        {record.source !== 'soundcloud' && record.source !== 'spotify' && (
                          <>
                            <Button
                              type="primary"
                              size="small"
                              icon={<EditOutlined />}
                              onClick={() => handleEditMusic(record)}
                            >
                              Sửa
                            </Button>
                            <Button
                              danger
                              size="small"
                              type='primary'
                              icon={<DeleteOutlined />}
                              onClick={() => handleDeleteMusic(record._id)}
                            >
                              Xóa
                            </Button>
                          </>
                        )}
                      </Space>
                    ),
                    width: 150
                  }
                ]}
                dataSource={displayedMusic}
                rowKey="_id"
                pagination={{
                  pageSize: 5,
                  current: currentPage,
                  total: pagination.total,
                  totalPages: pagination.totalPages,
                  onChange: (page) => setCurrentPage(page)
                }}
                locale={{ emptyText: "Chưa có bài hát nào" }}
              />
            </Spin>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Drawer Form - Music Upload Details */}
      <Drawer
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span>{editingMusicId ? "Chỉnh Sửa Bài Hát" : "Nhập Thông Tin Bài Hát"}</span>
            <div style={{ display: 'flex', gap: '12px' }}>
              <Button onClick={handleCancelMusicForm}>
                Hủy
              </Button>
              <Button
                type="primary"
                onClick={() => musicForm.submit()}
                loading={uploadingMusic}
              >
                {editingMusicId ? "Cập Nhật" : "Tải Lên"}
              </Button>
            </div>
          </div>
        }
        onClose={handleCancelMusicForm}
        open={showMusicForm}
        width={680}
        className="dashboard-drawer"
      >
        <Form
          form={musicForm}
          layout="vertical"
          onFinish={handleMusicFormSubmit}
        >
          <Form.Item
            label="Tên Bài Hát"
            name="title"
            rules={[{ required: true, message: "Vui lòng nhập tên bài hát" }]}
          >
            <Input placeholder="VD: Yes, and?" />
          </Form.Item>

          <Form.Item
            label="Ca Sĩ"
            name="artist"
            rules={[{ required: true, message: "Vui lòng nhập tên ca sĩ" }]}
          >
            <Input placeholder="VD: Ariana Grande" />
          </Form.Item>

          <Form.Item label="Ảnh Đại Diện (Tùy Chọn)">
            <Upload
              name="image"
              accept="image/*"
              maxCount={1}
              beforeUpload={(file) => {
                setSelectedImageFile(file);
                return false;
              }}
              onRemove={() => {
                setSelectedImageFile(null);
              }}
              fileList={selectedImageFile ? [selectedImageFile] : []}
            >
              <Button icon={<UploadOutlined />} type='primary'>
                Chọn Ảnh
              </Button>
            </Upload>
          </Form.Item>

          {uploadingMusic && uploadProgress > 0 && (
            <Form.Item label="Tiến độ tải lên" labelCol={{ style: { color: '#fff' } }}>
              <Progress percent={uploadProgress} status={uploadProgress === 100 ? 'success' : 'active'} />
            </Form.Item>
          )}
        </Form>
      </Drawer>

      {/* SoundCloud Selection Drawer */}
      <Drawer
        title="Chọn từ SoundCloud"
        onClose={() => {
          setScDrawerOpen(false);
          setScUrlInput("");
          setSoundcloudTracks([]);
        }}
        open={scDrawerOpen}
        width={600}
      >
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <Input
            placeholder="Dán URL SoundCloud (ví dụ: https://soundcloud.com/.../...)"
            value={scUrlInput}
            onChange={(e) => setScUrlInput(e.target.value)}
            onPressEnter={() => loadSoundCloudByUrl(scUrlInput)}
          />
          <Button type="primary" onClick={() => loadSoundCloudByUrl(scUrlInput)} loading={scLoading}>Tải</Button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {scLoading ? (
            <div style={{ textAlign: 'center' }}><Spin /></div>
          ) : soundcloudTracks.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#93a6c4' }}>Không có kết quả</div>
          ) : (
            soundcloudTracks.map((t) => (
              <div key={t._id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 8, borderBottom: '1px solid #eee' }}>
                <Image 
                  src={t.imagePath || defaultImage} 
                  width={56} 
                  height={56} 
                  preview={false} 
                  fallback={defaultImage}
                  style={{ objectFit: 'cover', borderRadius: 4 }} 
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{t.title}</div>
                  <div style={{ color: '#666', fontSize: '12px' }}>{t.artist || 'Unknown Artist'}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button size="small" onClick={() => window.open(t.externalUrl, '_blank')}>Mở</Button>
                  <Button type="primary" size="small" onClick={() => handleImportSoundCloud(t)}>Thêm</Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Drawer>

      {/* Preview Modal */}
      <PreviewModal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        music={previewingMusic}
        musicList={musicFiles}
        currentMusicIndex={previewingIndex}
        onNext={handlePreviewNext}
        onPrev={handlePreviewPrev}
      />
    </div>
  );
};

export default MusicManager;
