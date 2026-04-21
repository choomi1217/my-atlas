package com.myqaweb.auth;

import com.myqaweb.settings.SettingsService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Unit tests for AuthServiceImpl.
 */
@ExtendWith(MockitoExtension.class)
class AuthServiceImplTest {

    @Mock
    private AppUserRepository appUserRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtProvider jwtProvider;

    @Mock
    private SettingsService settingsService;

    @InjectMocks
    private AuthServiceImpl authService;

    private AppUserEntity adminUser;
    private AppUserEntity normalUser;

    @BeforeEach
    void setUp() {
        adminUser = new AppUserEntity(1L, "admin", "encoded-password", Role.ADMIN, LocalDateTime.now());
        normalUser = new AppUserEntity(2L, "testuser", "encoded-password", Role.USER, LocalDateTime.now());
        lenient().when(settingsService.getSessionTimeoutSeconds()).thenReturn(3600L);
    }

    // --- login ---

    @Test
    void login_success_returnsAuthResponse() {
        // Arrange
        AuthDto.LoginRequest request = new AuthDto.LoginRequest("admin", "password123");
        when(appUserRepository.findByUsername("admin")).thenReturn(Optional.of(adminUser));
        when(passwordEncoder.matches("password123", "encoded-password")).thenReturn(true);
        when(jwtProvider.generateToken("admin", Role.ADMIN)).thenReturn("jwt-token-abc");

        // Act
        AuthDto.AuthResponse response = authService.login(request);

        // Assert
        assertNotNull(response);
        assertEquals("jwt-token-abc", response.token());
        assertEquals("admin", response.username());
        assertEquals(Role.ADMIN, response.role());
        verify(appUserRepository).findByUsername("admin");
        verify(passwordEncoder).matches("password123", "encoded-password");
        verify(jwtProvider).generateToken("admin", Role.ADMIN);
    }

    @Test
    void login_wrongPassword_throwsIllegalArgument() {
        // Arrange
        AuthDto.LoginRequest request = new AuthDto.LoginRequest("admin", "wrong-password");
        when(appUserRepository.findByUsername("admin")).thenReturn(Optional.of(adminUser));
        when(passwordEncoder.matches("wrong-password", "encoded-password")).thenReturn(false);

        // Act & Assert
        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> authService.login(request)
        );
        assertTrue(ex.getMessage().contains("Invalid username or password"));
        verify(jwtProvider, never()).generateToken(anyString(), any(Role.class));
    }

    @Test
    void login_nonexistentUser_throwsIllegalArgument() {
        // Arrange
        AuthDto.LoginRequest request = new AuthDto.LoginRequest("nobody", "password123");
        when(appUserRepository.findByUsername("nobody")).thenReturn(Optional.empty());

        // Act & Assert
        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> authService.login(request)
        );
        assertTrue(ex.getMessage().contains("Invalid username or password"));
        verify(passwordEncoder, never()).matches(anyString(), anyString());
        verify(jwtProvider, never()).generateToken(anyString(), any(Role.class));
    }

    // --- register ---

    @Test
    void register_success_returnsAuthResponse() {
        // Arrange
        AuthDto.RegisterRequest request = new AuthDto.RegisterRequest("newuser", "pass1234", Role.USER);
        when(appUserRepository.existsByUsername("newuser")).thenReturn(false);
        when(passwordEncoder.encode("pass1234")).thenReturn("encoded-pass1234");

        AppUserEntity saved = new AppUserEntity(3L, "newuser", "encoded-pass1234", Role.USER, LocalDateTime.now());
        when(appUserRepository.save(any(AppUserEntity.class))).thenReturn(saved);
        when(jwtProvider.generateToken("newuser", Role.USER)).thenReturn("jwt-token-new");

        // Act
        AuthDto.AuthResponse response = authService.register(request);

        // Assert
        assertNotNull(response);
        assertEquals("jwt-token-new", response.token());
        assertEquals("newuser", response.username());
        assertEquals(Role.USER, response.role());
        verify(appUserRepository).existsByUsername("newuser");
        verify(passwordEncoder).encode("pass1234");
        verify(appUserRepository).save(any(AppUserEntity.class));
        verify(jwtProvider).generateToken("newuser", Role.USER);
    }

    @Test
    void register_duplicateUsername_throwsIllegalArgument() {
        // Arrange
        AuthDto.RegisterRequest request = new AuthDto.RegisterRequest("admin", "pass1234", Role.USER);
        when(appUserRepository.existsByUsername("admin")).thenReturn(true);

        // Act & Assert
        IllegalArgumentException ex = assertThrows(
                IllegalArgumentException.class,
                () -> authService.register(request)
        );
        assertTrue(ex.getMessage().contains("Username already exists"));
        verify(appUserRepository, never()).save(any());
        verify(jwtProvider, never()).generateToken(anyString(), any(Role.class));
    }

    @Test
    void register_nullRole_defaultsToUser() {
        // Arrange
        AuthDto.RegisterRequest request = new AuthDto.RegisterRequest("newuser2", "pass5678", null);
        when(appUserRepository.existsByUsername("newuser2")).thenReturn(false);
        when(passwordEncoder.encode("pass5678")).thenReturn("encoded-pass5678");

        AppUserEntity saved = new AppUserEntity(4L, "newuser2", "encoded-pass5678", Role.USER, LocalDateTime.now());
        when(appUserRepository.save(any(AppUserEntity.class))).thenReturn(saved);
        when(jwtProvider.generateToken("newuser2", Role.USER)).thenReturn("jwt-token-default");

        // Act
        AuthDto.AuthResponse response = authService.register(request);

        // Assert
        assertNotNull(response);
        assertEquals(Role.USER, response.role());
        assertEquals("newuser2", response.username());
        verify(appUserRepository).save(argThat(entity -> entity.getRole() == Role.USER));
    }
}
