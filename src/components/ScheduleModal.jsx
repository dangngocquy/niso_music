import React, { useState } from 'react';
import { Modal, Button, Space } from 'antd';
import { StepBackwardOutlined, StepForwardOutlined } from '@ant-design/icons';
import ListMusic from '../asset/album.png';
import '../styles/ScheduleModal.css';

const scheduleData = [
  { id: 1, day: 'Thứ Hai', time: '00:00 - 24:00', title: 'Nhac USUK 2024 - CPS', image: ListMusic },
  { id: 2, day: 'Thứ Ba', time: '00:00 - 24:00', title: 'Nhac USUK 2024 - CPS', image: ListMusic },
  { id: 3, day: 'Thứ Tư', time: '00:00 - 24:00', title: 'Nhac USUK 2024 - CPS', image: ListMusic },
  { id: 4, day: 'Thứ Năm', time: '00:00 - 24:00', title: 'Nhac USUK 2024 - CPS', image: ListMusic },
  { id: 5, day: 'Thứ Sáu', time: '00:00 - 24:00', title: 'Nhac USUK 2024 - CPS', image: ListMusic },
];

const ScheduleModal = ({ isOpen, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : scheduleData.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < scheduleData.length - 1 ? prev + 1 : 0));
  };

  const currentSchedule = scheduleData[currentIndex];

  return (
    <Modal
      title="LỊCH PHÁT SÓNG"
      open={isOpen}
      onCancel={onClose}
      footer={null}
      centered
      width={600}
      className="schedule-modal"
    >
      <div className="schedule-content">
        <div className="schedule-display">
          <img src={currentSchedule.image} alt="cover" className="schedule-thumb" />
          <div className="schedule-info">
            <div className="schedule-day">{currentSchedule.day}</div>
            <div className="schedule-title">{currentSchedule.title}</div>
            <div className="schedule-time">{currentSchedule.time}</div>
          </div>
        </div>

        <div className="schedule-navigation">
          <Space>
            <Button
              type="primary"
              icon={<StepBackwardOutlined />}
              onClick={handlePrevious}
              size="large"
            >
              Trước
            </Button>
            <span style={{ color: '#93a6c4', fontSize: 14 }}>
              {currentIndex + 1} / {scheduleData.length}
            </span>
            <Button
              type="primary"
              icon={<StepForwardOutlined />}
              onClick={handleNext}
              size="large"
            >
              Tiếp
            </Button>
          </Space>
        </div>

        <div className="schedule-list">
          <div className="list-title">Danh sách khung giờ</div>
          {scheduleData.map((item, index) => (
            <div
              key={item.id}
              className={`schedule-item ${index === currentIndex ? 'active' : ''}`}
              onClick={() => setCurrentIndex(index)}
            >
              <div className="item-day">{item.day}</div>
              <div className="item-title">{item.title}</div>
              <div className="item-time">{item.time}</div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
};

export default ScheduleModal;
