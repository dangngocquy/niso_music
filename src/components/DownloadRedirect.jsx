import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const DownloadRedirect = () => {
  const [searchParams] = useSearchParams();
  const iosUrl = searchParams.get('url') || 'https://apps.apple.com/us/app/saigon-taste/id1306745747';

  useEffect(() => {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;

    // Check if the device is Android
    if (/android/i.test(userAgent)) {
      window.location.href = 'https://play.google.com/store/apps/details?id=com.vtm.saigontaste';
    }
    // Check if the device is iOS
    else if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
      window.location.href = iosUrl;
    }
    // Default fallback, maybe redirect to a general page or show a message
    else {
      // For other devices, perhaps redirect to a web version or show an alert
      alert('Ứng dụng chỉ khả dụng trên Android và iOS. Vui lòng truy cập từ thiết bị di động.');
      // Or redirect to a web version if available
      // window.location.href = 'https://your-web-app-url.com';
    }
  }, [iosUrl]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '16px' }}>
      Đang chuyển hướng...
    </div>
  );
};

export default DownloadRedirect;