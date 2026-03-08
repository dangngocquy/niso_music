import React, { useState, useRef, useEffect } from 'react';
import { Modal, Button, Slider, Space } from 'antd';
import { StepBackwardOutlined, StepForwardOutlined } from '@ant-design/icons';
import { useApiUrl } from '../hooks/useApiUrl';
import { IoPlayOutline, IoPauseOutline } from "react-icons/io5";
import defaultImage from '../asset/disk.webp';

const PreviewModal = ({ isOpen, onClose, music, musicList = [], currentMusicIndex = 0, onNext, onPrev }) => {
  const API_URL = useApiUrl();
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [error, setError] = useState(null);

  // Helper function to get full image URL
  const getImageUrl = (imagePath) => {
    if (!imagePath) return defaultImage;
    if (imagePath.startsWith('http')) return imagePath;
    const baseUrl = API_URL.replace('/api', '');
    return `${baseUrl}${imagePath}`;
  };

  useEffect(() => {
    if (isOpen && audioRef.current && music?.path) {
      try {
        setIsLoadingAudio(true);
        setError(null);
        // Set initial duration from music.duration (from DB)
        setDuration(music.duration || 0);
        // Path đã là /uploads/filename, lấy base URL từ API_URL (http://localhost:5000)
        const baseUrl = API_URL.replace('/api', '');
        const audioUrl = `${baseUrl}${music.path}`;
        console.log('Loading audio from:', audioUrl, '| Duration from DB:', music.duration);
        audioRef.current.src = audioUrl;
        setCurrentTime(0);
        setIsPlaying(false);
      } catch (error) {
        console.error('Error loading audio:', error);
        setError('Không thể tải file nhạc');
      } finally {
        setIsLoadingAudio(false);
      }
    }
  }, [isOpen, music, API_URL]);

  useEffect(() => {
    const audioElement = audioRef.current;
    return () => {
      if (audioElement) {
        audioElement.pause();
      }
    };
  }, []);

  const handlePlayPause = () => {
    if (audioRef.current && !isLoadingAudio && !error) {
      try {
        if (isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
        } else {
          audioRef.current.play().catch((error) => {
            console.error('Error playing audio:', error);
            setError('Không thể phát nhạc');
            setIsPlaying(false);
          });
          setIsPlaying(true);
        }
      } catch (error) {
        console.error('Error toggling play/pause:', error);
        setError('Lỗi phát nhạc');
        setIsPlaying(false);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      let audioDuration = audioRef.current.duration;
      
      // If browser can't determine duration, fall back to music.duration from DB
      if (!audioDuration || isNaN(audioDuration) || audioDuration === Infinity) {
        audioDuration = music?.duration || 0;
        console.log('⚠ Browser duration failed, using DB duration:', audioDuration);
      } else {
        console.log('✓ Audio loaded - Duration:', audioDuration, 'seconds, Formatted:', formatTime(audioDuration));
      }
      
      setDuration(audioDuration);
    }
  };

  const handleSliderChange = (value) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value;
      setCurrentTime(value);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const formatTime = (time) => {
    if (!time || isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const truncateTitle = (title, maxLength = 30) => {
    if (!title) return 'Không rõ';
    if (title.length > maxLength) {
      return title.substring(0, maxLength) + '...';
    }
    return title;
  };

  return (
    <Modal
      title={`Nghe thử: ${truncateTitle(music?.title)}`}
      open={isOpen}
      onCancel={() => {
        if (audioRef.current) {
          audioRef.current.pause();
          setIsPlaying(false);
        }
        onClose();
      }}
      footer={null}
      centered
      width={500}
      styles={{
        content: {
          background: '#1a2332',
        },
        header: {
          background: '#1a2332',
          borderBottom: '1px solid hsla(0, 0%, 100%, 0.15)',
        },
        title: {
          color: '#ffffff',
        },
      }}
    >
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onLoadedData={() => {
          // Try to get duration on loadeddata event too
          if (audioRef.current && !duration) {
            const audioDuration = audioRef.current.duration;
            if (audioDuration && !isNaN(audioDuration) && audioDuration !== Infinity) {
              setDuration(audioDuration);
            } else if (music?.duration) {
              setDuration(music.duration);
            }
          }
        }}
        onEnded={handleEnded}
        onError={(err) => {
          console.error('Audio error:', err);
          setError('Không thể tải file nhạc');
          setIsPlaying(false);
        }}
        onLoadStart={() => {
          setError(null);
          setIsLoadingAudio(true);
        }}
        onCanPlay={() => {
          // Try to get duration if not set yet
          if (!duration && audioRef.current) {
            const audioDuration = audioRef.current.duration;
            if (audioDuration && !isNaN(audioDuration) && audioDuration !== Infinity) {
              setDuration(audioDuration);
              console.log('✓ Got duration on canplay:', audioDuration);
            } else if (music?.duration) {
              setDuration(music.duration);
              console.log('⚠ Using duration from DB:', music.duration);
            }
          }
          setIsLoadingAudio(false);
        }}
        crossOrigin="anonymous"
      />

      <div style={{ padding: '24px 0' }}>
        <div style={{ marginBottom: '32px', textAlign: 'center' }}>
          <div style={{ marginBottom: '16px' }}>
            <img 
              src={getImageUrl(music?.imagePath)} 
              alt="Album Art" 
              style={{
                width: '200px',
                height: '200px',
                borderRadius: '8px',
                objectFit: 'cover',
              }}
            />
          </div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', marginBottom: '8px' }}>
            {music?.title}
          </div>
          <div style={{ fontSize: '14px', color: '#93a6c4' }}>
            {music?.artist}
          </div>
        </div>

        {error && (
          <div style={{
            padding: '12px 16px',
            marginBottom: '16px',
            background: '#ff4d4f',
            color: '#ffffff',
            borderRadius: '4px',
            fontSize: '14px',
            textAlign: 'center',
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Slider
            min={0}
            max={duration || 0}
            value={currentTime}
            onChange={handleSliderChange}
            step={0.1}
            disabled={isLoadingAudio || error}
            styles={{
              track: {
                background: '#00D3E5',
              },
              rail: {
                background: 'rgba(255, 255, 255, 0.2)',
              },
            }}
          />

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '12px',
            color: '#93a6c4',
          }}>
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
            <Space size="middle">
              <Button
                type="text"
                size="large"
                icon={<StepBackwardOutlined style={{ fontSize: 24, color: '#00D3E5' }} />}
                onClick={onPrev}
                disabled={isLoadingAudio || error || currentMusicIndex === 0 || !onPrev}
                style={{ padding: 0 }}
              />
              <Button
                type="primary"
                size="large"
                icon={isPlaying ? <IoPauseOutline /> : <IoPlayOutline />}
                onClick={handlePlayPause}
                shape='circle'
                disabled={isLoadingAudio || error}
              />
              <Button
                type="text"
                size="large"
                icon={<StepForwardOutlined style={{ fontSize: 24, color: '#00D3E5' }} />}
                onClick={onNext}
                disabled={isLoadingAudio || error || currentMusicIndex === musicList.length - 1 || !onNext}
                style={{ padding: 0 }}
              />
            </Space>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default PreviewModal;
