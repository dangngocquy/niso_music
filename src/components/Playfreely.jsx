import React, { useState, useEffect, useCallback } from 'react';
import { Row, Col, Button, Input } from 'antd';
import axios from 'axios';
import { useApiUrl } from '../hooks/useApiUrl';
import loadinggif from '../asset/opac.gif';
import defaultImage from '../asset/disk.webp';
import '../styles/Playfreely.css';
import { FaPlay, FaPause } from "react-icons/fa";
import socket from '../socket';

function Playfreely({ users, onSelectAlbum, onSelectSong, currentSong }) {
  const API_URL = useApiUrl();
  const [albums, setAlbums] = useState([]);
  const [musicFiles, setMusicFiles] = useState([]);
  const [filteredSongs, setFilteredSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [playingAlbumId, setPlayingAlbumId] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const auth = btoa(`${process.env.REACT_APP_BASIC_AUTH_USERNAME}:${process.env.REACT_APP_BASIC_AUTH_PASSWORD}`);
      const [albumsResponse, musicResponse] = await Promise.all([
        axios.get(`${API_URL}/admin/albums`, {
          headers: { 'Authorization': `Basic ${auth}` }
        }),
        axios.get(`${API_URL}/admin/music`, {
          headers: { 'Authorization': `Basic ${auth}` }
        })
      ]);
      setAlbums(albumsResponse.data.data || []);
      setMusicFiles(musicResponse.data.data || []);
      setFilteredSongs(musicResponse.data.data || []);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    socket.on('album-updated', () => {
      console.log('Album updated, refetching data...');
      fetchData();
    });

    return () => {
      socket.off('album-updated');
    };
  }, [fetchData]);

  useEffect(() => {
    const fetchSearchResults = async () => {
      if (searchTerm.trim() === '') {
        setFilteredSongs(musicFiles);
        return;
      }
      setSearchLoading(true);
      try {
        const auth = btoa(`${process.env.REACT_APP_BASIC_AUTH_USERNAME}:${process.env.REACT_APP_BASIC_AUTH_PASSWORD}`);
        const response = await axios.get(`${API_URL}/admin/music?search=${encodeURIComponent(searchTerm)}&limit=1000`, {
          headers: { 'Authorization': `Basic ${auth}` }
        });
        setFilteredSongs(response.data.data || []);
      } catch (err) {
        console.error('Error searching music:', err);
        setFilteredSongs([]);
      } finally {
        setSearchLoading(false);
      }
    };

    if (musicFiles.length > 0) {
      fetchSearchResults();
    }
  }, [searchTerm, musicFiles, API_URL]);

  const handlePlayAlbum = (album) => {
    if (playingAlbumId === album._id) {
      setPlayingAlbumId(null);
      onSelectAlbum(null); // Assuming this pauses the album
    } else {
      setPlayingAlbumId(album._id);
      onSelectAlbum(album);
    }
  };

  const handlePlaySong = (song) => {
    if (onSelectSong) {
      onSelectSong(song);
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', paddingTop: '30px' }}>
        <div className="container">
          <img src={loadinggif} alt="Loading..." style={{ width: '50px', height: '50px', objectFit: 'cover' }} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <Input
          placeholder="Tìm kiếm bài hát..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          size="large"
          style={{ width: '100%' }}
        />
      </div>
      <h2 style={{ color: '#dbe7f7', marginBottom: '20px' }} className='search_music'>{searchTerm ? 'Kết quả tìm kiếm' : 'Chủ đề'}</h2>
      {searchTerm ? (
        <div className="albums-scroll-container">
          {searchLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', paddingTop: '30px' }}>
              <div className="container">
                <img src={loadinggif} alt="Loading..." style={{ width: '50px', height: '50px', objectFit: 'cover' }} />
              </div>
            </div>
          ) : filteredSongs.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#93a6c4', padding: '20px' }} className='search_music'>Không tìm thấy bài hát</div>
          ) : (
            <>
              <div className="playlist-songs-header">
                <div className="header-left-col">BÀI HÁT</div>
                <div className="header-right-col">THỜI GIAN</div>
              </div>
              {filteredSongs.map((song) => (
                <div
                  key={song._id}
                  className="song-row"
                  style={{
                    backgroundColor: currentSong?._id === song._id ? '#ffffff14' : 'transparent'
                  }}
                  onClick={() => handlePlaySong(song)}
                >
                  <img src={song.imagePath ? `${API_URL.replace('/api', '')}${song.imagePath}` : defaultImage} alt={song.title} className="song-thumb" />
                  <div className="song-info">
                    <div className="song-title">{song.title.length > 20 ? song.title.substring(0, 20) + '...' : song.title}</div>
                    <div className="song-artist">{song.artist ? (song.artist.length > 20 ? song.artist.substring(0, 20) + '...' : song.artist) : 'N/A'}</div>
                  </div>
                  <div className="song-time">{formatDuration(song.duration)}</div>
                </div>
              ))}
            </>
          )}
        </div>
      ) : (
        <div className="albums-scroll-container">
          <Row gutter={[16, 16]}>
            {albums.length === 0 ? (
              <Col xs={24}>
                <div style={{ textAlign: 'center', color: '#93a6c4' }}>Chưa có album nào</div>
              </Col>
            ) : (
              albums.map(album => (
                <Col xs={24} sm={12} md={8} lg={6} key={album._id}>
                  <div className="album-card2"  onClick={() => handlePlayAlbum(album)}>
                    {album.imageData ? (
                      <img className="album-image" alt={album.name} src={album.imageData} />
                    ) : (
                      <img 
                        className="album-image" 
                        alt="default" 
                        src={defaultImage} 
                      />
                    )}
                    <div className="overlay-text">
                      <h3>{album.name.length > 15 ? album.name.substring(0, 15) + '...' : album.name}</h3>
                      <p>{album.notes}</p>
                      <p>{album.songs?.length || 0} bài hát</p>
                    </div>
                    <Button
                      className="play-button"
                      shape='circle'
                      type="primary"
                      icon={playingAlbumId === album._id ? <FaPause color='#033A49' /> : <FaPlay color='#033A49' />}
                      size="middle"
                   />
                  </div>
                </Col>
              ))
            )}
          </Row>
        </div>
      )}
    </div>
  );
}

export default Playfreely;