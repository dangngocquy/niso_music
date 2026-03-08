import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Popover, Button, Space, message, Slider, Tooltip } from 'antd';
import { SettingOutlined, LogoutOutlined, StepBackwardOutlined, StepForwardOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import defaultImage from '../asset/disk.webp';
import { IoVolumeHighOutline, IoVolumeMuteOutline, IoMusicalNotesOutline } from "react-icons/io5";
import { FaPause, FaPlay } from "react-icons/fa";
import { BsMusicPlayer } from "react-icons/bs";
import { FaShuffle, FaRepeat } from "react-icons/fa6";
import adminLogo from '../asset/Logo.svg';
import ListMusic from '../asset/album.png';
import '../styles/Playfreely.css';
import { useApiUrl } from '../hooks/useApiUrl';
import dayjs from 'dayjs';
import opac from '../asset/opac.gif';
import Playfreely from './Playfreely';
import { MdBlock } from "react-icons/md";
import socket from '../socket';

const Bgm = ({ users, onLogout }) => {
  const API_URL = useApiUrl();
  const user = users; // Use prop instead of localStorage

  const [freePlayPermissions, setFreePlayPermissions] = useState([]);

  const hasFreePlayPermission = user && freePlayPermissions.includes(user._id);

  // ────────────────────────────────────────────────
  // STATES
  // ────────────────────────────────────────────────
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('schedule');
  const [contentOpacity, setContentOpacity] = useState(0);
  const [volume, setVolume] = useState(100);
  const [prevVolume, setPrevVolume] = useState(100);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [viewSchedule, setViewSchedule] = useState(false);

  const [playlists, setPlaylists] = useState([]);
  const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState(0);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSongTime, setCurrentSongTime] = useState(0);
  const [songDuration, setDuration] = useState(0);
  const [repeatMode, setRepeatMode] = useState('off');
  const [isShuffleOn, setIsShuffleOn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [freePlayMode, setFreePlayMode] = useState(false);
  const [freePlaySongs, setFreePlaySongs] = useState([]);
  const [freePlayCurrentIndex, setFreePlayCurrentIndex] = useState(0);
  const [freePlayAlbumName, setFreePlayAlbumName] = useState('');
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [songPositions, setSongPositions] = useState({}); // Store currentTime for each song
  const [pipActive, setPipActive] = useState(false);

  const navigate = useNavigate();
  const audioRef = useRef(null);
  const playlistsFetchedRef = useRef(false);
  const currentSongRef = useRef(null);
  const currentSongIndexRef = useRef(0);
  const saveTimeoutRef = useRef(null);

  // ────────────────────────────────────────────────
  // DERIVED VALUES
  // ────────────────────────────────────────────────
  const currentPlaylist = playlists[currentPlaylistIndex];

  const sortedPlaylistSongs = useMemo(() => {
    return currentPlaylist?.songs
      ? [...currentPlaylist.songs].sort((a, b) => {
          const aDate = a.createdAt ? new Date(a.createdAt).getTime() : -Infinity;
          const bDate = b.createdAt ? new Date(b.createdAt).getTime() : -Infinity;
          return bDate - aDate;
        })
      : [];
  }, [currentPlaylist?.songs]);

  const currentSong = freePlayMode
    ? freePlaySongs[freePlayCurrentIndex]
    : sortedPlaylistSongs[currentSongIndex];

  const fetchPermissions = useCallback(async () => {
    try {
      const auth = btoa(`${process.env.REACT_APP_BASIC_AUTH_USERNAME}:${process.env.REACT_APP_BASIC_AUTH_PASSWORD}`);
      const response = await fetch(`${API_URL}/permissions/freeplay`, {
        headers: { 'Authorization': `Basic ${auth}` }
      });
      const data = await response.json();
      if (data.success) {
        console.log('Fetched permissions:', data.permissions);
        setFreePlayPermissions(data.permissions);
      }
    } catch (err) {
      console.error('Error fetching permissions:', err);
    }
  }, [API_URL]);

  const fetchPlaylists = useCallback(async () => {
    if (playlistsFetchedRef.current) return;
    if (!user || !user._id) return;

    setScheduleLoading(true);

    try {
      playlistsFetchedRef.current = true;
      const auth = btoa(`${process.env.REACT_APP_BASIC_AUTH_USERNAME}:${process.env.REACT_APP_BASIC_AUTH_PASSWORD}`);
      const response = await fetch(`${API_URL}/admin/schedules/account/${user._id}`, {
        headers: { 'Authorization': `Basic ${auth}` }
      });
      const data = await response.json();

      if (data.data && data.data.length > 0) {
        const allPlaylists = [];
        const today = new Date();
        const dayIndex = today.getDay();
        const vietnameseDays = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
        const todayDayOfWeek = vietnameseDays[dayIndex];
        const todayDateStr = dayjs().format('YYYY-MM-DD');

        data.data.forEach(schedule => {
          let shouldInclude = false;
          if (schedule.recurrence === 'one-time') {
            const scheduleDate = dayjs(schedule.date).format('YYYY-MM-DD');
            shouldInclude = scheduleDate === todayDateStr;
          } else if (schedule.recurrence === 'weekly') {
            // Handle schedule.day as both array and string
            const scheduleDays = Array.isArray(schedule.day) ? schedule.day : [schedule.day];
            shouldInclude = scheduleDays.includes(todayDayOfWeek);
          } else {
            // default to weekly
            const scheduleDays = Array.isArray(schedule.day) ? schedule.day : [schedule.day];
            shouldInclude = scheduleDays.includes(todayDayOfWeek);
          }

          if (shouldInclude) {
            if (Array.isArray(schedule.playlists)) {
              allPlaylists.push(...schedule.playlists.map(p => ({
                ...p,
                startTime: schedule.startTime,
                endTime: schedule.endTime,
                day: schedule.day,
                date: schedule.date,
                recurrence: schedule.recurrence
              })));
            } else if (schedule.playlists) {
              allPlaylists.push({
                ...schedule.playlists,
                startTime: schedule.startTime,
                endTime: schedule.endTime,
                day: schedule.day,
                date: schedule.date,
                recurrence: schedule.recurrence
              });
            }
          }
        });

        const uniquePlaylists = Array.from(new Map(
          allPlaylists.map(p => [p._id, p])
        ).values());

        uniquePlaylists.sort((a, b) => a.startTime.localeCompare(b.startTime));

        setPlaylists(uniquePlaylists);

        // Load last selected playlist
        try {
          const lastSelectedResponse = await fetch(`${API_URL}/admin/user-playlist-logs/last-selected/${user._id}`, {
            headers: { 'Authorization': `Basic ${auth}` }
          });
          const lastSelectedData = await lastSelectedResponse.json();

          if (lastSelectedData.data && lastSelectedData.data.playlistId) {
            const idx = uniquePlaylists.findIndex(p => p._id === lastSelectedData.data.playlistId);
            if (idx !== -1) {
              setCurrentPlaylistIndex(idx);
            }
          }
        } catch (err) {
          // silent fail
        }

        setCurrentSongIndex(0);
      }
    } catch (error) {
      console.error('Error fetching schedules:', error);
      message.error('Không thể tải danh sách phát');
      playlistsFetchedRef.current = false;
    } finally {
      setScheduleLoading(false);
    }
  }, [API_URL, user]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  useEffect(() => {
    console.log('hasFreePlayPermission changed:', hasFreePlayPermission, 'freePlayPermissions:', freePlayPermissions, 'user._id:', user?._id);
    if (!hasFreePlayPermission && freePlayMode) {
      // Nếu mất quyền và đang ở chế độ phát tự do, chuyển về chế độ lịch
      setFreePlayMode(false);
      setActiveTab('schedule');
    }
  }, [hasFreePlayPermission, freePlayMode, user, freePlayPermissions]);

  useEffect(() => {
    const timer = setTimeout(() => setContentOpacity(1), 150);
    return () => clearTimeout(timer);
  }, []);

  const isCurrentTimeInSchedule = useCallback(() => {
    if (!currentPlaylist || !currentPlaylist.startTime || !currentPlaylist.endTime) return false;

    const now = new Date();
    const currentHour = String(now.getHours()).padStart(2, '0');
    const currentMinute = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHour}:${currentMinute}`;

    const start = currentPlaylist.startTime;
    const end = currentPlaylist.endTime;

    return start < end
      ? currentTimeStr >= start && currentTimeStr < end
      : currentTimeStr >= start || currentTimeStr < end;
  }, [currentPlaylist]);

  const savePlaylistSelection = useCallback(async (playlist) => {
    if (!user?._id || !playlist?._id) return;

    try {
      const auth = btoa(`${process.env.REACT_APP_BASIC_AUTH_USERNAME}:${process.env.REACT_APP_BASIC_AUTH_PASSWORD}`);
      const logData = {
        accountId: user._id,
        playlistId: playlist._id,
        playlistName: playlist.name,
        isPlaying,
        timestamp: new Date().toISOString(),
        ...(playlist.day && { scheduleDay: playlist.day }),
        ...(playlist.startTime && { scheduleStartTime: playlist.startTime }),
        ...(playlist.endTime && { scheduleEndTime: playlist.endTime }),
        ...(currentSongRef.current && {
          currentSongId: currentSongRef.current._id,
          currentSongTitle: currentSongRef.current.title,
          currentSongArtist: currentSongRef.current.artist,
          currentSongIndex: currentSongIndexRef.current
        })
      };

      const response = await fetch(`${API_URL}/admin/user-playlist-logs`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(logData)
      });

      if (!response.ok) {
        console.warn('Lưu log playlist thất bại:', response.status);
      }
    } catch (err) {
      console.warn('Lỗi khi lưu log playlist (không nghiêm trọng):', err);
    }
  }, [user?._id, isPlaying, API_URL]);

  const handlePlayPause = useCallback(() => {
    if (!audioRef.current || !currentSong) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      // Save current position when pausing
      setSongPositions(prev => ({ ...prev, [currentSong._id]: audioRef.current.currentTime }));
      if (currentPlaylist) savePlaylistSelection(currentPlaylist);
    } else {
      if (!freePlayMode && !isCurrentTimeInSchedule()) {
        if (currentPlaylist?.startTime && currentPlaylist?.endTime) {
          message.warning(`Ngoài khung giờ được phép`);
        }
        return;
      }
      audioRef.current.play();
      setIsPlaying(true);
      if (currentPlaylist) savePlaylistSelection(currentPlaylist);
    }
  }, [audioRef, currentSong, isPlaying, currentPlaylist, freePlayMode, isCurrentTimeInSchedule, savePlaylistSelection]);

  useEffect(() => {
    // Connection event listeners
    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('Socket reconnected after', attemptNumber, 'attempts');
    });

    socket.on('reconnect_error', (error) => {
      console.error('Socket reconnection error:', error);
    });

    socket.on('test-notification', () => {
      message.success('test thông bao socket');
    });

    socket.on('remote-logout', (data) => {
      if (data.accountId === users._id) {
        message.warning('Bạn đã bị đăng xuất bởi quản trị viên.');
        onLogout();
      }
    });

    socket.on('remote-play-pause', (data) => {
      if (data.accountId === users._id) {
        handlePlayPause();
      }
    });

    socket.on('remote-select-song', (data) => {
      if (data.accountId === users._id) {
        const songs = freePlayMode ? freePlaySongs : sortedPlaylistSongs;
        const index = songs.findIndex(song => song._id === data.songId);
        if (index !== -1) {
          if (freePlayMode) {
            setFreePlayCurrentIndex(index);
          } else {
            setCurrentSongIndex(index);
          }
        }
      }
    });

    socket.on('playlist-updated', () => {
      console.log('Playlist updated, refetching...');
      fetchPlaylists();
    });

    socket.on('schedule-updated', () => {
      console.log('Schedule updated, refetching playlists...');
      playlistsFetchedRef.current = false;
      fetchPlaylists();
    });

    socket.on('permissions-updated', () => {
      console.log('Permissions updated event received, refetching permissions...');
      fetchPermissions();
    });

    // Handle page unload
    const handleBeforeUnload = () => {
      socket.emit('user-offline', {
        accountId: users._id,
        username: users.username,
        restaurantName: users.restaurantName
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('reconnect');
      socket.off('reconnect_error');
      socket.off('test-notification');
      socket.off('remote-logout');
      socket.off('remote-play-pause');
      socket.off('remote-select-song');
      socket.off('playlist-updated');
      socket.off('schedule-updated');
      socket.off('permissions-updated');
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [onLogout, users._id, fetchPlaylists, fetchPermissions, freePlayMode, freePlaySongs, handlePlayPause, sortedPlaylistSongs, users.restaurantName, users.username]);

  useEffect(() => {
    currentSongRef.current = currentSong;
    currentSongIndexRef.current = currentSongIndex;
  }, [currentSong, currentSongIndex]);

  const logoSrc = adminLogo;

  // Fetch playlists (chỉ 1 lần nhờ ref)
  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists]);

  const getImageUrl = useCallback((imagePath) => {
    if (!imagePath) return defaultImage;
    if (imagePath.startsWith('http')) return imagePath;
    const baseUrl = API_URL.replace('/api', '');
    return `${baseUrl}${imagePath}`;
  }, [API_URL]);

  const scheduleData = playlists.map((playlist, index) => ({
    id: index + 1,
    day: playlist.day || 'N/A',
    time: `${playlist.startTime || '00:00'} - ${playlist.endTime || '24:00'}`,
    title: playlist.name || 'Không có tên',
    image: playlist.imagePath ? getImageUrl(playlist.imagePath) : ListMusic,
  }));

  const schedulesByDay = useMemo(() => {
    const vietnameseDays = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const grouped = {};

    vietnameseDays.forEach(day => grouped[day] = []);

    playlists.forEach((playlist, index) => {
      if (playlist.day && grouped[playlist.day]) {
        grouped[playlist.day].push({
          index,
          day: playlist.day,
          time: `${playlist.startTime || '00:00'} - ${playlist.endTime || '24:00'}`,
          title: playlist.name || 'Không có tên',
          image: playlist.imagePath ? getImageUrl(playlist.imagePath) : ListMusic,
          startTime: playlist.startTime,
          endTime: playlist.endTime
        });
      }
    });

    return grouped;
  }, [playlists, getImageUrl]);

  const getTodayVietnameseDay = useCallback(() => {
    const vietnameseDays = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    return vietnameseDays[new Date().getDay()];
  }, []);

  const demoRightList = freePlayMode
    ? freePlaySongs.map(song => `${song.title || 'N/A'} - ${song.artist || 'N/A'}`)
    : sortedPlaylistSongs.map(song => `${song.title || 'N/A'} - ${song.artist || 'N/A'}`);

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/';
    window.location.reload();
  };

  // Debounce save khi playlist thay đổi
  useEffect(() => {
    if (!currentPlaylist?._id) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      savePlaylistSelection(currentPlaylist);
    }, 1500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [currentPlaylist, savePlaylistSelection]); // ← Đã thêm currentPlaylist → fix warning 2

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      if (isPlaying && !freePlayMode && !isCurrentTimeInSchedule() && audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
        if (currentPlaylist?.startTime && currentPlaylist?.endTime) {
          message.warning(`Ngoài khung giờ ${currentPlaylist.startTime} - ${currentPlaylist.endTime}.`);
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isPlaying, currentPlaylist, isCurrentTimeInSchedule, freePlayMode]);

  useEffect(() => {
    if (!currentSong || !audioRef.current) return;

    setIsLoading(true);
    const baseUrl = API_URL.replace('/api', '');
    const audioUrl = `${baseUrl}${currentSong.path}`;
    audioRef.current.src = audioUrl;
    setCurrentSongTime(0);

    // Restore saved position if exists
    const savedPosition = songPositions[currentSong._id] || 0;
    if (savedPosition > 0) {
      audioRef.current.currentTime = savedPosition;
      setCurrentSongTime(savedPosition);
    }

    if (isPlaying) {
      if (freePlayMode || isCurrentTimeInSchedule()) {
        audioRef.current.play().catch(console.error);
      } else {
        audioRef.current.pause();
        setIsPlaying(false);
        if (currentPlaylist?.startTime && currentPlaylist?.endTime) {
          message.warning(`Ngoài khung giờ ${currentPlaylist.startTime} - ${currentPlaylist.endTime}.`);
        }
      }
    }
  }, [currentSong, API_URL, isPlaying, currentPlaylist, isCurrentTimeInSchedule, freePlayMode, songPositions]);

  // Send playing status to server
  useEffect(() => {
    if (user && currentSong) {
      const statusData = {
        accountId: user._id,
        username: user.username,
        restaurantName: user.restaurantName,
        isPlaying,
        currentSong: {
          _id: currentSong._id,
          title: currentSong.title,
          artist: currentSong.artist
        },
        playlist: freePlayMode ? {
          name: freePlayAlbumName
        } : currentPlaylist ? {
          id: currentPlaylist._id,
          name: currentPlaylist.name,
          startTime: currentPlaylist.startTime,
          endTime: currentPlaylist.endTime,
          day: currentPlaylist.day
        } : null,
        songs: freePlayMode ? freePlaySongs : sortedPlaylistSongs,
        freePlayMode
      };
      socket.emit('playing-status', statusData);
    }
  }, [user, isPlaying, currentSong, currentPlaylist, freePlayMode, freePlayAlbumName, freePlaySongs, sortedPlaylistSongs]);

  const handleNextPlaylist = () => {
    if (playlists.length === 0) return;
    // Save current position
    if (currentSong) {
      setSongPositions(prev => ({ ...prev, [currentSong._id]: audioRef.current?.currentTime || 0 }));
    }
    if (currentPlaylistIndex < playlists.length - 1) {
      const next = currentPlaylistIndex + 1;
      setCurrentPlaylistIndex(next);
      setCurrentSongIndex(0);
    }
  };

  const handlePrevPlaylist = () => {
    if (playlists.length === 0) return;
    // Save current position
    if (currentSong) {
      setSongPositions(prev => ({ ...prev, [currentSong._id]: audioRef.current?.currentTime || 0 }));
    }
    if (currentPlaylistIndex > 0) {
      const prev = currentPlaylistIndex - 1;
      setCurrentPlaylistIndex(prev);
      setCurrentSongIndex(0);
    }
  };

  const handleNextSong = () => {
    if (freePlayMode) {
      if (freePlaySongs.length === 0) return;
      // Save current position
      if (currentSong) {
        setSongPositions(prev => ({ ...prev, [currentSong._id]: audioRef.current?.currentTime || 0 }));
      }
      if (freePlayCurrentIndex < freePlaySongs.length - 1) {
        setFreePlayCurrentIndex(freePlayCurrentIndex + 1);
      } else if (repeatMode === 'all') {
        setFreePlayCurrentIndex(0);
      }
    } else {
      if (!currentPlaylist || sortedPlaylistSongs.length === 0) return;
      // Save current position
      if (currentSong) {
        setSongPositions(prev => ({ ...prev, [currentSong._id]: audioRef.current?.currentTime || 0 }));
      }
      if (currentSongIndex < sortedPlaylistSongs.length - 1) {
        setCurrentSongIndex(currentSongIndex + 1);
      } else if (currentPlaylistIndex < playlists.length - 1) {
        setCurrentPlaylistIndex(currentPlaylistIndex + 1);
        setCurrentSongIndex(0);
      }
    }
  };

  const handlePrevSong = () => {
    if (freePlayMode) {
      if (freePlaySongs.length === 0) return;
      // Save current position
      if (currentSong) {
        setSongPositions(prev => ({ ...prev, [currentSong._id]: audioRef.current?.currentTime || 0 }));
      }
      if (freePlayCurrentIndex > 0) {
        setFreePlayCurrentIndex(freePlayCurrentIndex - 1);
      } else if (repeatMode === 'all') {
        setFreePlayCurrentIndex(freePlaySongs.length - 1);
      }
    } else {
      if (!currentPlaylist || sortedPlaylistSongs.length === 0) return;
      // Save current position
      if (currentSong) {
        setSongPositions(prev => ({ ...prev, [currentSong._id]: audioRef.current?.currentTime || 0 }));
      }
      if (currentSongIndex > 0) {
        setCurrentSongIndex(currentSongIndex - 1);
      } else if (currentPlaylistIndex > 0) {
        setCurrentPlaylistIndex(currentPlaylistIndex - 1);
        setCurrentSongIndex(0);
      }
    }
  };

  const getRandomSongIndex = (songs) => {
    const list = songs || (freePlayMode ? freePlaySongs : sortedPlaylistSongs);
    if (!list?.length) return 0;
    return Math.floor(Math.random() * list.length);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) setCurrentSongTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
    setIsLoading(false);
  };

  const handleSongEnded = () => {
    if (freePlayMode) {
      if (repeatMode === 'one') {
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(console.error);
        }
      } else if (isShuffleOn) {
        setFreePlayCurrentIndex(getRandomSongIndex(freePlaySongs));
      } else if (freePlayCurrentIndex < freePlaySongs.length - 1) {
        setFreePlayCurrentIndex(freePlayCurrentIndex + 1);
      } else if (repeatMode === 'all') {
        setFreePlayCurrentIndex(0);
      }
    } else {
      if (repeatMode === 'one') {
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(console.error);
        }
      } else if (isShuffleOn) {
        setCurrentSongIndex(getRandomSongIndex(sortedPlaylistSongs));
      } else if (currentSongIndex < sortedPlaylistSongs.length - 1) {
        setCurrentSongIndex(currentSongIndex + 1);
      } else if (repeatMode === 'all') {
        if (currentPlaylistIndex < playlists.length - 1) {
          setCurrentPlaylistIndex(currentPlaylistIndex + 1);
          setCurrentSongIndex(0);
        } else {
          setCurrentPlaylistIndex(0);
          setCurrentSongIndex(0);
        }
      } else if (currentPlaylistIndex < playlists.length - 1) {
        setCurrentPlaylistIndex(currentPlaylistIndex + 1);
        setCurrentSongIndex(0);
      }
    }
  };

  const formatTime = (time) => {
    if (!time || isNaN(time)) return '0:00';
    const hours = Math.floor(time / 3600);
    const min = Math.floor((time % 3600) / 60);
    const sec = Math.floor(time % 60);
    if (hours > 0) {
      return `${hours}:${min < 10 ? '0' : ''}${min}:${sec < 10 ? '0' : ''}${sec}`;
    } else {
      return `${min}:${sec < 10 ? '0' : ''}${sec}`;
    }
  };

  // const handleProgressBarClick = (e) => {
  //   if (!audioRef.current || !songDuration || !freePlayMode) return;

  //   const rect = e.currentTarget.getBoundingClientRect();
  //   const clickX = e.clientX - rect.left;
  //   const pct = Math.max(0, Math.min(1, clickX / rect.width));
  //   const newTime = pct * songDuration;
  //   audioRef.current.currentTime = newTime;
  //   setCurrentSongTime(newTime);
  // };

  // PiP refs and helpers
  const pipCanvasRef = useRef(null);
  const pipVideoRef = useRef(null);

  const drawPiPFrame = useCallback(async (canvas) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = getImageUrl(currentSong?.imagePath) || ListMusic;
    await new Promise((res) => {
      img.onload = res;
      img.onerror = res;
    });

    try { ctx.drawImage(img, 0, 0, w, h); } catch (e) {}

    // Removed song info overlay - showing only album art
  }, [currentSong, getImageUrl]);

  const createPiP = async () => {
    try {
      if (!('pictureInPictureEnabled' in document) || !document.pictureInPictureEnabled) {
        alert('Trình duyệt hiện không hỗ trợ Picture-in-Picture');
        return;
      }

      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        return;
      }

      let canvas = pipCanvasRef.current;
      let video = pipVideoRef.current;

      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 200;
        pipCanvasRef.current = canvas;
      }

      await drawPiPFrame(canvas);

      if (!video) {
        video = document.createElement('video');
        video.muted = true;
        video.playsInline = true;
        video.controls = true; // Enable native video controls
        video.style.position = 'fixed';
        video.style.right = '100%';
        video.style.width = '1px';
        video.style.height = '1px';
        video.style.opacity = '0';
        pipVideoRef.current = video;
        document.body.appendChild(video);
      }

      // attach stream (if already attached, captureStream will continue updating)
      video.srcObject = canvas.captureStream(15);
      await video.play();
      await video.requestPictureInPicture();
      setPipActive(true);

      // Remove custom click handler - using browser's native controls
      const cleanup = () => {
        setPipActive(false);
        try {
          if (video) {
            video.pause();
            if (video.srcObject) {
              const tracks = video.srcObject.getTracks();
              tracks.forEach((t) => t.stop());
            }
            if (video.parentNode) video.parentNode.removeChild(video);
          }
        } catch (e) {}
        pipVideoRef.current = null;
        pipCanvasRef.current = null;
      };

      video.addEventListener('leavepictureinpicture', cleanup, { once: true });
    } catch (err) {
      console.error('PiP error', err);
    }
  };

  useEffect(() => {
    const redraw = async () => {
      const canvas = pipCanvasRef.current;
      if (!canvas || !pipActive) return;
      await drawPiPFrame(canvas);
    };
    redraw();
  }, [currentSong, isPlaying, drawPiPFrame, pipActive]);

  const settingsContent = (
    <div style={{ minWidth: 200 }}>
      <Space direction="vertical" style={{ width: '100%' }}>
        {user?.permission && (
          <Button
            type='text'
            icon={<SettingOutlined />}
            block
            onClick={() => {
              navigate('/dashboard');
              setSettingsOpen(false);
            }}
            style={{ textAlign: 'left', color: '#dbe7f7' }}
          >
            Dashboard
          </Button>
        )}
        <Button
          type='text'
          danger
          icon={<LogoutOutlined />}
          block
          onClick={handleLogout}
          style={{ textAlign: 'left' }}
        >
          Đăng xuất
        </Button>
      </Space>
    </div>
  );

  return (
    <div className="bgm-root">
      <div className="bgm-content">
        <div className="bgm-header">
          <div className="header-left">
            <img src={logoSrc} alt="logo" className="header-logo" />
            <div className="header-info">
              <div className="header-title">Music for Business</div>
              <div className="header-sub">Nhạc nền hay dành cho {users?.restaurantName || user?.restaurantName || 'NISO'}</div>
            </div>
          </div>
          <Popover
            content={settingsContent}
            title="Cài đặt"
            trigger="click"
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            placement="bottomRight"
          >
            <Button
              type="text"
              icon={<SettingOutlined style={{ fontSize: 20, color: '#dbe7f7' }} />}
              style={{ padding: '8px 12px' }}
            />
          </Popover>
        </div>

        <div className="bgm-main">
          <div style={{ transition: 'opacity 0.3s ease', opacity: contentOpacity }}>
            {!viewSchedule ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <div className="bgm-tabs">
                    <div
                      className={`tab-item ${activeTab === 'tudo' ? 'active' : ''} ${!hasFreePlayPermission ? 'disabled' : ''}`}
                      onClick={() => {
                        if (hasFreePlayPermission) {
                          setContentOpacity(0);
                          setTimeout(() => {
                            setActiveTab('tudo');
                            setFreePlayMode(true);
                            setContentOpacity(1);
                          }, 150);
                        }
                      }}
                      style={{ cursor: hasFreePlayPermission ? 'pointer' : 'not-allowed', opacity: hasFreePlayPermission ? 1 : 0.5 }}
                    >
                      {!hasFreePlayPermission ? (
                        <Tooltip title="Chế độ phát tự do hiện không khả dụng cho tài khoản của bạn, hãy liên hệ với quản trị viên để được hỗ trợ." placement="bottom">
                          <div style={{ width: 150, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                            <MdBlock />
                            PHÁT TỰ DO
                          </div>
                        </Tooltip>
                      ) : (
                        <div style={{ width: 150, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                          PHÁT TỰ DO
                        </div>
                      )}
                    </div>
                    <div
                      className={`tab-item ${activeTab === 'schedule' ? 'active' : ''}`}
                      onClick={() => {
                        setContentOpacity(0);
                        setTimeout(() => {
                          setActiveTab('schedule');
                          setFreePlayMode(false);
                          setContentOpacity(1);
                        }, 150);
                      }}
                    >
                      <div style={{ width: 150, textAlign: 'center' }}>PHÁT THEO LỊCH</div>
                    </div>
                  </div>
                </div>

                {activeTab === 'schedule' ? (
                  <>
                    <section className="bgm-timeline">
                      <div className="timeline-row">
                        <div className="timeline-left">{isPlaying ? 'Đang phát' : 'Tạm dừng'}</div>
                        <div className="timeline-track">
                          <img src={currentPlaylist?.imagePath ? getImageUrl(currentPlaylist.imagePath) : ListMusic} alt="cover" className="right-thumb" />
                          <div className="track-info">
                            <div className="track-title">{currentPlaylist?.name || null}</div>
                            <div className="track-sub">{currentPlaylist ? `${currentPlaylist.startTime || '00:00'} - ${currentPlaylist.endTime || '24:00'}` : null}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {playlists.length > 0 && currentPlaylistIndex > 0 && (
                            <div className="timeline-arrow" onClick={handlePrevPlaylist} title="Danh sách phát trước">
                              <LeftOutlined />
                            </div>
                          )}
                          {playlists.length > 0 && currentPlaylistIndex < playlists.length - 1 && (
                            <div className="timeline-arrow" onClick={handleNextPlaylist}>
                              <RightOutlined />
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center', color: '#93a6c4', fontSize: 13, marginTop: 20 }}>
                        <div
                          style={{
                            background: 'rgba(255, 255, 255, 0.08)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: 100,
                            color: '#dbe7f7',
                            cursor: 'pointer',
                            fontSize: 13,
                            padding: 10,
                            fontWeight: 500
                          }}
                          onClick={() => {
                            setContentOpacity(0);
                            setTimeout(() => {
                              setViewSchedule(true);
                              setContentOpacity(1);
                            }, 150);
                          }}
                        >
                          Lịch phát sóng <RightOutlined />
                        </div>
                      </div>
                    </section>

                    <section className="bgm-playlist">
                      <div className="playlist-header">
                        <img src={currentPlaylist?.imagePath ? getImageUrl(currentPlaylist.imagePath) : ListMusic} alt="cover" className="right-thumb" />
                        <div style={{lineHeight:1.5}}>
                          <div className="badge-small">ĐANG PHÁT PLAYLIST</div>
                          <div className="playlist-title">{currentPlaylist?.name || null}</div>
                        </div>
                      </div>

                      <div className="playlist-songs-header">
                        <div className="header-left-col">BÀI HÁT</div>
                        <div className="header-right-col">THỜI GIAN</div>
                      </div>

                      <div className='playlist-scroll2'>
                        {currentPlaylist?.songs?.length > 0 ? (
                          sortedPlaylistSongs.map((song, index) => (
                            <div
                              key={song._id || index}
                              className="song-row"
                              style={{
                                backgroundColor: currentSong?._id === song._id ? '#ffffff14' : 'transparent'
                              }}
                              onClick={() => setCurrentSongIndex(index)}
                            >
                              <img src={getImageUrl(song.imagePath)} alt="cover" className="song-thumb" />
                              <div className="song-info">
                                <div className="song-title">{song.title ? (song.title.length > 20 ? song.title.substring(0, 20) + '...' : song.title) : null}</div>
                                <div className="song-artist">{song.artist ? (song.artist.length > 20 ? song.artist.substring(0, 20) + '...' : song.artist) : null}</div>
                              </div>
                              <div className="song-time">{formatTime(song.duration || 0)}</div>
                            </div>
                          ))
                        ) : (
                          <div style={{ padding: '20px', textAlign: 'center', color: '#93a6c4' }}>
                            Playlist này không có bài hát
                          </div>
                        )}
                      </div>
                    </section>
                  </>
                ) : (
                  <Playfreely
                    users={users}
                    currentSong={currentSong}
                    onSelectAlbum={(album) => {
                      if (album) {
                        setFreePlaySongs(album.songs || []);
                        setFreePlayAlbumName(album.name || 'Unknown Album');
                        setFreePlayCurrentIndex(0);
                        setFreePlayMode(true);
                        setIsPlaying(true);
                      } else {
                        setIsPlaying(false);
                      }
                    }}
                    onSelectSong={(song) => {
                      setFreePlaySongs([song]);
                      setFreePlayAlbumName(song.title || 'Single Song');
                      setFreePlayCurrentIndex(0);
                      setFreePlayMode(true);
                      setIsPlaying(true);
                    }}
                  />
                )}
              </>
            ) : (
              <section className="schedule-view">
                {scheduleLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', paddingTop: '30px' }}>
                    <div className="container">
                      <img src={opac} alt="Loading..." style={{ width: '50px', height: '50px', objectFit: 'cover' }} />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="schedule-header">
                      <button className="schedule-back-btn" onClick={() => {
                        setContentOpacity(0);
                        setTimeout(() => {
                          setViewSchedule(false);
                          setContentOpacity(1);
                        }, 150);
                      }}>
                        <LeftOutlined /> Quay lại
                      </button>
                      <h2>LỊCH PHÁT SÓNG</h2>
                      <div className="current-time-display">
                        {currentTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                    </div>

                    <div className="schedule-display">
                      {scheduleData.length > 0 && currentPlaylist ? (
                        <>
                          <img src={currentPlaylist.imagePath ? getImageUrl(currentPlaylist.imagePath) : ListMusic} alt="cover" className="schedule-thumb" />
                          <div className="schedule-info">
                            <div className="schedule-day">
                              {Array.isArray(currentPlaylist.day) ? currentPlaylist.day.join('-') : (currentPlaylist.day || '')}
                            </div>
                            <div className="schedule-title">{currentPlaylist.name}</div>
                            <div className="schedule-time">{currentPlaylist.startTime} - {currentPlaylist.endTime}</div>
                          </div>
                        </>
                      ) : (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#93a6c4', fontSize: 16 }}>
                          Không có lịch phát
                        </div>
                      )}
                    </div>

                    <div className="schedule-list">
                      <div className="list-title">Danh sách playlist hôm nay ({getTodayVietnameseDay()})</div>
                      {schedulesByDay[getTodayVietnameseDay()]?.length > 0 ? (
                        <div className="schedule-day-group">
                          {schedulesByDay[getTodayVietnameseDay()].map((schedule) => (
                            <div
                              key={schedule.index}
                              className={`schedule-item ${currentPlaylistIndex === schedule.index ? 'active' : ''}`}
                              onClick={() => {
                                setCurrentPlaylistIndex(schedule.index);
                                setCurrentSongIndex(0);
                              }}
                            >
                              <img src={schedule.image} alt="cover" className="schedule-item-thumb" />
                              <div className="schedule-item-content">
                                <div className="schedule-item-title">{schedule.title}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#93a6c4' }}>
                          Không có lịch phát hôm nay
                        </div>
                      )}
                    </div>
                  </>
                )}
              </section>
            )}
          </div>
        </div>
      </div>

      <aside className="bgm-right">
        <div className="right-header">
          <IoMusicalNotesOutline style={{ marginRight: 8 }} />
          DANH SÁCH PHÁT
        </div>
        <div className="right-list">
          {demoRightList.length > 0 ? (
            (freePlayMode ? freePlaySongs : sortedPlaylistSongs).map((song, i) => (
              <div
                className="right-row"
                key={song._id || i}
                style={{
                  backgroundColor: currentSong?._id === song._id ? '#ffffff14' : 'transparent',
                  cursor: 'pointer'
                }}
                onClick={() => freePlayMode ? setFreePlayCurrentIndex(i) : setCurrentSongIndex(i)}
              >
                <div
                  className="right-thumb-container"
                  style={{
                    backgroundColor: currentSong?._id === song._id ? 'rgba(0, 0, 0, 0.1)' : 'transparent',
                    borderRadius: 6,
                  }}
                >
                  <img src={getImageUrl(song.imagePath)} alt="cover" className="right-thumb" />
                  {currentSong?._id === song._id && isPlaying && (
                    <img src={opac} alt="overlay" className="right-thumb-overlay" />
                  )}
                  {currentSong?._id === song._id && !isPlaying && (
                    <FaPlay className="right-thumb-overlay" style={{ color: 'white', fontSize: '24px' }} />
                  )}
                </div>
                <div className="right-info">
                  <div className="right-title">{song.title ? (song.title.length > 20 ? song.title.substring(0, 20) + '...' : song.title) : ''}</div>
                  <div className="right-sub">{song.artist ? (song.artist.length > 20 ? song.artist.substring(0, 20) + '...' : song.artist) : ''}</div>
                </div>
              </div>
            ))
          ) : (
            <div style={{ padding: '20px', textAlign: 'center', color: '#93a6c4', fontSize: 14 }}>
              Không có bài hát
            </div>
          )}
        </div>
      </aside>

      <div className="bgm-player">
        <div className="player-left">
          <div className="player-info" style={{ display: 'flex', alignItems: 'center' }}>
            <img
              src={getImageUrl(currentSong?.imagePath)}
              alt={currentSong?.title || 'cover'}
              className="player-thumb"
              style={{ width: 48, height: 48, borderRadius: 6, marginRight: 10, objectFit: 'cover' }}
            />
            <div className="player-text">
              <div className="player-title">{currentSong?.title ? (currentSong.title.length > 20 ? currentSong.title.substring(0, 20) + '...' : currentSong.title) : null}</div>
              <div className="player-artist">{currentSong?.artist ? (currentSong.artist.length > 20 ? currentSong.artist.substring(0, 20) + '...' : currentSong.artist) : null}</div>
            </div>
          </div>
        </div>

        <div className="player-center">
          <div className="player-controls">
            {window.innerWidth >= 768 && (
              <button
                style={{
                  fontSize: 18,
                  cursor: 'pointer',
                  background: 'none',
                  border: 'none',
                  color: repeatMode !== 'off' ? '#00D3E5' : '#93a6c4',
                  transition: 'color 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
                title={`Lặp lại: ${repeatMode === 'off' ? 'Tắt' : repeatMode === 'one' ? 'Một bài' : 'Tất cả'}`}
                onClick={() => {
                  const modes = ['off', 'one', 'all'];
                  const next = (modes.indexOf(repeatMode) + 1) % modes.length;
                  setRepeatMode(modes[next]);
                }}
              >
                <FaRepeat />
                {repeatMode === 'one' && <span style={{ fontSize: 12 }}>1</span>}
              </button>
            )}

            <button
              style={{ fontSize: 20, cursor: 'pointer', background: 'none', border: 'none', color: '#fff' }}
              onClick={handlePrevSong}
              className='btn-song'
            >
              <StepBackwardOutlined />
            </button>

            <button
              style={{
                fontSize: 22,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                background: 'none',
                border: 'none',
                color: '#00D3E5',
                display: 'flex',
                alignItems: 'center',
              }}
              onClick={handlePlayPause}
              disabled={isLoading}
            >
              {isLoading ? <div className="loader"></div> : (isPlaying ? <FaPause /> : <FaPlay />)}
            </button>

            <button
              style={{ fontSize: 20, cursor: 'pointer', background: 'none', border: 'none', color: '#fff' }}
              onClick={handleNextSong}
              className='btn-song'
            >
              <StepForwardOutlined />
            </button>

            {window.innerWidth >= 768 && (
              <button
                style={{
                  fontSize: 18,
                  cursor: 'pointer',
                  background: 'none',
                  border: 'none',
                  color: isShuffleOn ? '#00D3E5' : '#93a6c4',
                  transition: 'color 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title={`Trộn bài: ${isShuffleOn ? 'Bật' : 'Tắt'}`}
                onClick={() => setIsShuffleOn(!isShuffleOn)}
              >
                <FaShuffle />
              </button>
            )}
          </div>

          <div className="player-progress">
            <div className="progress-time">{formatTime(currentSongTime)}</div>
            <div style={{ flex: 1, margin: '0 10px' }}>
              <Slider
                min={0}
                max={songDuration || 100}
                value={currentSongTime}
                onChange={(value) => {
                  if (freePlayMode) {
                    setCurrentSongTime(value);
                    if (audioRef.current) audioRef.current.currentTime = value;
                  }
                }}
                disabled={!freePlayMode}
                tooltip={{ formatter: formatTime }}
                styles={{
                  track: { background: '#00D3E5' },
                  rail: { background: 'rgba(255, 255, 255, 0.2)' },
                  handle: { borderColor: '#00D3E5' },
                }}
              />
            </div>
            <div className="progress-time">{formatTime(songDuration)}</div>
          </div>
        </div>


        <div className="player-right">
          <div
            style={{ cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center' }}
            onClick={() => {
              if (volume > 0) {
                setPrevVolume(volume);
                setVolume(0);
                if (audioRef.current) audioRef.current.volume = 0;
              } else {
                const newVol = prevVolume > 0 ? prevVolume : 100;
                setVolume(newVol);
                if (audioRef.current) audioRef.current.volume = newVol / 100;
              }
            }}
          >
            {volume === 0 ? <IoVolumeMuteOutline style={{ fontSize: 20 }} /> : <IoVolumeHighOutline style={{ fontSize: 20 }} />}
          </div>

          <div style={{ width: 120 }}>
            <Slider
              min={0}
              max={100}
              value={volume}
              onChange={(value) => {
                setVolume(value);
                if (audioRef.current) audioRef.current.volume = value / 100;
              }}
              styles={{
                track: { background: '#00D3E5' },
                rail: { background: 'rgba(255, 255, 255, 0.2)' },
              }}
            />
          </div>

                   <div style={{ width: 2, height: 24, backgroundColor: 'rgba(255, 255, 255, 0.2)', margin: '0 12px' }} />

                              <div
            title="Mở trình phát nổi"
            onClick={createPiP}
            style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', marginRight: 8, color: pipActive ? '#00D3E5' : '#93a6c4', }}
          >
            <BsMusicPlayer />
          </div>
        </div>
      </div>

      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleSongEnded}
        crossOrigin="anonymous"
      />
    </div>
  );
};

export default Bgm;