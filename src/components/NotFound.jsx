import React from 'react';
import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh', 
      backgroundColor: '#0b162a', 
      color: '#dbe7f7' 
    }}>
      <Result
        status="404"
        title={<span style={{ color: '#ffffff' }}>404 - Page Not Found</span>}
        subTitle={<span style={{ color: '#93a6c4' }}>Sorry, the page you visited does not exist.</span>}
        extra={
          <Button 
            type="primary" 
            onClick={() => navigate('/')}
            style={{ backgroundColor: '#00D3E5', borderColor: '#00D3E5' }}
          >
            Go Home
          </Button>
        }
        style={{ color: '#dbe7f7' }}
      />
    </div>
  );
};

export default NotFound;