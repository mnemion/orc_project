import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import DashboardIcon from '@mui/icons-material/Dashboard';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import HistoryIcon from '@mui/icons-material/History';
import SettingsIcon from '@mui/icons-material/Settings';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import TableChartIcon from '@mui/icons-material/TableChart';
import ContactMailIcon from '@mui/icons-material/ContactMail';
import { useTheme } from '../contexts/ThemeContext';

const menuItems = [
  {
    title: '대시보드',
    path: '/dashboard',
    icon: <DashboardIcon />
  },
  {
    title: 'OCR 텍스트 추출',
    path: '/ocr',
    icon: <InsertDriveFileIcon />
  },
  {
    title: '텍스트 요약',
    path: '/summarize',
    icon: <LibraryBooksIcon />
  },
  {
    title: '표 데이터 추출',
    path: '/table-extraction',
    icon: <TableChartIcon />
  },
  {
    title: '명함 인식',
    path: '/business-card',
    icon: <ContactMailIcon />
  },
  {
    title: '영수증 분석',
    path: '/receipt-analysis',
    icon: <ReceiptLongIcon />
  },
  {
    title: '처리 이력',
    path: '/dashboard/history',
    icon: <HistoryIcon />
  },
  {
    title: '설정',
    path: '/dashboard/settings',
    icon: <SettingsIcon />
  }
]; 

const Sidebar: React.FC = () => {
  const location = useLocation();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  return (
    <div className={`h-full w-64 flex-shrink-0 ${isDark ? 'bg-gray-900 border-r border-gray-700' : 'bg-white border-r border-gray-200'}`}>
      <div className="flex flex-col h-full">
        <div className="space-y-1 py-4">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-4 py-3 mx-2 rounded-md transition-colors ${
                  isActive
                    ? isDark
                      ? 'bg-gray-800 text-blue-400'
                      : 'bg-blue-50 text-blue-600'
                    : isDark
                      ? 'text-gray-300 hover:bg-gray-800 hover:text-white'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <span className={`mr-3 ${
                  isActive
                    ? isDark
                      ? 'text-blue-400'
                      : 'text-blue-600'
                    : ''
                }`}>
                  {item.icon}
                </span>
                <span className="text-sm font-medium">{item.title}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Sidebar; 