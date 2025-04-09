import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Button, Box, IconButton, Avatar, Menu, MenuItem, Divider } from '@mui/material';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import { User } from '../types';

interface HeaderProps {
    user?: User;
    onLogout?: () => void;
    showLogout?: boolean;
    isDark?: boolean;
    onToggleDarkMode?: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout, showLogout = false, isDark = false, onToggleDarkMode }) => {
    const navigate = useNavigate();
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setAnchorEl(null);
            }
        }
        
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleLogout = () => {
        handleClose();
        if (onLogout) {
            onLogout();
        }
    };

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleDashboardClick = () => {
        navigate('/dashboard');
    };

    const handleLoginClick = () => {
        navigate('/login');
    };

    const handleSignupClick = () => {
        navigate('/signup');
    };

    const handleProfileClick = () => {
        handleClose();
        navigate('/profile');
    };

    const handleSettingsClick = () => {
        handleClose();
        navigate('/settings');
    };

    const colors = {
        background: isDark ? '#1e1e1e' : '#3f51b5',
        buttonBg: isDark ? '#333333' : '#3949ab',
        buttonHover: isDark ? '#444444' : '#303f9f',
        textPrimary: isDark ? '#ffffff' : '#ffffff',
        textSecondary: isDark ? '#e0e0e0' : '#f5f5f5',
        divider: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
        shadow: isDark ? '0 2px 8px rgba(0,0,0,0.5)' : '0 2px 4px rgba(0,0,0,0.2)'
    };

    const renderAuthButtons = () => {
        if (user) {
            return (
                <Box display="flex" alignItems="center">
                    <Button
                        variant="contained"
                        onClick={handleDashboardClick}
                        sx={{
                            mr: 2,
                            backgroundColor: colors.buttonBg,
                            color: colors.textPrimary,
                            '&:hover': {
                                backgroundColor: colors.buttonHover,
                            },
                            boxShadow: colors.shadow,
                            height: '36px',
                            minWidth: '100px'
                        }}
                    >
                        대시보드
                    </Button>
                    <IconButton onClick={handleClick} sx={{ p: 0 }}>
                        <Avatar 
                            alt={user.name || user.email || "User"} 
                            src={user.profileImage || "/static/avatar.png"}
                            sx={{ 
                                bgcolor: isDark ? 'rgba(255,255,255,0.2)' : colors.buttonBg,
                                color: colors.textPrimary,
                                width: 38,
                                height: 38
                            }}
                        >
                            {(user.name || user.email || "U").charAt(0).toUpperCase()}
                        </Avatar>
                    </IconButton>
                    <Menu
                        anchorEl={anchorEl}
                        open={open}
                        onClose={handleClose}
                        PaperProps={{
                            sx: {
                                bgcolor: isDark ? '#2a2a2a' : '#ffffff',
                                color: isDark ? colors.textPrimary : '#333333',
                                boxShadow: colors.shadow,
                                width: '180px'
                            },
                        }}
                    >
                        <MenuItem onClick={handleProfileClick} sx={{ minWidth: '150px', height: '42px', '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' } }}>프로필</MenuItem>
                        <MenuItem onClick={handleSettingsClick} sx={{ height: '42px', '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' } }}>설정</MenuItem>
                        <Divider sx={{ my: 0.5, bgcolor: colors.divider }} />
                        <MenuItem onClick={handleLogout} sx={{ height: '42px', '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' } }}>로그아웃</MenuItem>
                    </Menu>
                </Box>
            );
        } else {
            return (
                <Box>
                    <Button 
                        color="inherit" 
                        onClick={handleLoginClick}
                        sx={{ 
                            color: colors.textPrimary,
                            mr: 1,
                            height: '36px',
                            minWidth: '80px',
                            '&:hover': {
                                backgroundColor: 'rgba(255,255,255,0.1)'
                            }
                        }}
                    >
                        로그인
                    </Button>
                    <Button 
                        variant="contained" 
                        onClick={handleSignupClick}
                        sx={{
                            backgroundColor: colors.buttonBg,
                            color: colors.textPrimary,
                            height: '36px',
                            minWidth: '100px',
                            '&:hover': {
                                backgroundColor: colors.buttonHover,
                            },
                            boxShadow: colors.shadow
                        }}
                    >
                        회원가입
                    </Button>
                </Box>
            );
        }
    };

    return (
        <AppBar 
            position="static" 
            sx={{ 
                backgroundColor: colors.background,
                boxShadow: colors.shadow,
                width: '100%',
                height: '64px'
            }}
        >
            <Toolbar 
                sx={{ 
                    height: '100%',
                    minHeight: '64px !important',
                    px: { xs: 2, sm: 3, md: 4 }
                }}
            >
                <Typography 
                    variant="h6" 
                    component="div" 
                    sx={{ 
                        flexGrow: 1, 
                        fontWeight: 'bold',
                        color: colors.textPrimary,
                        fontSize: { xs: '1rem', sm: '1.25rem' }
                    }}
                >
                    OCR 이미지 텍스트 추출
                </Typography>

                <IconButton sx={{ ml: 1 }} onClick={onToggleDarkMode} color="inherit">
                    {isDark ? <Brightness7Icon /> : <Brightness4Icon />}
                </IconButton>

                {renderAuthButtons()}
            </Toolbar>
        </AppBar>
    );
};

export default Header;